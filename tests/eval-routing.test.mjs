import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPrompt, evaluate, judge, loadSkills, parseAnswer, routingResults, runner } from '../tools/lib/eval-routing.mjs';
import { loadSets, SETS_FILE, setSkills } from '../tools/lib/lint-skills.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(ROOT, 'fixtures/lint/good/skills');
const FAKE = `"${process.execPath}" "${path.join(ROOT, 'fixtures/eval-routing/fake-router.mjs')}"`;
const fake = (mode) => runner(mode ? `FAKE_ROUTER_MODE=${mode} ${FAKE}` : FAKE);
const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/eval-routing.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'promptbook-evals-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

describe('eval-routing', () => {
  const skills = loadSkills([SKILLS]);

  it('shows the router only installed, non-deprecated names and descriptions, and the message fenced', () => {
    const p = buildPrompt(skills, 'Ship it.');
    assert.match(p, /^- drafting-widgets: Use when someone asks to draft/m);
    assert.doesNotMatch(p, /sorting-widgets/, 'a deprecated skill is not offered');
    assert.doesNotMatch(p, /routing\.jsonl|scenarios|AC-\d|## Procedure/, 'no body, no evals');
    assert.match(p, /<message>\nShip it\.\n<\/message>$/);
  });

  it('dry run by default: builds every prompt, calls nothing', () => {
    const r = evaluate(skills, { ask: () => { throw new Error('called'); } });
    assert.equal(r.dryRun, true);
    assert.equal(r.totals.cases, 30);
    assert.equal(r.totals.run, 0);
    assert.ok(r.cases.every((c) => c.routerPrompt.includes(c.prompt)));
  });

  it('a router that routes correctly passes every case, with precision and recall 1', () => {
    const r = evaluate(skills, { ask: fake(), dryRun: false });
    assert.deepEqual(r.totals, { cases: 30, run: 30, passed: 30, failed: 0, skills: 3 }, JSON.stringify(r.cases.filter((c) => !c.pass), null, 2));
    for (const [name, m] of Object.entries(r.perSkill)) assert.deepEqual([m.precision, m.recall], [1, 1], name);
  });

  it('a router that never picks fails every trigger case: recall 0, precision undefined', () => {
    const r = evaluate(skills, { ask: fake('none'), dryRun: false });
    assert.equal(r.cases.filter((c) => c.expect === 'trigger' && !c.pass).length, 12);
    assert.equal(r.perSkill['drafting-widgets'].recall, 0);
    assert.equal(r.perSkill['drafting-widgets'].precision, null);
    assert.ok(r.cases.filter((c) => c.kind === 'negative').every((c) => c.pass), 'negatives pass with none');
  });

  it('a router that picks everything fails every no-trigger case: recall 1, precision low', () => {
    const r = evaluate(skills, { ask: fake('all'), dryRun: false });
    assert.ok(r.cases.filter((c) => c.expect === 'no-trigger' && c.skill !== 'sorting-widgets').every((c) => !c.pass));
    assert.ok(r.cases.filter((c) => c.skill === 'sorting-widgets').every((c) => !c.picked.includes('sorting-widgets')), 'a deprecated skill is never offered, so never picked');
    const m = r.perSkill['checking-widgets'];
    assert.equal(m.recall, 1);
    assert.ok(m.precision < 0.5, String(m.precision));
  });

  it('a near-miss passes only when its installed route_to is named; a deprecated skill\'s old prompt must route on', () => {
    const k = { expect: 'no-trigger', kind: 'near-miss', route_to: 'checking-widgets', route_to_installed: true };
    assert.equal(judge(k, 'drafting-widgets', ['checking-widgets']), true);
    assert.equal(judge(k, 'drafting-widgets', []), false);
    assert.equal(judge({ ...k, route_to: 'reviewing-code', route_to_installed: false }, 'drafting-widgets', []), true, 'an external skill that is not installed cannot be named');
    assert.equal(judge({ expect: 'no-trigger', route_to: 'none' }, 'x', ['y']), false);
    const r = evaluate(skills, { ask: fake(), dryRun: false, only: 'sorting-widgets' });
    assert.deepEqual(r.cases.map((c) => [c.picked, c.pass]), [[['drafting-widgets'], true], [[], true]]);
  });

  it('parses the last line of a chatty answer and ignores names it was not shown', () => {
    const names = skills.map((s) => s.name);
    assert.deepEqual(parseAnswer('Thinking...\n\n`checking-widgets`.', names), ['checking-widgets']);
    assert.deepEqual(parseAnswer('drafting-widgets, shipping-widgets', names), ['drafting-widgets', 'shipping-widgets']);
    assert.deepEqual(parseAnswer('None.', names), []);
    assert.deepEqual(parseAnswer('made-up-skill', names), []);
    const r = evaluate(skills, { ask: fake('chatty'), dryRun: false });
    assert.equal(r.totals.failed, 0);
  });

  it('a runner that fails is a failed case with its error, not a crash', () => {
    const r = evaluate(skills, { ask: fake('fail'), dryRun: false, limit: 2 });
    assert.equal(r.totals.failed, 2);
    assert.match(r.cases[0].error, /runner exited 3: rate limited/);
  });
});

describe('eval-routing CLI', () => {
  it('dry-runs by default: prints per-skill counts and one prompt, exit 0', () => {
    const r = cli('fixtures/lint/good/skills');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^drafting-widgets +10 case\(s\)$/m);
    assert.match(r.stdout, /30 case\(s\) across 4 skill\(s\); dry run, nothing was sent/);
    assert.match(r.stdout, /^You are the skill router/m);
  });

  it('with --runner, reports precision/recall and exits 0 when every case passes, 1 otherwise', () => {
    const ok = cli('fixtures/lint/good/skills', '--runner', FAKE);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /^drafting-widgets +100% +100%/m);
    assert.match(ok.stdout, /30\/30 case\(s\) pass/);
    const bad = cli('fixtures/lint/good/skills', '--runner', `FAKE_ROUTER_MODE=all ${FAKE}`, '--skill', 'checking-widgets');
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /^FAIL checking-widgets:\d+ "Draft a spec for a new widget\." → expected not checking-widgets; drafting-widgets, got /m);
  });

  it('--runs k asks k times and passes a case only when all k pass; --out writes routing results the evidence contract accepts', () => {
    const out = path.join(TMP, 'routing-results.jsonl');
    const r = cli('fixtures/lint/good/skills', '--runner', FAKE, '--runs', '3', '--model', 'fake-cheap', '--out', out);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /30\/30 case\(s\) pass all 3 runs \(pass\^3\)/);
    const lines = fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 30);
    assert.ok(lines.every((l) => l.runs === 3 && l.answers.length === 3 && l.model === 'fake-cheap' && l.pass));
    const v = spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), out], { encoding: 'utf8' });
    assert.equal(v.status, 0, v.stdout);
    assert.match(v.stdout, /evidence@\d+\.\d+\.\d+ ×30/);
  });

  it('a case that passes only some of its runs fails (pass^k)', () => {
    let n = 0;
    const flaky = (prompt) => { n += 1; return n % 3 === 0 ? 'none' : runner(FAKE)(prompt); };
    const r = evaluate(loadSkills([SKILLS]), { ask: flaky, dryRun: false, runs: 3, only: 'drafting-widgets' });
    const trigger = r.cases.find((c) => c.expect === 'trigger');
    assert.equal(trigger.passes, 2);
    assert.equal(trigger.pass, false);
    const lines = routingResults(r, { model: 'flaky' });
    assert.ok(lines.every((l) => l.answers.length === 3));
  });

  it('--set installs only that set of the folder holding SETS.yaml, other folders whole; --cases reads another cases file', () => {
    const r = cli('skills', 'fixtures/lint/good/skills', '--set', 'personal', '--cases', 'heldout.routing.jsonl');
    assert.equal(r.status, 0, r.stderr);
    const listed = [...r.stdout.matchAll(/^([a-z-]+) +\d+ case\(s\)/gm)].map((m) => m[1]);
    const personal = [...setSkills(loadSets(path.join(ROOT, 'skills', SETS_FILE)).data, 'personal')];
    const pinned = fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, 'SKILL.md')));
    assert.deepEqual(listed.sort(), [...personal, ...pinned].sort());
    assert.doesNotMatch(r.stdout, /^- orchestrating-work:/m, 'a skill outside the set is not in the catalog');
    const heldout = personal.reduce((n, s) => n + fs.readFileSync(path.join(ROOT, 'skills', s, 'evals/heldout.routing.jsonl'), 'utf8').trim().split('\n').length, 0);
    assert.match(r.stdout, new RegExp(`eval-routing: ${heldout} case\\(s\\) across ${listed.length} skill`), 'the pinned fixtures have no held-out file');
    assert.equal(cli('skills', '--set', 'nobody').status, 2);
    assert.equal(cli('fixtures/lint/good/skills', '--set', 'personal').status, 2, 'no SETS.yaml');
  });

  it('usage errors exit 2', () => {
    assert.equal(cli('fixtures/lint/good/skills', '--out', path.join(TMP, 'x.jsonl')).status, 2, '--out without --runner');
    assert.equal(cli('fixtures/lint/good/skills', '--runner', FAKE, '--runs', '0').status, 2);
    assert.equal(cli('no/such/dir').status, 2);
    assert.equal(cli('fixtures/lint/good/skills', '--skill', 'nobody').status, 2);
    assert.equal(cli('fixtures/lint/good/skills', '--runner').status, 2);
  });
});
