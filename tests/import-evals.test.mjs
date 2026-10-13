import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { importEvals, routingCase } from '../tools/lib/import-evals.mjs';
import { lintSkills, parseScenarios, scenarioMissing } from '../tools/lib/lint-skills.mjs';
import { validateFile } from '../tools/lib/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures/import-evals');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-import-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/import-evals.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });

// A skill folder for lint: the good drafting-widgets SKILL.md renamed, with imported evals.
function skillWith(name, evalsMd, opts = {}) {
  const dir = path.join(TMP, `case-${name}`, 'skills', name);
  fs.mkdirSync(path.join(dir, 'evals'), { recursive: true });
  const good = fs.readFileSync(path.join(ROOT, 'fixtures/lint/good/skills/drafting-widgets/SKILL.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'SKILL.md'), good.replace('name: drafting-widgets', `name: ${name}`));
  const r = importEvals(fs.readFileSync(evalsMd, 'utf8'), { skill: name, source: path.relative(ROOT, evalsMd), ...opts });
  fs.writeFileSync(path.join(dir, 'evals/routing.jsonl'), r.routingJsonl);
  fs.writeFileSync(path.join(dir, 'evals/scenarios.md'), r.scenarios);
  fs.writeFileSync(path.join(dir, 'evals/evidence.md'), r.evidence);
  return { dir, r };
}

describe('import-evals', () => {
  it('a routing row becomes a case: trigger -> positive; a named neighbour -> near-miss; anything else -> negative with "needs route_to"', () => {
    assert.deepEqual(routingCase('"Resolve these merge conflicts."', 'trigger'), { prompt: 'Resolve these merge conflicts.', expect: 'trigger', kind: 'positive' });
    assert.deepEqual(routingCase('"Review PR #9." (near miss)', 'do not trigger (`reviewer`)', { reviewer: 'reviewing-code' }), { prompt: 'Review PR #9.', expect: 'no-trigger', kind: 'near-miss', route_to: 'reviewing-code' });
    const n = routingCase('"Pull the latest template updates." (near miss)', 'do not trigger (`scripts/sync-template.mjs`)');
    assert.equal(n.kind, 'negative');
    assert.match(n.note, /^needs route_to \(the source marks it a near miss\): the source says `scripts\/sync-template\.mjs`/);
  });

  it('the real conflict-resolver evals import into files the evidence contract and lint accept', () => {
    const { dir, r } = skillWith('resolving-conflicts', path.join(FIX, 'conflict-resolver/evals.md'), { rename: { reviewer: 'reviewing-code', 'security-review': 'reviewing-security' } });
    assert.deepEqual(r.counts, { positive: 3, nearMiss: 2, negative: 0, scenarios: 3, evidence: 1 });
    for (const f of ['routing.jsonl', 'evidence.md']) {
      const v = validateFile(path.join(dir, 'evals', f));
      assert.equal(v.status, 'PASS', JSON.stringify(v.results.flatMap((x) => x.findings)));
    }
    for (const s of parseScenarios(r.scenarios)) assert.deepEqual(scenarioMissing(s), [], s.title);
    const lint = lintSkills([path.dirname(dir)], { known: ['reviewing-security'] });
    const rules = lint.skills[0].findings.filter((x) => x.severity === 'error').map((x) => x.rule);
    assert.ok(rules.includes('imported-needs-review'), 'the scenarios have no prompt in the source');
    assert.ok(!rules.includes('route-to-known'), JSON.stringify(rules));
  });

  it('a month-dated entry and an unrouted near miss survive the import, and lint flags the near miss for a human', () => {
    const { dir, r } = skillWith('adopting-things', path.join(FIX, 'adopt-template/evals.md'), { rename: { bootstrap: 'adopting-harness' } });
    assert.match(r.evidence, /^## 2026-09 · a mature repo$/m);
    assert.equal(validateFile(path.join(dir, 'evals/evidence.md')).status, 'PASS');
    const lint = lintSkills([path.dirname(dir)], { known: ['adopting-harness'] });
    const flagged = lint.skills[0].findings.filter((x) => x.rule === 'imported-needs-review');
    assert.ok(flagged.some((x) => x.file === 'evals/routing.jsonl' && /needs route_to/.test(x.message)), JSON.stringify(flagged));
    assert.ok(flagged.some((x) => x.file === 'evals/scenarios.md'));
  });

  it('the CLI writes the three files, refuses to overwrite without --force, and reads --rename', () => {
    const out = path.join(TMP, 'cli/evals');
    const r = cli(path.join(FIX, 'conflict-resolver/evals.md'), '--out', out, '--rename', 'reviewer=reviewing-code');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /3 positive, 2 near-miss, 0 negative routing case\(s\); 3 scenario\(s\); 1 evidence entr\(ies\)/);
    assert.ok(fs.readFileSync(path.join(out, 'routing.jsonl'), 'utf8').includes('"route_to":"reviewing-code"'));
    assert.equal(cli(path.join(FIX, 'conflict-resolver/evals.md'), '--out', out).status, 1);
    assert.equal(cli(path.join(FIX, 'conflict-resolver/evals.md'), '--out', out, '--force').status, 0);
    assert.equal(cli(path.join(FIX, 'conflict-resolver/evals.md')).status, 2, '--out is required');
    assert.equal(cli('no/such/evals.md', '--dry-run').status, 2);
  });
});
