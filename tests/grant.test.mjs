import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { effectiveGrant, narrowingFindings } from '../tools/lib/grant.mjs';
import { verifyGrant } from '../tools/lib/grant-verify.mjs';
import { grantHas } from '../tools/lib/sim/authority.mjs';

// Grant provenance (finding: a grant is the human approval gate's stand-in, so where it came from
// and how it changed are checked, not trusted): owners, the committing human, append-only narrowing.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-grant-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const base = () => ({
  id: 'GRANT-1',
  granted_by: 'maria',
  granted_to: { role: 'orchestrator' },
  granted_at: '2026-10-01T08:00:00Z',
  source: 'https://forge.example.com/acme/billing/issues/1#issuecomment-1',
  scope: { objective: 'Deliver invoicing', repositories: ['acme/billing'], epics: ['invoicing', 'tax'] },
  actions: ['select-tasks', 'approve-plan', { action: 'merge', repo: 'acme/billing', target: 'integration/invoicing', protected_branch: 'main', strategy: 'squash', requires: ['independent-review', 'required-checks'] }],
  limits: { max_workers: 3, budget: { max_usd: 30 } },
  expires_at: '2026-10-15T08:00:00Z',
  revocable: true,
});

let n = 0;
function repo({ codeowners = '/.orchestrator/grants/ @maria\n' } = {}) {
  const dir = path.join(TMP, `r${(n += 1)}`);
  fs.mkdirSync(path.join(dir, '.orchestrator/grants/drafts'), { recursive: true });
  const git = (who, ...a) => spawnSync('git', ['-C', dir, '-c', `user.name=${who}`, '-c', `user.email=${who}@example.com`, ...a], { encoding: 'utf8' });
  git('maria', 'init', '-q');
  if (codeowners !== null) fs.writeFileSync(path.join(dir, 'CODEOWNERS'), codeowners);
  const write = (g, rel = '.orchestrator/grants/GRANT-1.yaml') => { fs.writeFileSync(path.join(dir, rel), stringify(g)); return path.join(dir, rel); };
  const commit = (who, msg) => { git(who, 'add', '-A'); const r = git(who, 'commit', '-q', '-m', msg); assert.equal(r.status, 0, r.stderr); };
  return { dir, git, write, commit };
}
const rules = (r) => r.findings.filter((f) => f.severity === 'error').map((f) => f.rule);

