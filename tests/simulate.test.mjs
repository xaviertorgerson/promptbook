import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { grantState } from '../tools/lib/sim/authority.mjs';
import { Checker, INVARIANTS } from '../tools/lib/sim/invariants.mjs';
import { MUTATIONS, orchestrating } from '../tools/lib/sim/policies.mjs';
import { loadScenario, normalize, scenarioFromProject } from '../tools/lib/sim/scenario.mjs';
import { machines, simulate, writeOutputs } from '../tools/lib/sim/simulate.mjs';
import { globsOverlap, makeRng } from '../tools/lib/sim/util.mjs';
import { registry as reg } from '../tools/lib/registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCEN = path.join(ROOT, 'fixtures/scenarios');
const SEEDS = Number(process.env.SIM_SEEDS ?? 50);
const MUTANT_SEEDS = 12;
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-sim-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const raw = (name) => parse(fs.readFileSync(path.join(SCEN, `${name}.yaml`), 'utf8'));
const scenario = (name, over = {}) => {
  const r = raw(name);
  for (const [k, v] of Object.entries(over)) r[k] = r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]) ? { ...r[k], ...v } : v;
  return normalize(r, { source: name });
};
const seeds = (n) => Array.from({ length: n }, (_, i) => i + 1);
const runAll = (sc, n, opts = {}) => seeds(n).map((seed) => simulate(sc, { seed, trace: false, ...opts }));
const firstViolation = (runs) => runs.flatMap((r) => r.violations)[0];

describe('simulate: every scenario holds every invariant under the correct supervisor', () => {
  const files = fs.readdirSync(SCEN).filter((f) => f.endsWith('.yaml')).sort();
  it('has the scenarios the contracts need', () => {
    for (const n of ['happy-path', 'parallel-overlap', 'crash-lost-events', 'merge-without-grant', 'budget-exhaustion', 'unattended-ask', 'evaluator-rejection', 'grant-expiry', 'wall-bypass', 'integration-branch']) assert.ok(files.includes(`${n}.yaml`), n);
  });
  for (const f of files) {
    it(`${f} × ${SEEDS} seeds: zero violations`, () => {
      const runs = runAll(loadScenario(path.join(SCEN, f)), SEEDS);
      const v = firstViolation(runs);
      assert.equal(v, undefined, v && `${v.invariant} at seed ${v.seed} event ${v.index}: ${v.message} (node tools/simulate.mjs fixtures/scenarios/${f} --seed ${v.seed})`);
    });
  }
  it(`the prompting-tier variant of unattended-ask × ${SEEDS} seeds: zero violations, prompts reach the human`, () => {
    const runs = runAll(scenario('unattended-ask', { policy: { tier: 'ask' } }), SEEDS);
    assert.equal(firstViolation(runs), undefined, JSON.stringify(firstViolation(runs)));
    const prompts = runs.flatMap((r) => [...r.world.prompts.values()]);
    assert.ok(prompts.length >= SEEDS);
    assert.ok(prompts.every((p) => p.surfaced && p.answeredKind === 'human'), 'every prompt surfaced and answered by the human');
  });
});

