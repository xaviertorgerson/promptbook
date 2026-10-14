import { spawn } from 'node:child_process';
import process from 'node:process';
import { ENGINES, ENFORCES, GENERATOR } from './compile-policy.mjs';
import { preconditionFailures } from './requires.mjs';

// harness run: launch one engine command under a compiled runner.json. It appends the runner's args
// (the engine's own flags: mode, allowlist, the caps it enforces itself) and enforces the caps the
// runner says are its own (`enforcement: harness-run`):
//
//   timeout_seconds  every engine: SIGTERM to the run's process group at the deadline, SIGKILL after
//                    the grace period; exit 124
//   max_turns        codex: counts tool actions (item.started of a command, file change, MCP call or
//                    web search) in the `codex exec --json` stream and stops the run as one more
//                    starts; exit 125
//   after the run    claude: a result line's num_turns and total_cost_usd against max_turns and
//                    max_budget_usd (the flags stop the run; spend can overshoot by one response);
//                    exit 125 on a breach. gemini: exit 53 is its own turn limit, reported as such.
//
// What nobody enforces is the runner's `enforcement: none` (codex and gemini report no cost), which
// the compile reports as spend-unmetered and bounds by the timeout it then requires.

export const EXIT = { timeout: 124, cap: 125, refused: 1 };
const CODEX_ACTIONS = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'web_search']);
const GEMINI_TURN_LIMIT = 53;

// Why a runner.json may not start a run, or null. The checks repeat what the compile guarantees, so
// a hand-edited runner fails closed.
export function refuseRunner(runner) {
  if (!runner || runner.generated_by !== GENERATOR) return `not a compiled runner.json (generated_by is not "${GENERATOR}")`;
  if (!ENGINES.includes(runner.engine)) return `unknown engine ${runner.engine}`;
  if (!Array.isArray(runner.args)) return 'args is not a list';
  const caps = runner.caps;
  if (!caps || typeof caps !== 'object') return 'no caps';
  if (runner.tier === 'unattended') {
    const missing = ['max_turns', 'max_budget_usd'].filter((k) => !(caps[k] > 0));
    if (missing.length) return `an unattended run has turn and spend caps (HAR-3); caps lack ${missing.join(', ')}`;
    if (ENFORCES[runner.engine].max_budget_usd === 'none' && !(caps.timeout_seconds > 0)) return `${runner.engine} meters no spend, so an unattended run needs caps.timeout_seconds for a hard kill`;
  }
  return null;
}

const killGroup = (child, signal) => {
  try {
    process.kill(-child.pid, signal);
  } catch (e) {
    if (e.code !== 'ESRCH') throw e; // already gone
  }
};

// The runner's named preconditions, probed on this host (harness check-requires): a bypass run, or
// any run whose profile names requires, starts only when every probe passes (HAR-4).
export async function refusePreconditions(runner, env) {
  const failures = await preconditionFailures(runner, env);
  return failures.length ? `the profile's preconditions do not hold here: ${failures.join('; ')}` : null;
}

// Run `command` (argv) under `runner`. Resolves to the run's report; `log` receives one-line notes.
export function runEngine(runner, command, { graceSeconds = 10, log = () => {}, stdout = process.stdout } = {}) {
  const argv = [...command, ...runner.args];
  const caps = runner.caps;
  const report = { engine: runner.engine, profile: runner.profile, tier: runner.tier, role: runner.role ?? null, argv, caps, enforcement: runner.enforcement, exit_code: null, signal: null, stopped_by: null, stopped_by_engine: null, turns: runner.engine === 'codex' ? 0 : null, cost_usd: null, usage: null, duration_ms: 0 };
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: ['inherit', 'pipe', 'inherit'], detached: true });
    let stopping = false;
    const stop = (why, detail) => {
      if (stopping) return;
      stopping = true;
      report.stopped_by = why;
      log(`stopped ${runner.engine} at ${why} ${detail}`);
      killGroup(child, 'SIGTERM');
      setTimeout(() => killGroup(child, 'SIGKILL'), graceSeconds * 1000).unref();
    };
    const timer = caps.timeout_seconds > 0 ? setTimeout(() => stop('timeout_seconds', caps.timeout_seconds), caps.timeout_seconds * 1000) : null;
    const forward = (sig) => killGroup(child, sig);
    process.on('SIGINT', forward).on('SIGTERM', forward);

    let actions = 0;
    let pending = '';
    const onLine = (text) => {
      if (!text.startsWith('{')) return;
      let ev;
      try {
        ev = JSON.parse(text);
      } catch {
        return; // a line of engine output that only looks like JSON: not an event
      }
      if (runner.engine === 'codex') {
        if (ev.type === 'item.started' && CODEX_ACTIONS.has(ev.item?.type)) {
          actions += 1;
          report.turns = actions;
          if (caps.max_turns > 0 && actions > caps.max_turns) stop('max_turns', `${caps.max_turns} (a tool action counted from codex exec --json)`);
        }
        if (ev.type === 'turn.completed' && ev.usage) {
          report.usage = { input_tokens: (report.usage?.input_tokens ?? 0) + (ev.usage.input_tokens ?? 0), output_tokens: (report.usage?.output_tokens ?? 0) + (ev.usage.output_tokens ?? 0) };
        }
      }
      if (runner.engine === 'claude' && ev.type === 'result') {
        report.turns = ev.num_turns ?? null;
        report.cost_usd = ev.total_cost_usd ?? null;
      }
    };
    child.stdout.on('data', (chunk) => {
      stdout.write(chunk);
      pending += chunk.toString('utf8');
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const l of lines) onLine(l.trim());
    });
    child.on('error', (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      process.off('SIGINT', forward).off('SIGTERM', forward);
      if (pending.trim()) onLine(pending.trim());
      report.exit_code = code;
      report.signal = signal;
      report.duration_ms = Date.now() - started;
      if (!report.stopped_by && runner.engine === 'claude') {
        if (caps.max_budget_usd > 0 && report.cost_usd > caps.max_budget_usd) report.stopped_by = 'max_budget_usd';
        else if (caps.max_turns > 0 && report.turns > caps.max_turns) report.stopped_by = 'max_turns';
        if (report.stopped_by) log(`claude reported ${report.stopped_by === 'max_budget_usd' ? `$${report.cost_usd}` : `${report.turns} turns`} over its cap ${caps[report.stopped_by]}`);
      }
      if (runner.engine === 'gemini' && code === GEMINI_TURN_LIMIT) {
        report.stopped_by_engine = 'max_turns';
        log(`gemini stopped itself at its turn limit (model.maxSessionTurns ${caps.max_turns})`);
      }
      resolve(report);
    });
  });
}

export function exitCodeOf(report) {
  if (report.stopped_by === 'timeout_seconds') return EXIT.timeout;
  if (report.stopped_by) return EXIT.cap;
  if (report.exit_code !== null) return report.exit_code;
  return 128 + (report.signal ? ({ SIGHUP: 1, SIGINT: 2, SIGKILL: 9, SIGTERM: 15 }[report.signal] ?? 0) : 0);
}