describe('grant verify', () => {
  it('passes a grant the owning human committed, and every check the history allows', () => {
    const r = repo();
    const file = r.write(base());
    r.commit('maria', 'grant GRANT-1');
    const v = verifyGrant(file, { git: true });
    assert.deepEqual(v.findings, []);
    assert.equal(v.live, true);
  });

  it('fails a grant an agent committed or widened in place, and one whose issued fields changed', () => {
    const r = repo();
    const file = r.write(base());
    r.commit('maria', 'grant GRANT-1');
    r.write({ ...base(), actions: [...base().actions, 'finalize'], limits: { max_workers: 8, budget: { max_usd: 30 } } });
    r.commit('orchestrator', 'widen my own grant');
    const v = verifyGrant(file, { git: true });
    assert.ok(rules(v).includes('committed-by-granter'), JSON.stringify(v.findings));
    assert.ok(rules(v).includes('issued-fields-unchanged'));
    assert.equal(v.live, false);
  });

  it('narrowing is appended by an owner, only narrows, and is never rewritten', () => {
    const r = repo();
    const file = r.write(base());
    r.commit('maria', 'grant GRANT-1');
    const narrowed = [{ at: '2026-10-03T10:00:00Z', by: 'maria', remove_actions: ['merge'], remove_scope: { epics: ['tax'] }, reduce_limits: { max_workers: 2 } }];
    r.write({ ...base(), narrowed });
    r.commit('maria', 'narrow GRANT-1');
    assert.deepEqual(rules(verifyGrant(file, { git: true })), []);
    const g = effectiveGrant({ ...base(), narrowed });
    assert.deepEqual(g.actions, ['select-tasks', 'approve-plan']);
    assert.deepEqual(g.scope.epics, ['invoicing']);
    assert.equal(g.limits.max_workers, 2);
    const sc = { repo: 'acme/billing', target: 'main', strategy: 'squash' };
    const task = { id: 'INV-1', epic: 'invoicing', lands_to: 'integration/invoicing' };
    assert.ok(grantHas(base(), 'merge', sc, task) && !grantHas({ ...base(), narrowed }, 'merge', sc, task), 'the simulator reads the grant in force');

    r.write({ ...base(), narrowed: [{ ...narrowed[0], reduce_limits: { max_workers: 1 } }] });
    r.commit('maria', 'rewrite the narrowing');
    assert.ok(rules(verifyGrant(file, { git: true })).includes('narrowing-append-only'));
  });

  it('a narrowing that widens, removes what the grant does not hold, or empties a scope list is refused', () => {
    const widen = { ...base(), narrowed: [{ at: '2026-10-03T10:00:00Z', by: 'maria', reduce_limits: { max_workers: 5, budget: { max_usd: 40 }, expires_at: '2026-12-01T00:00:00Z' } }] };
    assert.deepEqual(narrowingFindings(widen).map((f) => f.pointer), ['/narrowed/0/reduce_limits/max_workers', '/narrowed/0/reduce_limits/budget/max_usd', '/narrowed/0/reduce_limits/expires_at']);
    const empties = { ...base(), narrowed: [{ at: '2026-10-03T10:00:00Z', by: 'maria', remove_scope: { epics: ['invoicing', 'tax'] } }] };
    assert.match(narrowingFindings(empties)[0].message, /unrestricted: that widens/);
    const twice = { ...base(), narrowed: [{ at: '2026-10-03T10:00:00Z', by: 'maria', remove_actions: ['merge'] }, { at: '2026-10-02T10:00:00Z', by: 'maria', remove_actions: ['merge'] }] };
    assert.deepEqual(narrowingFindings(twice).map((f) => f.pointer), ['/narrowed/1/at', '/narrowed/1/remove_actions']);
  });

  it('granted_by and narrowed[].by are owners of the grants path; the path is protected; a draft is not live', () => {
    const r = repo();
    const file = r.write({ ...base(), granted_by: 'orchestrator-bot', narrowed: [{ at: '2026-10-03T10:00:00Z', by: 'orchestrator-bot', remove_actions: ['approve-plan'] }] });
    assert.deepEqual(rules(verifyGrant(file)).sort(), ['granted-by-is-owner', 'narrowed-by-owner']);
    assert.deepEqual(rules(verifyGrant(file, { owners: ['orchestrator-bot'] })), [], '--owners overrides CODEOWNERS');
    const draft = r.write(base(), '.orchestrator/grants/drafts/GRANT-1.yaml');
    const d = verifyGrant(draft);
    assert.deepEqual(rules(d), ['grant-is-draft']);
    assert.equal(d.live, false);
    const elsewhere = r.write(base(), 'GRANT-1.yaml');
    assert.ok(rules(verifyGrant(elsewhere)).includes('grant-on-protected-path'));

    const open = repo({ codeowners: '/docs/ @maria\n' });
    assert.ok(rules(verifyGrant(open.write(base()))).includes('grant-on-protected-path'), 'CODEOWNERS gives the grants path no owner');
    const none = repo({ codeowners: null });
    assert.ok(rules(verifyGrant(none.write(base()))).includes('granted-by-is-owner'), 'no owners list at all');
  });

  it('a commit named in source must exist', () => {
    const r = repo();
    const file = r.write({ ...base(), source: 'commit 0123abc (specs/invoicing/spec.md)' });
    r.commit('maria', 'grant GRANT-1');
    assert.ok(rules(verifyGrant(file, { git: true })).includes('source-resolves'));
  });

  it('the CLI: harness grant verify exits 0, 1 and 2; the Tally grants verify against its CODEOWNERS', () => {
    const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/cli.mjs'), 'grant', ...a], { encoding: 'utf8', cwd: ROOT });
    const ok = cli('verify', 'examples/tally/.orchestrator/grants/GRANT-1.yaml', 'examples/tally/.orchestrator/grants/GRANT-2.yaml');
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /^PASS .*GRANT-1\.yaml \(live\)$/m);
    assert.equal(cli('verify', 'fixtures/invalid/grant/narrowing-only-narrows.yaml', '--owners', 'maria').status, 1);
    assert.equal(cli('verify').status, 2);
    assert.equal(cli('frobnicate', 'x.yaml').status, 2);
  });
});
