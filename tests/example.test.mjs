import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { walk } from '../tools/lib/glob.mjs';
import { readLock } from '../tools/lib/lock.mjs';
import { registry } from '../tools/lib/registry.mjs';
import { criteria as readCriteria } from '../tools/lib/ears.mjs';
import { loadFrontmatterMarkdown } from '../tools/lib/loaders.mjs';
import { workerCap } from '../tools/lib/sim/authority.mjs';
import { exportTaskRecords } from '../tools/lib/sim/invariants.mjs';
import { loadScenario } from '../tools/lib/sim/scenario.mjs';
import { simulate } from '../tools/lib/sim/simulate.mjs';

// The worked example (examples/tally) must stay valid, traced, simulated and compiled: it is what a
// reader learns the contracts from, so a contract or tool change that breaks it fails here.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'examples/tally');
const rel = (p) => path.relative(ROOT, p);
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'promptbook-example-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const promptbook = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'tools/cli.mjs'), ...args], { encoding: 'utf8', cwd: ROOT });
const json = (r) => JSON.parse(r.stdout);
const yaml = (p) => parse(fs.readFileSync(path.join(EX, p), 'utf8'));
const git = (...a) => spawnSync('git', ['-c', 'safe.directory=*', '-C', ROOT, ...a], { encoding: 'utf8' });

const TASK_DIR = path.join(EX, 'specs/settle-up/tasks');
const taskFiles = Object.fromEntries(fs.readdirSync(TASK_DIR).map((f) => {
  const text = fs.readFileSync(path.join(TASK_DIR, f), 'utf8');
  return [f.replace(/\.md$/, ''), { data: loadFrontmatterMarkdown(text).records[0].data, criteria: readCriteria(text).items.map((c) => c.id) }];
}));

// Contracts the example exercises. A new contract fails this test until the example uses it or it
// is listed below with the reason it has no place in a product's files.
const NOT_IN_A_PRODUCT = {
  skill: 'Tally has no domain skill; its agents load the skills of the Skilldex sets it pins',
  evidence: 'skill evals live with the skills, in Skilldex',
  operator: "the profile lives in the operator's private repository; a product keeps only what bootstrap stamped (docs/holdco.md)",
};