describe('simulate: the faults happen and are handled as the contracts say', () => {
  it('concurrent claims race on the forge and exactly one runtime wins each task', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'parallel-overlap.yaml')), 10, { trace: true });
    assert.ok(runs.every((r) => r.world.stats.claimsLost > 0 && r.world.stats.pushesRejected > 0));
    const owners = new Set(runs.flatMap((r) => [...r.world.forge.tasks.values()].map((t) => t.owner)));
    assert.ok(owners.has('sim-coder') && owners.has('rival-coder'), 'both runtimes win some claims');
    for (const r of runs) {
      const claims = r.trace.flatMap((l) => l.commits ?? []).filter((c) => c.transition === 'claim');
      const perTask = new Map();
      for (const c of claims) perTask.set(c.task, (perTask.get(c.task) ?? 0) + 1);
      for (const [task, n] of perTask) assert.ok(n === 1 || r.trace.some((l) => (l.commits ?? []).some((c) => c.task === task && c.to === 'ready')), `${task} claimed ${n} times without going back to ready`);
    }
  });

  it('lost wakes, notices, duplicates, unknown states and crashes occur, and the queue still drains', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'crash-lost-events.yaml')), 10);
    const sum = (k) => runs.reduce((a, r) => a + r.world.stats[k], 0);
    for (const k of ['signalsLost', 'notices', 'duplicates', 'crashes']) assert.ok(sum(k) > 0, k);
    assert.ok(runs.reduce((a, r) => a + r.summary.merged, 0) >= 45, 'nearly every task merges despite the faults');
  });

  it('a coder\'s own merge attempt is refused by the forge; a finalize grant never merges', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'merge-without-grant.yaml')), 10, { trace: true });
    assert.ok(runs.every((r) => r.world.stats.landsRejected >= 2));
    for (const r of runs) {
      const approvals = r.trace.flatMap((l) => l.commits ?? []).filter((c) => c.transition === 'approve-pr');
      assert.ok(approvals.length && approvals.every((c) => c.role === 'owner'), 'only the human approves');
    }
  });

  it('a ceiling stops the run, the human decides, and spend stays within every budget', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'budget-exhaustion.yaml')), 10);
    for (const r of runs) {
      const records = r.world.artifacts.runRecords;
      assert.ok(records.some((x) => x.subtype === 'error_max_budget_usd' || x.subtype === 'error_max_turns'));
      assert.ok(records.every((x) => x.budget?.max_usd <= 3 && x.budget?.max_turns <= 120), 'every run carries the policy caps');
      assert.ok(r.summary.spend_usd <= 40);
      assert.ok(r.world.forge.decisions.some((d) => d.kind === 'budget'), 'the human raised a budget once');
    }
  });

  it('a task out of budget at review gets the human\'s decision: a raise lands it, a refusal parks it', () => {
    const task = { id: 'BAR-1', status: 'review', owner: 'sim-coder', budget: { max_usd: 0.1 }, touches: ['src/a/**'] };
    const raise = runAll(normalize({ name: 'budget-at-review', human: { on_budget: 'raise', raise_usd: 2, max_raises: 1 }, tasks: [task] }), 5);
    for (const r of raise) {
      assert.deepEqual(r.violations, []);
      assert.ok(r.world.forge.decisions.some((d) => d.task === 'BAR-1' && d.kind === 'budget'), 'the human raised the budget');
      assert.equal(r.world.forge.tasks.get('BAR-1').status, 'merged');
    }
    for (const r of runAll(normalize({ name: 'budget-at-review', human: { on_budget: 'park' }, tasks: [task] }), 5)) {
      assert.deepEqual(r.violations, []);
      assert.equal(r.world.forge.tasks.get('BAR-1').status, 'suspended');
    }
  });

  it('unattended, an ask is a denial that reaches the human; nobody approves it', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'unattended-ask.yaml')), 10);
    for (const r of runs) {
      const prompts = [...r.world.prompts.values()];
      assert.equal(prompts.length, 2);
      assert.ok(prompts.every((p) => p.state === 'denied' && p.answeredKind === 'policy' && p.surfaced));
      assert.ok(r.world.artifacts.runRecords.some((x) => x.permission_denials > 0 && x.attention === 'needs-human'));
      const high = r.world.forge.tasks.get('UNA-4');
      assert.ok(['ready', 'suspended'].includes(high.status) && high.owner === null, 'the high-risk task never ran unattended');
    }
  });

  it('a wall blocks in the bypass tier, and a task that makes no progress stops after one run', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'wall-bypass.yaml')), 10);
    for (const r of runs) {
      assert.ok(r.world.stats.wallsBlocked >= 2);
      assert.equal(r.world.executed.length, 0);
      assert.equal(r.world.artifacts.runRecords.filter((x) => x.task === 'WAL-3').length, 1);
      assert.equal(r.world.forge.tasks.get('WAL-3').status, 'suspended');
    }
  });

  it('after a grant expires the orchestrator stops exercising it and asks for a renewal; semantic conflicts go back to the human', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'grant-expiry.yaml')), 10, { trace: true });
    for (const r of runs) {
      const byGrant = r.trace.flatMap((l) => l.commits ?? []).filter((c) => c.role === 'orchestrator');
      assert.ok(byGrant.some((c) => c.transition === 'approve-pr'), 'the grant was used');
      assert.ok(byGrant.every((c) => ['GRANT-3', 'GRANT-4'].includes(c.grant)), 'every orchestrator commit names the live grant');
      assert.ok(r.trace.some((l) => (l.effects ?? []).some((e) => e.record === 'GRANT-3' && e.attention === 'needs-human')), 'the lapse reached the human');
    }
    // The conflict needs GEX-2 and GEX-3 in the merge window together, which most seeds produce.
    const returned = runs.filter((r) => r.trace.flatMap((l) => l.commits ?? []).some((c) => c.transition === 'return-to-human'));
    assert.ok(returned.length >= 5, `the semantic conflict went back to the human in ${returned.length}/10 seeds`);
    for (const r of returned) assert.ok(r.trace.flatMap((l) => l.commits ?? []).filter((c) => c.transition === 'return-to-human').every((c) => c.role === 'orchestrator' && ['GRANT-3', 'GRANT-4'].includes(c.grant)), 'the orchestrator, under the live merge grant, hands it back');
    for (const r of runs) {
      const commits = r.trace.flatMap((l) => l.commits ?? []);
      assert.ok(!commits.some((c) => c.transition === 'land'), 'nothing lands on main under the grant');
      assert.ok(commits.filter((c) => c.transition === 'promote').every((c) => c.role === 'owner'), 'the human promotes the integration branch');
    }
  });

  describe('a runtime holding a work grant and a separate merge grant', () => {
    const grant = (id, actions, limits) => ({ id, granted_by: 'owner', granted_to: { role: 'orchestrator', runtime: 'sim' }, granted_at: '+0m', source: `sim: ${id}`, scope: { objective: 'Deliver the sim epic', repositories: ['acme/app'], epics: ['sim'] }, actions, limits, expires_at: '+14d', revocable: true });
    const work = grant('GRANT-1', ['select-tasks', 'approve-plan', 'finalize'], { max_workers: 2, budget: { max_usd: 60 } });
    const mergeOnly = grant('GRANT-2', [{ action: 'merge', repo: 'acme/app', target: 'integration/sim', protected_branch: 'main', strategy: 'squash', requires: ['independent-review', 'required-checks'] }], { max_workers: 1, budget: { max_usd: 5 } });
    const tasks = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ id: `TWO-${i + 1}`, size: 'S', lands_to: 'integration/sim', touches: [`src/${x}/**`] }));
    const base = { name: 'two-grants', supervisor: { max_workers: 4 }, merge: { queue_targets: [] }, grants: [work, mergeOnly], tasks };
    const peak = (w) => {
      const marks = [...w.sessions.values()].filter((s) => s.runtime === 'main' && ['author', 'evaluator'].includes(s.kind)).flatMap((s) => [[s.startedAt, 1], [s.endedAt ?? Infinity, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let live = 0;
      let max = 0;
      for (const [, d] of marks) { live += d; max = Math.max(max, live); }
      return max;
    };

    it('the workers cap is the work grant\'s (2), not the merge grant\'s (1) nor the supervisor\'s (4); the runtime budget is the work grant\'s', () => {
      const sc = normalize(base);
      assert.deepEqual(sc.grants.map((g) => g.id), ['GRANT-1', 'GRANT-2']);
      assert.equal(sc.supervisor.budget_usd, 60);
      const runs = runAll(sc, 10);
      for (const r of runs) assert.deepEqual(r.violations, []);
      assert.ok(runs.every((r) => peak(r.world) <= 2), 'never past the work grant\'s cap');
      assert.ok(runs.some((r) => peak(r.world) === 2), 'a merge-only grant does not cap dispatch at its own max_workers');
    });

    it('merge authority comes from the merge grant only; finalize from the work grant', () => {
      for (const r of runAll(normalize(base), 10, { trace: true })) {
        const commits = r.trace.flatMap((l) => l.commits ?? []).filter((c) => c.role === 'orchestrator');
        const by = (t) => [...new Set(commits.filter((c) => c.transition === t).map((c) => c.grant))];
        assert.deepEqual(by('mark-pr-ready'), ['GRANT-1']);
        assert.deepEqual(by('approve-pr'), ['GRANT-2']);
        assert.deepEqual(by('integrate'), ['GRANT-2']);
        assert.equal(r.summary.merged, 5, 'the human promoted the integration branch');
      }
      const noMerge = runAll(normalize({ ...base, grants: [work], merge: { queue_targets: null } }), 5, { trace: true });
      for (const r of noMerge) {
        assert.deepEqual(r.violations, []);
        assert.ok(r.trace.flatMap((l) => l.commits ?? []).filter((c) => c.transition === 'approve-pr').every((c) => c.role === 'owner'), 'without a merge grant the human approves');
      }
    });

    it('no merge grant covers the protected branch: one naming it, or naming another protected branch than the repository\'s, is refused', () => {
    const toMain = grant('GRANT-2', [{ action: 'merge', repo: 'acme/app', target: 'main', protected_branch: 'main', strategy: 'squash', requires: ['independent-review', 'required-checks'] }], { max_workers: 1, budget: { max_usd: 5 } });
    assert.throws(() => simulate(normalize({ ...base, grants: [work, toMain] }), { trace: false }), /merge-target-not-protected/);
    const wrong = grant('GRANT-2', [{ action: 'merge', repo: 'acme/app', target: 'integration/sim', protected_branch: 'trunk', strategy: 'squash', requires: ['independent-review', 'required-checks'] }], { max_workers: 1, budget: { max_usd: 5 } });
    assert.throws(() => simulate(normalize({ ...base, grants: [work, wrong] }), { trace: false }), /names trunk as acme\/app's protected branch; the scenario's is main/);
  });

  it('grant and grants together are a scenario error; so is a grant id twice', () => {
      assert.throws(() => normalize({ ...base, grant: work }), /grant and grants/);
      assert.throws(() => normalize({ ...base, grants: [work, work] }), /GRANT-1 repeats/);
    });
  });

  it('an epic lands on its integration branch under the grant; the human merges the branch; another epic waits for merged', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'integration-branch.yaml')), 10, { trace: true });
    let builtOnIntegrated = 0;
    for (const r of runs) {
      const commits = r.trace.flatMap((l) => (l.commits ?? []).map((c) => ({ ...c, t: l.t })));
      const first = (task, transition) => commits.find((c) => c.task === task && c.transition === transition);
      for (const id of ['RAT-1', 'RAT-2', 'RAT-3']) {
        const integrate = first(id, 'integrate');
        assert.ok(integrate && integrate.role === 'orchestrator' && integrate.grant === 'GRANT-1', `${id} integrated by the orchestrator under GRANT-1`);
        assert.ok(!first(id, 'land'), `${id} never lands on main directly`);
        const promote = first(id, 'promote');
        assert.ok(promote && promote.role === 'owner' && promote.t > integrate.t, `${id} promoted by the human after it integrated`);
      }
      for (const id of ['INV-1', 'INV-2']) assert.equal(first(id, 'land').role, 'merge', `${id} lands on main through the merge queue`);
      assert.ok(first('INV-1', 'claim').t >= first('RAT-1', 'promote').t, 'INV-1 (another epic) waits for RAT-1 to be merged');
      assert.ok(first('RAT-2', 'claim').t >= first('RAT-1', 'integrate').t, 'RAT-2 waits for RAT-1 to be integrated');
      if (first('RAT-2', 'claim').t < first('RAT-1', 'promote').t) builtOnIntegrated += 1;
      const landed = r.trace.flatMap((l) => l.effects ?? []).filter((e) => e.land === 'integrated');
      assert.ok(landed.every((e) => e.target === 'integration/rating'));
      assert.equal(r.summary.merged, 5);
    }
    assert.ok(builtOnIntegrated > 0, 'in some seed RAT-2 builds on RAT-1 while RAT-1 is only integrated');
  });

  it('a review loop that never converges goes to the human after the round limit', () => {
    const runs = runAll(loadScenario(path.join(SCEN, 'evaluator-rejection.yaml')), 10);
    for (const r of runs) {
      assert.equal(r.world.forge.tasks.get('EVR-2').status, 'spec-draft');
      assert.equal(r.world.forge.tasks.get('EVR-1').status, 'merged');
      assert.ok(r.world.forge.prs.get('EVR-2').reviews.filter((x) => x.role === 'evaluator').length <= 5);
    }
  });

  it('a reviewer\'s changes-requested blocks a grant\'s approval even when the evaluator passed that head; a low-risk task still gets a verdict', () => {
    const sc = scenario('integration-branch', { reviewer: { reject_rate: 0.5 } });
    for (const r of runAll(sc, 10)) {
      assert.deepEqual(r.violations, [], 'the correct supervisor fixes what the reviewer found before finalizing');
      for (const [id, pr] of r.world.forge.prs) {
        if (!pr.merged) continue;
        const on = pr.reviews.filter((x) => x.head === pr.merged.head);
        assert.ok(on.some((x) => x.role === 'evaluator' && x.verdict === 'pass'), `${id}: a verdict on the landed head (risk ${r.world.meta.get(id).spec.risk.level})`);
        assert.equal(on.filter((x) => x.role === 'reviewer').at(-1)?.verdict, 'pass', `${id}: the reviewer's last word on the landed head is a pass`);
      }
    }
    const broken = runAll(sc, MUTANT_SEEDS, { policy: orchestrating({ break: ['approve-over-reviewer'] }) });
    const overRuled = broken.filter((r) => r.violations.some((v) => {
      if (v.invariant !== 'guards-hold' || !/approve-pr: guard independent-review/.test(v.message)) return false;
      const pr = r.world.forge.prs.get(v.task);
      const head = pr.merged?.head ?? pr.approval?.head;
      return pr.reviews.some((x) => x.head === head && x.role === 'reviewer' && x.verdict === 'changes-requested') && pr.reviews.some((x) => x.head === head && x.role === 'evaluator' && x.verdict === 'pass');
    }));
    assert.ok(overRuled.length > 0, 'some seed approves a head the evaluator passed and the reviewer rejected, and guards-hold names it');
  });

  it('an evaluator\'s run is logged as the evaluator\'s verdict, never as the author advancing the task', () => {
    const r = simulate(loadScenario(path.join(SCEN, 'evaluator-rejection.yaml')), { seed: 1, trace: false });
    const evals = r.world.artifacts.runRecords.filter((x) => x.role === 'evaluator');
    assert.ok(evals.length >= 2, 'the evaluator ran');
    for (const x of evals) {
      assert.ok(['verdict', 'failed'].includes(x.outcome), `${x.session_id}: ${x.outcome}`);
      if (x.outcome === 'verdict') assert.equal(x.status_after, x.status_before, `${x.session_id} moved nothing`);
    }
    assert.ok(r.world.artifacts.runRecords.filter((x) => x.outcome === 'advanced').every((x) => x.role === 'author'), 'only authors advance');
  });

  it('every run-record, return, grant and task record the simulation writes validates', () => {
    for (const f of fs.readdirSync(SCEN)) {
      const r = simulate(loadScenario(path.join(SCEN, f)), { trace: false });
      assert.ok(r.world.artifacts.runRecords.length > 0, f);
      assert.equal(r.violations.filter((v) => v.invariant === 'contracts-valid').length, 0, f);
    }
    const r = simulate(loadScenario(path.join(SCEN, 'happy-path.yaml')), { trace: false });
    r.world.artifacts.runRecords.push({ task: 'SIM-1', outcome: 'advanced' });
    const c = new Checker({ machines: machines() });
    c.contracts(r.world, { index: 0, at: 0, violations: [] });
    assert.ok(c.violations.some((v) => v.invariant === 'contracts-valid'), 'a broken run-record is caught');
  });
});

