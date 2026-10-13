#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';
import { INVARIANTS } from './lib/sim/invariants.mjs';
import { MUTATIONS, orchestrating } from './lib/sim/policies.mjs';
import { loadScenario, scenarioFromProject } from './lib/sim/scenario.mjs';
import { simulate, writeOutputs } from './lib/sim/simulate.mjs';
import { ENGINES } from './lib/sim/world.mjs';

const USAGE = `Simulate the runtime contracts: a seeded, deterministic discrete-event run of a supervisor,
authors, an evaluator, CI, a merge queue, a forge with compare-and-swap pushes and a human, with
faults, checking every invariant after every event.

  node tools/simulate.mjs <scenario.yaml>                 run a scenario (fixtures/scenarios/*.yaml)
  node tools/simulate.mjs --project <root> [--config c.yaml]  run a project's specs/<epic>/tasks queue
      --seed <n>            one seed (default: the scenario's)
      --seeds <a..b>|<n>    a range of seeds, e.g. 1..50 or 50; the summary aggregates them
      --break <mutation>    run a deliberately broken supervisor policy (repeatable); --list shows them
      --engine <binding>    the engine's permission binding: ${Object.keys(ENGINES).join(', ')}
      --out <dir>           where traces go (default .sim-out/); --no-trace writes none
      --json                print the summary as JSON
      --list                list the invariants and the mutations

Writes <out>/<scenario>-seed<n>.jsonl (one event per line), .summary.json, .run-records.jsonl and
.task-records.json. Exit 0 no invariant violated, 1 a violation (its seed and event index are
printed to reproduce it), 2 usage error.`;

function seedsOf(spec, fallback) {
  if (!spec) return [fallback];
  const m = String(spec).match(/^(\d+)(?:\.\.(\d+))?$/);
  if (!m) return null;
  if (m[2] === undefined) return Array.from({ length: Number(m[1]) }, (_, i) => i + 1);
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a <= b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : null;
}

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--seed', '--seeds', '--break', '--engine', '--out', '--project', '--config']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  const values = (n) => argv.flatMap((a, i) => (argv[i - 1] === n ? [a] : []));
  const usage = (m) => { console.error(`simulate: ${m}\n\n${USAGE}`); return 2; };
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  if (argv.includes('--list')) {
    console.log('Invariants (checked after every event):');
    for (const [k, v] of Object.entries(INVARIANTS)) console.log(`  ${k.padEnd(32)} ${v}`);
    console.log('\nMutations (--break), each a broken supervisor policy:');
    for (const [k, v] of Object.entries(MUTATIONS)) console.log(`  ${k.padEnd(32)} ${v}`);
    return 0;
  }
  const [file] = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const project = value('--project');
  let sc;
  try {
    if (project) {
      const cfg = value('--config') ? parse(fs.readFileSync(value('--config'), 'utf8')) ?? {} : {};
      sc = scenarioFromProject(project, cfg);
    } else {
      if (!file) return usage('give a scenario file or --project <root>');
      if (!fs.existsSync(file)) return usage(`no such scenario: ${file}`);
      sc = loadScenario(file);
    }
  } catch (e) {
    console.error(`simulate: ${e.message}`);
    return 2;
  }
  const breaks = values('--break');
  for (const b of breaks) if (!MUTATIONS[b]) return usage(`unknown mutation ${b} (known: ${Object.keys(MUTATIONS).join(', ')})`);
  const engine = value('--engine') ?? 'correct';
  if (!ENGINES[engine]) return usage(`unknown engine binding ${engine}`);
  const seeds = value('--seeds') ? seedsOf(value('--seeds')) : seedsOf(value('--seed'), sc.seed);
  if (!seeds) return usage('--seed takes a number, --seeds a count or a range a..b');
  const out = value('--out') ?? '.sim-out';
  const writeTrace = !argv.includes('--no-trace');

  const summaries = [];
  const violations = [];
  for (const seed of seeds) {
    const r = simulate(sc, { seed, policy: orchestrating({ break: breaks }), engine, trace: writeTrace });
    if (writeTrace) r.files = writeOutputs(r, out);
    summaries.push(r.summary);
    violations.push(...r.violations);
    if (!argv.includes('--json')) {
      const s = r.summary;
      console.log(`${s.violations ? 'FAIL' : 'PASS'} ${s.scenario} seed ${seed}: ${s.merged}/${s.tasks} merged, ${s.parked} parked, ${s.needs_human} needs-human, $${s.spend_usd}, ${s.events} events${s.makespan_minutes ? `, makespan ${(s.makespan_minutes / 60).toFixed(1)}h` : ''}${writeTrace ? ` — ${path.relative(process.cwd(), r.files.trace)}` : ''}`);
      for (const v of r.violations.slice(0, 5)) console.log(`  ${v.invariant} @ event ${v.index} (${v.at})${v.task ? ` ${v.task}` : ''}: ${v.message}\n    reproduce: node tools/simulate.mjs ${project ? `--project ${project}` : file} --seed ${seed}${breaks.map((b) => ` --break ${b}`).join('')}${engine !== 'correct' ? ` --engine ${engine}` : ''}`);
      if (r.violations.length > 5) console.log(`  … ${r.violations.length - 5} more in ${writeTrace ? path.relative(process.cwd(), r.files.summary) : 'the summary'}`);
    }
  }
  const agg = {
    scenario: sc.name,
    policy: summaries[0].policy,
    seeds: seeds.length,
    seeds_failed: summaries.filter((s) => s.violations).length,
    merged_mean: summaries.reduce((a, s) => a + s.merged, 0) / seeds.length,
    tasks: summaries[0].tasks,
    needs_human_mean: summaries.reduce((a, s) => a + s.needs_human, 0) / seeds.length,
    spend_mean_usd: Math.round((summaries.reduce((a, s) => a + s.spend_usd, 0) / seeds.length) * 100) / 100,
    violations: violations.length,
    violations_by_invariant: violations.reduce((a, v) => ({ ...a, [v.invariant]: (a[v.invariant] ?? 0) + 1 }), {}),
    first_violation: violations[0] ?? null,
  };
  if (argv.includes('--json')) console.log(JSON.stringify(seeds.length === 1 ? summaries[0] : { ...agg, runs: summaries }, null, 2));
  else if (seeds.length > 1) console.log(`${agg.violations ? 'FAIL' : 'PASS'} ${agg.scenario}: ${seeds.length} seeds, ${agg.seeds_failed} with violations; mean ${agg.merged_mean.toFixed(2)}/${agg.tasks} merged, ${agg.needs_human_mean.toFixed(2)} needs-human, $${agg.spend_mean_usd}${agg.violations ? `; ${JSON.stringify(agg.violations_by_invariant)}` : ''}`);
  return violations.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
