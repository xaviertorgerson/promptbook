#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildPrompt, evaluate, loadSkills, routingResults, runner } from './lib/eval-routing.mjs';
import { loadSets, SETS_FILE, setSkills } from './lib/lint-skills.mjs';

const USAGE = `Routing evals: does each skill's description route its routing.jsonl prompts?

  node tools/eval-routing.mjs [dir]...                  dry run (default): print the case count and
                                                        one router prompt; nothing is sent
  node tools/eval-routing.mjs --runner "<cmd>" [dir]... run every case through <cmd>, which reads the
                                                        prompt on stdin and prints the skill name(s)
      --skill <name>       only that skill's cases
      --set <name>         install only that set (skills/SETS.yaml) of a folder that has a SETS.yaml;
                           other folders (a pinned library) stay installed whole
      --cases <file>       read each skill's cases from evals/<file> (default routing.jsonl; the
                           held-out cases are heldout.routing.jsonl)
      --limit <n>          at most n cases
      --runs <k>           ask k times per case; a case passes only when all k pass (pass^k; default 1)
      --model <label>      the model the runner calls, recorded in --out (default: the runner command)
      --out <file.jsonl>   write one routing result per case (evidence contract, routingResult);
                           name it routing-results*.jsonl so promptbook validate knows it
      --print-prompts      print every router prompt (dry run)
      --timeout <s>        per call (default 120)
      --json               machine-readable

The router sees only the installed skills' names and descriptions and the message, as an engine's
skill loader would. A trigger case passes when its skill is named; a no-trigger case when it is not,
and a near-miss also needs its route_to named when that skill is installed. Default dir: skills.
Exit 0 all pass (or dry run), 1 a case failed, 2 usage error.`;

const pct = (x) => (x === null ? '  —  ' : `${(x * 100).toFixed(0).padStart(3)}%`);

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--runner', '--skill', '--limit', '--timeout', '--runs', '--model', '--out', '--set', '--cases']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const usage = (m) => { console.error(`eval-routing: ${m}\n\n${USAGE}`); return 2; };
  const dirs = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const targets = dirs.length ? dirs : ['skills'];
  for (const d of targets) if (!fs.existsSync(d)) return usage(`no such directory: ${d}`);
  const command = value('--runner');
  if (argv.includes('--runner') && !command) return usage('--runner needs a command');
  const dryRun = !command || argv.includes('--dry-run');
  const limit = value('--limit') ? Number(value('--limit')) : Infinity;
  if (!(limit > 0)) return usage('--limit takes a positive number');
  const timeout = Number(value('--timeout') ?? 120) * 1000;
  const runs = Number(value('--runs') ?? 1);
  if (!(Number.isInteger(runs) && runs >= 1)) return usage('--runs takes a whole number of at least 1');
  const out = value('--out');
  if (argv.includes('--out') && !out) return usage('--out needs a file');
  if (out && dryRun) return usage('--out needs --runner: a dry run has no results');

  let skills = loadSkills(targets, { cases: value('--cases') ?? 'routing.jsonl' });
  const setName = value('--set');
  if (setName) {
    const setsDir = targets.find((d) => fs.existsSync(path.join(d, SETS_FILE)));
    if (!setsDir) return usage(`--set ${setName}: no ${SETS_FILE} in ${targets.join(', ')}`);
    const { data, errors } = loadSets(path.join(setsDir, SETS_FILE));
    if (!data) return usage(`${SETS_FILE}: ${errors.join('; ')}`);
    if (!data.sets[setName]) return usage(`no set ${setName} (sets: ${Object.keys(data.sets).join(', ')})`);
    const keep = setSkills(data, setName);
    const root = path.resolve(setsDir);
    skills = skills.filter((s) => path.dirname(path.resolve(s.dir)) !== root || keep.has(s.name));
  }
  const only = value('--skill');
  if (only && !skills.some((s) => s.name === only)) return usage(`no skill named ${only}`);
  const result = evaluate(skills, { ask: dryRun ? null : runner(command, { timeout }), dryRun, only, limit, runs });
  if (out) {
    const lines = routingResults(result, { model: value('--model') ?? command, versions: Object.fromEntries(skills.filter((s) => s.version).map((s) => [s.name, s.version])) });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...result, cases: result.cases.map(({ routerPrompt, ...c }) => (argv.includes('--print-prompts') ? { ...c, routerPrompt } : c)) }, null, 2));
    return result.totals.failed ? 1 : 0;
  }
  if (dryRun) {
    const per = {};
    for (const c of result.cases) per[c.skill] = (per[c.skill] ?? 0) + 1;
    for (const s of skills) console.log(`${s.name.padEnd(28)} ${String(per[s.name] ?? 0).padStart(3)} case(s)${s.deprecated ? ' (deprecated: not shown to the router)' : ''}`);
    if (argv.includes('--print-prompts')) for (const c of result.cases) console.log(`\n--- ${c.skill}:${c.line} expect ${c.expect}${c.route_to ? ` → ${c.route_to}` : ''}\n${c.routerPrompt}`);
    else if (result.cases.length) console.log(`\n--- router prompt for ${result.cases[0].skill}:${result.cases[0].line} (--print-prompts shows all)\n${buildPrompt(skills, result.cases[0].prompt)}`);
    console.log(`\neval-routing: ${result.totals.cases} case(s) across ${skills.length} skill(s); dry run, nothing was sent. Pass --runner "<cmd>" to run them.`);
    return 0;
  }
  for (const c of result.cases) {
    if (c.pass) continue;
    const want = c.expect === 'trigger' ? c.skill : c.route_to && c.route_to !== 'none' ? `not ${c.skill}; ${c.route_to}` : `not ${c.skill}`;
    console.log(`FAIL ${c.skill}:${c.line} "${c.prompt ?? ''}" → expected ${want}, got ${c.error ? `error: ${c.error}` : c.picked.length ? c.picked.join(', ') : 'none'}`);
  }
  console.log(`\n${'skill'.padEnd(28)} precision recall   tp  fp  fn`);
  for (const [name, m] of Object.entries(result.perSkill)) console.log(`${name.padEnd(28)} ${pct(m.precision)}     ${pct(m.recall)}  ${String(m.tp).padStart(3)} ${String(m.fp).padStart(3)} ${String(m.fn).padStart(3)}`);
  const t = result.totals;
  console.log(`\neval-routing: ${t.passed}/${t.run} case(s) pass${runs > 1 ? ` all ${runs} runs (pass^${runs})` : ''} (runner: ${command}).${out ? ` Results: ${out}` : ''}`);
  return t.failed ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