// Each broken policy (or broken world binding), the scenario that exercises it, and the invariant(s)
// that must name it. A mutation passes when, across MUTANT_SEEDS seeds, at least one named
// invariant fires.
const MUTANTS = [
  { break: 'advance-on-wake', scenario: 'happy-path', caught: ['signals-never-advance-workflow', 'transitions-allowed'] },
  { break: 'merge-without-grant', scenario: 'merge-without-grant', caught: ['human-gates-by-humans', 'merge-requires-authority'] },
  { break: 'act-on-expired-grant', scenario: 'grant-expiry', caught: ['human-gates-by-humans', 'merge-requires-authority'] },
  { break: 'skip-evaluator', scenario: 'grant-expiry', caught: ['guards-hold', 'merge-requires-authority'] },
  { break: 'overlapping-dispatch', scenario: 'parallel-overlap', caught: ['lanes-disjoint'] },
  { break: 'ignore-budget', scenario: 'budget-exhaustion', caught: ['cap-run', 'cap-spend'] },
  { break: 'auto-approve-ask', scenario: 'unattended-ask', caught: ['asks-surface-to-human'] },
  { break: 'auto-approve-ask', scenario: 'unattended-ask', over: { policy: { tier: 'ask' } }, label: 'auto-approve-ask (prompting tier)', caught: ['asks-surface-to-human'] },
  { break: 'swallow-denials', scenario: 'unattended-ask', caught: ['asks-surface-to-human'] },
  { break: 'ignore-no-progress', scenario: 'wall-bypass', caught: ['no-progress-stops'] },
  { break: 'unbounded-workers', scenario: 'happy-path', caught: ['cap-workers'] },
  { break: 'nested-helpers', scenario: 'happy-path', over: { work: { helper_rate: 1 }, supervisor: { max_workers: 10 } }, caught: ['cap-depth'] },
  { break: 'redispatch-on-unknown', scenario: 'crash-lost-events', over: { faults: { ...raw('crash-lost-events').faults, unknown_signals: { rate: 1 } } }, caught: ['one-owner-per-claimed-task'] },
  { break: 'complete-on-idle', scenario: 'happy-path', caught: ['attention-consistent'] },
  { break: 'status-as-attention', scenario: 'happy-path', caught: ['attention-consistent'] },
  { break: 'wake-ledger', scenario: 'crash-lost-events', caught: ['stalls-surface'], seeds: 20 },
  { break: 'land-directly', scenario: 'grant-expiry', caught: ['merge-requires-authority'] },
  { break: 'cross-epic-integrated', scenario: 'integration-branch', caught: ['guards-hold'], message: /INV-1|claim: guard deps-merged/ },
  { break: 'finalize-unverified', scenario: 'integration-branch', caught: ['guards-hold'], message: /mark-pr-ready: guard independent-verification does not hold$/ },
  { break: 'land-without-grant', scenario: 'integration-branch', over: { merge: { queue_targets: [] } }, caught: ['transitions-allowed', 'merge-requires-authority'], message: /orchestrator/ },
  { break: 'uncounted-readers', scenario: 'happy-path', over: { work: { helper_rate: 1 } }, caught: ['cap-workers'] },
  { break: 'grant-covers-protected', scenario: 'grant-expiry', over: { tasks: [...raw('grant-expiry').tasks, { id: 'GEX-6', size: 'S', touches: ['src/f/**'] }] }, caught: ['human-gates-by-humans', 'transitions-allowed', 'merge-requires-authority'], message: /GEX-6/ },
  { break: 'approve-over-reviewer', scenario: 'integration-branch', over: { reviewer: { reject_rate: 0.5 } }, caught: ['guards-hold', 'merge-requires-authority'], message: /independent-review/ },
  { world: { engine: 'bypass-skips-walls' }, label: 'engine binding: bypass skips walls (disableAllHooks)', scenario: 'wall-bypass', caught: ['walls-block'] },
  { world: { cas: false }, label: 'forge without compare-and-swap', scenario: 'parallel-overlap', caught: ['one-owner-per-claimed-task'] },
  { world: { mergeBot: 'resolve-semantic' }, label: 'merge queue resolves semantic conflicts', scenario: 'grant-expiry', over: { merge: { queue_targets: null } }, caught: ['guards-hold', 'merge-requires-authority'] },
  { world: { forgeProtection: false }, label: 'forge without branch protection', scenario: 'merge-without-grant', caught: ['merge-requires-authority'] },
];