describe('the worked example: Tally', () => {
  it('validates: every file the layout or a suffix names passes its contract, and every product contract is used', () => {
    const r = promptbook('validate', rel(EX), '--json');
    assert.equal(r.status, 0, r.stdout);
    const results = json(r);
    assert.ok(results.every((x) => x.status === 'PASS'));
    const used = new Set(results.flatMap((x) => x.results.map((y) => y.contract)));
    for (const c of registry().contracts()) {
      if (NOT_IN_A_PRODUCT[c]) assert.ok(!used.has(c), `${c} is used now; drop it from NOT_IN_A_PRODUCT`);
      else assert.ok(used.has(c), `the example does not exercise the ${c} contract`);
    }
  });

  it('traces strict: ready, nothing uncovered, a test name for every criterion', () => {
    const r = promptbook('trace', rel(EX), '--strict', '--json');
    assert.equal(r.status, 0, r.stdout);
    const t = json(r);
    assert.equal(t.adoption, 'full');
    assert.deepEqual(t.counts, { error: 0, warning: 0, info: 0 });
    const [e] = t.epics;
    assert.equal(e.verdict, 'ready');
    for (const [k, c] of Object.entries(e.coverage)) assert.equal(c.covered, c.total, k);
    // Coverage counts a bare AC-n only when one task of the epic has it; the example names each
    // test "<TASK> AC-n" anyway, so hold every criterion, whatever its task's status, to that.
    const key = (x) => `${x.task} ${x.criterion}`;
    const want = Object.entries(taskFiles).flatMap(([task, { criteria }]) => criteria.map((criterion) => ({ task, criterion, evidence: 'qualified' })));
    assert.deepEqual(e.criteria_evidence.toSorted((a, b) => key(a).localeCompare(key(b))), want.toSorted((a, b) => key(a).localeCompare(key(b))));
  });

  it('its committed readiness report is the one the plan generates now (trace --readiness --check)', () => {
    const r = promptbook('trace', rel(EX), '--readiness', rel(path.join(EX, 'specs')), '--check');
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /readiness 1\/1 report\(s\) current/);
  });

  it('simulates the queue as it stands, 50 seeds, with no invariant violated', () => {
    const r = promptbook('simulate', '--project', rel(EX), '--seeds', '1..50', '--no-trace', '--json');
    assert.equal(r.status, 0, r.stdout.slice(0, 2000));
    const s = json(r);
    assert.equal(s.seeds, 50);
    assert.equal(s.violations, 0, JSON.stringify(s.first_violation));
    assert.equal(s.merged_mean, s.tasks, 'every task reaches merged');
  });

  it('simulates the walkthrough\'s faults, 50 seeds: each fires, none violates an invariant', () => {
    const r = promptbook('simulate', rel(path.join(EX, 'simulate.yaml')), '--seeds', '1..50', '--no-trace', '--json');
    assert.equal(r.status, 0, r.stdout.slice(0, 2000));
    assert.equal(json(r).violations, 0);
    const sc = loadScenario(path.join(EX, 'simulate.yaml'));
    for (let seed = 1; seed <= 50; seed += 1) {
      const { world: w, trace } = simulate(sc, { seed, trace: true });
      const commits = trace.flatMap((e) => e.commits ?? []);
      const denied = [...w.prompts.values()].filter((p) => p.task === 'SPLIT-4' && p.state === 'denied' && p.answeredKind === 'policy');
      assert.ok(denied.length && denied.every((p) => p.surfaced), `seed ${seed}: the unattended ask was a denial that reached the human`);
      assert.ok(w.forge.prs.get('SPLIT-2').reviews.some((x) => x.role === 'evaluator' && x.verdict !== 'pass'), `seed ${seed}: the evaluator rejected a head`);
      assert.ok(w.stats.signalsLost > 0, `seed ${seed}: a wake was lost`);
      const integrated = commits.filter((c) => c.transition === 'integrate');
      assert.deepEqual(integrated.map((c) => c.task).sort(), ['SPLIT-2', 'SPLIT-3', 'SPLIT-4'], `seed ${seed}`);
      assert.ok(integrated.every((c) => c.role === 'orchestrator' && c.grant === 'GRANT-2'), `seed ${seed}: integrated under GRANT-2`);
      const recs = exportTaskRecords(w).filter((x) => x.task_id !== 'SPLIT-1');
      assert.ok(recs.length && recs.every((x) => x.grant === 'GRANT-1'), `seed ${seed}: the task records name GRANT-1, the grant that dispatched the work`);
      assert.deepEqual(commits.filter((c) => c.transition === 'promote' && c.by === 'dana').map((c) => c.task).sort(), ['SPLIT-2', 'SPLIT-3', 'SPLIT-4'], `seed ${seed}: dana merged the branch`);
    }
  });

  it('the scenario is a copy of the project: its tasks, both grants, and the operator\'s command rules and caps', () => {
    const sc = yaml('simulate.yaml');
    const grantFiles = fs.readdirSync(path.join(EX, '.orchestrator/grants')).sort().map((f) => yaml(`.orchestrator/grants/${f}`));
    assert.deepEqual(sc.grants, grantFiles);
    assert.deepEqual(sc.tasks.map((t) => t.id).sort(), Object.keys(taskFiles).sort());
    for (const t of sc.tasks) {
      const { data: f, criteria } = taskFiles[t.id];
      const want = { epic: f.epic, priority: f.priority, size: f.size, risk: typeof f.risk === 'object' ? f.risk.level : f.risk, touches: f.touches, depends_on: f.depends_on, criteria, budget: f.budget, lands_to: f.lands_to };
      const got = { epic: t.epic, priority: t.priority, size: t.size, risk: t.risk, touches: t.touches, depends_on: t.depends_on, criteria: t.criteria, budget: t.budget, lands_to: t.lands_to };
      assert.deepEqual(got, want, t.id);
    }
    const policy = yaml('_operator/agent-policy.yaml');
    // The simulator models argv-prefix rules: a flags-anywhere forbid enters as its prefix form (the
    // words, then one of its literal flags), what every engine compiles from it.
    const prefix = (x) => (x.flags_anywhere ? [...x.command, x.flags_anywhere.filter((f) => !f.endsWith('*'))] : x.command);
    const commands = (list) => list.filter((x) => x.command).map(prefix);
    assert.deepEqual(sc.policy.forbid.map((x) => x.command), commands(policy.forbid));
    assert.deepEqual(sc.policy.ask.map((x) => x.command), commands(policy.ask));
    assert.equal(sc.policy.tier, policy.profiles.ci.tier);
    const { max_turns, max_usd } = policy.budgets.unattended;
    assert.deepEqual(sc.policy.budgets, { max_turns, max_usd });
    // The runtime's budget and workers cap are GRANT-1's, the grant that dispatches the work;
    // GRANT-2 delegates merge alone, so its max_workers (one merge at a time) caps no dispatch.
    const [g1, g2] = grantFiles;
    const norm = loadScenario(path.join(EX, 'simulate.yaml'));
    assert.equal(norm.supervisor.budget_usd, g1.limits.budget.max_usd);
    assert.equal(workerCap(norm.grants, Date.parse(sc.start), norm.supervisor.max_workers), g1.limits.max_workers);
    assert.equal(g2.limits.max_workers, 1);
  });

  it('the compiled policy is the compiler\'s output: every profile × engine recompiles to the committed files', () => {
    const policyFile = path.join(EX, '_operator/agent-policy.yaml');
    const compiled = path.join(EX, '_operator/compiled');
    const policy = yaml('_operator/agent-policy.yaml');
    const expected = [];
    for (const [profile, p] of Object.entries(policy.profiles)) {
      for (const engine of p.engines) {
        expected.push(`${engine}/${profile}`);
        const out = path.join(TMP, engine, profile);
        const r = promptbook('compile-policy', rel(policyFile), '--profile', profile, '--engine', engine, '--out', out);
        assert.equal(r.status, 0, `${engine}/${profile}: ${r.stderr}`);
        const files = (dir) => walk(dir).map((f) => path.relative(dir, f)).sort();
        const golden = path.join(compiled, engine, profile);
        assert.deepEqual(files(golden), files(out), `${engine}/${profile}: the same files`);
        for (const f of files(out)) assert.equal(fs.readFileSync(path.join(golden, f), 'utf8'), fs.readFileSync(path.join(out, f), 'utf8'), `${engine}/${profile}/${f} differs from the compiler's output`);
      }
    }
    const committed = fs.readdirSync(compiled).flatMap((e) => fs.readdirSync(path.join(compiled, e)).map((p) => `${e}/${p}`));
    assert.deepEqual(committed.sort(), expected.sort(), 'no compiled output for a profile or engine the policy does not name');
  });

  it('the lock check passes: the promptbook pin (and Skilldex, when the network reaches it)', (t) => {
    const lockFile = path.join(EX, 'toolkit.lock');
    const pin = readLock(lockFile).data.entries.find((e) => e.kind === 'promptbook');
    // A detached CI checkout resolves the ref through origin, or verifies the pin by its commit; a
    // shallow one may not hold the pinned commit at all.
    if (git('cat-file', '-e', `${pin.commit}^{commit}`).status !== 0) {
      t.skip(`needs the pinned commit ${pin.commit.slice(0, 12)} (a shallow clone lacks it)`);
      return;
    }
    let r = promptbook('lock', '--lock', rel(lockFile), '--check', '--json');
    let res = json(r);
    const unreachable = (x) => x.findings.some((f) => f.rule === 'source-unreachable');
    if (r.status !== 0 && res.entries.every((x) => unreachable(x) || !x.findings.some((f) => f.severity === 'error'))) {
      t.diagnostic('a remote source is unreachable; checked the local pins with --offline');
      r = promptbook('lock', '--lock', rel(lockFile), '--check', '--offline', '--json');
      res = json(r);
    }
    assert.equal(r.status, 0, JSON.stringify(res.entries.map((x) => [x.name, x.findings]), null, 2));
    assert.ok(!res.entries.find((x) => x.name === 'promptbook').findings.some((f) => f.severity === 'error'));
    assert.deepEqual(readLock(lockFile).data.entries.find((e) => e.kind === 'skill-library').sets, ['planning', 'delivery'], 'Skilldex is pinned once, with the sets the project installs');
  });

  it('the records tell the walkthrough\'s story: every id resolves, and attention never stood in for status', () => {
    const records = Object.fromEntries(fs.readdirSync(path.join(EX, '.orchestrator/tasks')).map((f) => [f.replace(/\.yaml$/, ''), yaml(`.orchestrator/tasks/${f}`)]));
    const grants = new Set(fs.readdirSync(path.join(EX, '.orchestrator/grants')).map((f) => f.replace(/\.yaml$/, '')));
    assert.deepEqual(Object.keys(records).sort(), Object.keys(taskFiles).sort(), 'one record per task');
    for (const [id, r] of Object.entries(records)) {
      assert.equal(r.task_id, id);
      if (r.grant) assert.ok(grants.has(r.grant), `${id} acts under ${r.grant}`);
    }
    const runs = fs.readFileSync(path.join(EX, '.agent/loop-runs.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    for (const x of runs) assert.ok(taskFiles[x.task] && (!x.grant || grants.has(x.grant)), `run ${x.session_id}`);
    // Every hand-back has its run record, and each run says whose it was: an evaluator's ends in a
    // verdict, a reader's in a read, and neither moves the task; only an author advances one.
    const ROLE = { coder: 'author', evaluator: 'evaluator', reader: 'reader' };
    const OUTCOME = { evaluator: ['verdict'], reader: ['read'] };
    for (const f of fs.readdirSync(path.join(EX, '.agent/returns'))) {
      const ret = JSON.parse(fs.readFileSync(path.join(EX, '.agent/returns', f), 'utf8'));
      assert.ok(taskFiles[ret.task], f);
      for (const a of ret.artifacts.filter((x) => x.path.startsWith('.agent/'))) assert.ok(fs.existsSync(path.join(EX, a.path)), `${f} points at ${a.path}`);
      const run = runs.find((x) => x.session_id === ret.session.session_id);
      assert.ok(run, `${f}: no run record for session ${ret.session.session_id}`);
      assert.equal(run.role, ROLE[ret.role], f);
      if (OUTCOME[run.role]) assert.ok(OUTCOME[run.role].includes(run.outcome) && run.status_after === run.status_before, `${f}: a ${run.role}'s run is a ${OUTCOME[run.role]} that moves nothing`);
    }
    assert.ok(runs.filter((x) => x.outcome === 'advanced').every((x) => x.role === 'author'), 'only an author advances a task');
    assert.deepEqual(runs.filter((x) => x.role === 'evaluator').map((x) => x.outcome), ['verdict', 'verdict', 'verdict']);
    assert.deepEqual(new Set(Object.values(records).map((r) => r.state.name)), new Set(['working', 'needs-human', 'complete']));
    const denial = runs.find((x) => x.permission_denials > 0);
    assert.ok(denial && denial.outcome === 'stalled' && denial.attention === 'needs-human', 'a run whose ask was denied');
    assert.equal(records[denial.task].state.name, 'needs-human');
    assert.equal(taskFiles[denial.task].data.status, 'in-progress', 'the denial moved attention, not status');
    const integrated = Object.keys(taskFiles).find((id) => taskFiles[id].data.status === 'integrated');
    assert.equal(records[integrated].state.name, 'complete', 'waiting for the human\'s merge of the branch is a status, not attention');
    const verdicts = records[integrated].reviews.filter((x) => x.role === 'evaluator').map((x) => x.outcome);
    assert.deepEqual(verdicts, ['fail', 'pass'], 'the evaluator failed one head and passed the next');
  });
});
