import fs from 'node:fs';
import path from 'node:path';
import { validateData } from '../validate.mjs';
import { Checker, exportTaskRecords } from './invariants.mjs';
import { loadMachines } from './machines.mjs';
import { orchestrating } from './policies.mjs';
import { round } from './util.mjs';
import { World } from './world.mjs';

// One deterministic simulation: a scenario, a seed, a supervisor policy (optionally a rival runtime's
// own), an engine binding and forge settings. Returns the trace, the summary and the violations.

let machinesCache;
export function machines() {
  machinesCache ??= loadMachines();
  return machinesCache;
}

export function simulate(sc, { seed = sc.seed, policy = orchestrating(), rivalPolicy = null, engine = 'correct', forgeProtection = true, cas = true, mergeBot = 'correct', trace = true, only = null } = {}) {
  const m = machines();
  for (const g of sc.grants) {
    const errors = validateData('grant', g);
    if (errors.length) throw new Error(`${sc.source}: grant ${g.id ?? '?'} is not a valid grant: ${errors.join('; ')}`);
    for (const a of g.actions.filter((x) => x?.action === 'merge')) {
      if (a.protected_branch !== sc.target) throw new Error(`${sc.source}: grant ${g.id} names ${a.protected_branch} as ${a.repo}'s protected branch; the scenario's is ${sc.target}`);
    }
  }
  const world = new World(sc, { seed, machines: m, policies: { main: policy, rival: rivalPolicy ?? policy }, engine, forgeProtection, cas, mergeBot, trace });
  const checker = new Checker({ machines: m, only });
  world.run(checker);
  return { world, trace: world.trace, summary: summarize(world, checker), violations: checker.violations };
}

export function summarize(w, checker) {
  const tasks = [...w.forge.tasks.values()];
  const by = (s) => tasks.filter((t) => t.status === s).length;
  const merged = tasks.filter((t) => t.status === 'merged');
  const mergeTimes = merged.map((t) => t.changedAt);
  const makespan = mergeTimes.length ? Math.max(...mergeTimes) : null;
  const spend = [...w.runtimes.values()].reduce((a, rt) => a + rt.spend.total, 0);
  const statuses = {};
  for (const t of tasks) statuses[t.status] = (statuses[t.status] ?? 0) + 1;
  const counts = {};
  for (const v of checker.violations) counts[v.invariant] = (counts[v.invariant] ?? 0) + 1;
  return {
    scenario: w.sc.name,
    seed: w.seed,
    policy: w.runtimes.get('main').policy.name,
    tier: w.sc.policy.tier,
    events: w.index,
    horizon_reached: Boolean(w.cut),
    simulated_minutes: round(w.t, 2),
    tasks: tasks.length,
    merged: merged.length,
    parked: by('suspended') + by('spec-draft') + by('needs-input') + by('blocked'),
    statuses,
    makespan_minutes: makespan === null ? null : round(makespan, 2),
    throughput_per_day: makespan ? round(merged.length / (makespan / 1440), 3) : null,
    needs_human: w.stats.needsHuman,
    human_actions: w.stats.humanActions,
    spend_usd: round(spend, 2),
    runs: w.artifacts.runRecords.length,
    stats: { ...w.stats },
    violations: checker.violations.length,
    violations_by_invariant: counts,
    first_violation: checker.violations[0] ? { invariant: checker.violations[0].invariant, seed: w.seed, index: checker.violations[0].index, message: checker.violations[0].message } : null,
  };
}

export function writeOutputs(result, outDir, { name = `${result.summary.scenario}-seed${result.summary.seed}` } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, name);
  fs.writeFileSync(`${base}.jsonl`, `${result.trace.map((l) => JSON.stringify(l)).join('\n')}\n`);
  fs.writeFileSync(`${base}.summary.json`, `${JSON.stringify({ ...result.summary, violation_list: result.violations }, null, 2)}\n`);
  const w = result.world;
  fs.writeFileSync(`${base}.run-records.jsonl`, `${w.artifacts.runRecords.map((l) => JSON.stringify(l)).join('\n')}\n`);
  fs.writeFileSync(`${base}.task-records.json`, `${JSON.stringify(exportTaskRecords(w), null, 2)}\n`);
  return { trace: `${base}.jsonl`, summary: `${base}.summary.json`, runRecords: `${base}.run-records.jsonl`, taskRecords: `${base}.task-records.json` };
}