describe('simulate: mutation tests — every broken supervisor is caught by a named invariant', () => {
  it('every mutation in the catalogue has a test', () => {
    for (const m of Object.keys(MUTATIONS)) assert.ok(MUTANTS.some((x) => x.break === m), m);
    for (const x of MUTANTS) for (const inv of x.caught) assert.ok(INVARIANTS[inv], inv);
  });
  for (const x of MUTANTS) {
    const label = x.label ?? x.break;
    it(`${label} on ${x.scenario}: caught by ${x.caught.join(' / ')}`, (t) => {
      const sc = scenario(x.scenario, x.over);
      const runs = runAll(sc, x.seeds ?? MUTANT_SEEDS, { policy: orchestrating({ break: x.break ? [x.break] : [] }), ...(x.world ?? {}) });
      const hits = {};
      for (const v of runs.flatMap((r) => r.violations)) hits[v.invariant] = (hits[v.invariant] ?? 0) + 1;
      const caughtSeeds = runs.filter((r) => r.violations.some((v) => x.caught.includes(v.invariant) && (!x.message || x.message.test(v.message)))).length;
      t.diagnostic(`${label}: caught in ${caughtSeeds}/${runs.length} seeds; ${JSON.stringify(hits)}`);
      assert.ok(caughtSeeds > 0, `not caught: ${JSON.stringify(hits)}`);
    });
  }
});

