#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { exitCodeOf, EXIT, refusePreconditions, refuseRunner, runEngine } from './lib/run.mjs';

const USAGE = `Launch an engine under its compiled runner.json (promptbook compile-policy --out <dir>).

  promptbook run --runner <runner.json> [--report <file>] [--grace <s>] -- <engine command...>
      --runner <file>   the runner.json the compile wrote for this profile and engine
      --report <file>   write the run's report: exit, what stopped it, turns, cost or tokens seen
      --grace <s>       seconds between SIGTERM and SIGKILL when a cap stops the run (default 10)

The runner's args (mode, allowlist, the engine's own cap flags) are appended to the command. The
caps the runner marks enforcement: promptbook-run are enforced here: timeout_seconds on every engine
(a hard kill of the run's process group), max_turns on codex (tool actions counted from
codex exec --json); claude's reported cost and turns are checked against the caps after the run.
An unattended runner without its caps is refused, and so is a run whose profile names requires
until every probe passes (promptbook check-requires; a bypass-tier runner that names none is refused
outright). adapters/<engine>/README.md says what each engine enforces itself and what nobody
enforces.

Exit: the engine's code; 124 stopped at the timeout; 125 stopped at, or reported past, a cap;
1 refused to start; 2 usage error.`;

export async function main(argv = process.argv.slice(2)) {
  const sep = argv.indexOf('--');
  const opts = sep === -1 ? argv : argv.slice(0, sep);
  const command = sep === -1 ? [] : argv.slice(sep + 1);
  if (opts.includes('--help') || opts.includes('-h')) { console.log(USAGE); return 0; }
  const value = (n) => { const i = opts.indexOf(n); return i === -1 ? undefined : opts[i + 1]; };
  const usage = (msg) => { console.error(`promptbook run: ${msg}\n\n${USAGE}`); return 2; };
  const runnerPath = value('--runner');
  if (!runnerPath || !fs.existsSync(runnerPath)) return usage(`give an existing --runner file (got ${runnerPath ?? 'nothing'})`);
  if (!command.length) return usage('give the engine command after --');
  const grace = value('--grace') === undefined ? 10 : Number(value('--grace'));
  if (!(grace >= 0)) return usage('--grace takes a number of seconds');

  let runner;
  try {
    runner = JSON.parse(fs.readFileSync(runnerPath, 'utf8'));
  } catch (e) {
    console.error(`promptbook run: refused: ${runnerPath} is not JSON (${e.message})`);
    return EXIT.refused;
  }
  const refusal = refuseRunner(runner) ?? (await refusePreconditions(runner));
  if (refusal) {
    console.error(`promptbook run: refused: ${runnerPath}: ${refusal}`);
    return EXIT.refused;
  }
  let report;
  try {
    report = await runEngine(runner, command, { graceSeconds: grace, log: (m) => console.error(`promptbook run: ${m}`) });
  } catch (e) {
    console.error(`promptbook run: refused: could not start ${command[0]}: ${e.message}`);
    return EXIT.refused;
  }
  const out = value('--report');
  if (out) fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  const code = exitCodeOf(report);
  console.error(`promptbook run: ${runner.engine} (profile ${runner.profile}, tier ${runner.tier}${runner.role ? `, role ${runner.role}` : ''}) exited ${report.exit_code ?? report.signal}${report.stopped_by ? `; stopped by promptbook run at ${report.stopped_by}` : ''} -> ${code}`);
  return code;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