describe('simulate: determinism, inputs and outputs', () => {
  it('the same seed gives the same trace; another seed a different one', () => {
    const sc = loadScenario(path.join(SCEN, 'crash-lost-events.yaml'));
    const a = JSON.stringify(simulate(sc, { seed: 7 }).trace);
    assert.equal(a, JSON.stringify(simulate(sc, { seed: 7 }).trace));
    assert.notEqual(a, JSON.stringify(simulate(sc, { seed: 8 }).trace));
    const r = makeRng(3);
    assert.deepEqual([r.next(), r.next()], [makeRng(3).next(), (() => { const q = makeRng(3); q.next(); return q.next(); })()]);
  });

  it('writes a JSONL trace whose violations name the event to reproduce from', () => {
    const r = simulate(scenario('happy-path'), { seed: 2, policy: orchestrating({ break: ['unbounded-workers'] }) });
    const files = writeOutputs(r, TMP);
    const lines = fs.readFileSync(files.trace, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, r.summary.events + 1);
    const v = r.violations[0];
    assert.ok(lines[v.index].violations.includes(v.invariant));
    const summary = JSON.parse(fs.readFileSync(files.summary, 'utf8'));
    assert.equal(summary.first_violation.index, v.index);
    assert.equal(summary.first_violation.seed, 2);
    for (const line of fs.readFileSync(files.runRecords, 'utf8').trim().split('\n')) JSON.parse(line);
  });

  it('reads a project\'s queue through the task loaders', () => {
    const dir = path.join(TMP, 'proj');
    const task = (id, status, extra = '') => `---\nid: ${id}\nepic: billing\nstatus: ${status}\npriority: P1\ncuj: CUJ-1\nguiding_docs: []\nbranch: feat/${id.toLowerCase()}\ndepends_on: []\nowner: null\nsize: S\n${extra}---\n\n# ${id} · t\n\n## Context\n\n## Acceptance criteria (EARS)\n- AC-1 — When x, the system shall y.\n- AC-2 — The system shall z.\n\n## Open questions\n\n## Agent log (append-only, newest last)\n`;
    fs.mkdirSync(path.join(dir, 'specs/billing/tasks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'specs/billing/tasks/B-1.md'), task('B-1', 'ready', 'touches: ["src/a/**"]\n'));
    fs.writeFileSync(path.join(dir, 'specs/billing/tasks/B-2.md'), task('B-2', 'ready', 'touches: ["src/a/b.ts"]\n').replace('depends_on: []', 'depends_on: [B-1]'));
    fs.writeFileSync(path.join(dir, 'specs/billing/tasks/B-3.md'), task('B-3', 'spec-draft'));
    const sc = scenarioFromProject(dir);
    assert.deepEqual(sc.tasks.map((t) => [t.id, t.status, t.criteria.length]), [['B-1', 'ready', 2], ['B-2', 'ready', 2], ['B-3', 'spec-draft', 2]]);
    const runs = runAll(sc, 10);
    assert.equal(firstViolation(runs), undefined);
    assert.ok(runs.every((r) => r.summary.merged === 2 && r.world.forge.tasks.get('B-3').status === 'spec-draft'), 'the spec gate stays human');
    const approved = runAll(scenarioFromProject(dir, { assume_approved: true }), 5);
    assert.ok(approved.every((r) => r.summary.merged === 3));
  });

  it('rejects a scenario with unknown keys, unknown tasks or a dependency cycle', () => {
    assert.throws(() => normalize({ tasks: [{ id: 'A-1' }], supervisor: { workers: 2 } }), /supervisor\.workers: unknown key/);
    assert.throws(() => normalize({ tasks: [{ id: 'A-1', depends_on: ['A-2'] }] }), /no task A-2/);
    assert.throws(() => normalize({ tasks: [{ id: 'A-1', depends_on: ['A-2'] }, { id: 'A-2', depends_on: ['A-1'] }] }), /cycle/);
    assert.throws(() => normalize({ tasks: [{ id: 'A-1' }], faults: { meteor: {} } }), /unknown fault/);
  });

  it('decides touch overlap like the lane rule needs', () => {
    assert.ok(globsOverlap('src/billing/**', 'src/billing/invoice.ts'));
    assert.ok(globsOverlap('src/**/rates.ts', 'src/billing/*.ts'));
    assert.ok(globsOverlap('src/billing/*.test.ts', 'src/billing/**'));
    assert.ok(!globsOverlap('src/web/**', 'src/api/**'));
    assert.ok(!globsOverlap('docs/**', 'src/**'));
    assert.ok(!globsOverlap('src/a.ts', 'src/b.ts'));
  });

  it('a grant\'s lifecycle is derived from its dates and revocation, never stored', () => {
    const g = parse(fs.readFileSync(path.join(ROOT, 'fixtures/valid/grant/revoked-narrowed.yaml'), 'utf8'));
    const at = (iso) => grantState(g, Date.parse(iso));
    assert.equal(at('2026-09-30T00:00:00Z'), 'pending');
    assert.equal(at('2026-10-02T00:00:00Z'), 'live');
    assert.equal(at('2026-10-05T00:00:00Z'), 'revoked');
    assert.equal(at('2026-10-09T00:00:00Z'), 'revoked', 'a revocation is what the record says, even after expiry');
    const unrevoked = { ...g, revoked_at: undefined };
    assert.equal(grantState(unrevoked, Date.parse('2026-10-09T00:00:00Z')), 'expired');
    assert.equal(grantState(unrevoked, Date.parse('2026-10-08T08:00:00Z')), 'expired', 'expires_at is exclusive');
    assert.ok(!('status' in reg().schema('grant').properties), 'the contract has no stored status');
  });

  it('a guard the model has no evidence for is an error, never a pass', () => {
    const c = new Checker({ machines: machines() });
    const w = { forge: { tasks: new Map([['A-1', {}]]), prs: new Map() }, meta: new Map([['A-1', { spec: { criteria: [] } }]]) };
    assert.throws(() => c.guardHolds(w, 'moon-in-phase', { task: 'A-1', transition: 'claim' }, { owner: null }), /no evidence model for guard moon-in-phase/);
    assert.equal(c.guardHolds(w, 'epic-approved', { task: 'A-1', transition: 'mark-ready' }, { owner: null }), true, 'a planning guard the simulator does not model is listed, so it holds');
  });

  it('readers count toward the workers cap: the runtime refuses a helper when every slot is taken', () => {
    const runs = runAll(scenario('happy-path', { work: { helper_rate: 1 } }), 10, { trace: true });
    for (const r of runs) assert.deepEqual(r.violations, []);
    assert.ok(runs.some((r) => r.trace.some((l) => (l.effects ?? []).some((e) => e.spawn === 'refused' && e.why === 'workers cap'))), 'a helper was refused at the cap');
    assert.match(INVARIANTS['cap-workers'], /readers/);
  });

  it('the invariants read the state machines: roles, gates and claimed statuses come from the YAML', () => {
    const m = machines();
    assert.equal(m.transitions.get('approve-pr').gate, 'pr-approval');
    assert.deepEqual([...m.claimed].sort(), ['human-review', 'in-progress', 'merging', 'review']);
    assert.equal(m.roleKind.owner, 'human');
    assert.equal(m.roleKind.orchestrator, 'agent');
    assert.deepEqual(m.mergeRequires, ['independent-review', 'required-checks']);
  });
});

describe('simulate CLI', () => {
  const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/simulate.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });

  it('runs a scenario to a trace and exits 0; a broken policy exits 1 with a reproduce line', () => {
    const out = path.join(TMP, 'cli');
    const ok = cli('fixtures/scenarios/happy-path.yaml', '--out', out);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /^PASS happy-path seed 1: 5\/5 merged/m);
    assert.ok(fs.existsSync(path.join(out, 'happy-path-seed1.jsonl')));
    const bad = cli('fixtures/scenarios/unattended-ask.yaml', '--break', 'auto-approve-ask', '--seeds', '1..3', '--no-trace');
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /asks-surface-to-human @ event \d+/);
    assert.match(bad.stdout, /reproduce: node tools\/simulate\.mjs fixtures\/scenarios\/unattended-ask\.yaml --seed \d+ --break auto-approve-ask/);
  });

  it('--supervisor runs a runtime\'s own supervisor module against the invariants', () => {
    const dir = path.join(TMP, 'supervisors');
    fs.mkdirSync(dir, { recursive: true });
    const policies = path.join(ROOT, 'tools/lib/sim/policies.mjs');
    fs.writeFileSync(path.join(dir, 'ok.mjs'), `import { orchestrating } from ${JSON.stringify(policies)};\nexport default orchestrating();\n`);
    fs.writeFileSync(path.join(dir, 'greedy.mjs'), `import { orchestrating } from ${JSON.stringify(policies)};\nconst inner = orchestrating({ break: ['unbounded-workers'] });\nexport default (ctx) => ({ ...inner(ctx), name: 'greedy' });\n`);
    fs.writeFileSync(path.join(dir, 'empty.mjs'), 'export const nothing = 1;\n');
    const ok = cli('fixtures/scenarios/happy-path.yaml', '--supervisor', path.join(dir, 'ok.mjs'), '--seeds', '1..3', '--no-trace');
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const bad = cli('fixtures/scenarios/happy-path.yaml', '--supervisor', path.join(dir, 'greedy.mjs'), '--seeds', '1..3', '--no-trace');
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout, /cap-workers @ event \d+/);
    assert.match(bad.stdout, /reproduce: .* --supervisor .*greedy\.mjs/);
    assert.equal(cli('fixtures/scenarios/happy-path.yaml', '--supervisor', path.join(dir, 'empty.mjs')).status, 2);
    assert.equal(cli('fixtures/scenarios/happy-path.yaml', '--supervisor', path.join(dir, 'ok.mjs'), '--break', 'unbounded-workers').status, 2);
  });

  it('--list names every invariant and mutation; usage errors exit 2', () => {
    const l = cli('--list');
    assert.equal(l.status, 0);
    for (const k of [...Object.keys(INVARIANTS), ...Object.keys(MUTATIONS)]) assert.match(l.stdout, new RegExp(`^ {2}${k} `, 'm'));
    assert.equal(cli('fixtures/scenarios/happy-path.yaml', '--break', 'nope').status, 2);
    assert.equal(cli('nope.yaml').status, 2);
    assert.equal(cli('fixtures/scenarios/happy-path.yaml', '--seeds', '9..1').status, 2);
  });
});
