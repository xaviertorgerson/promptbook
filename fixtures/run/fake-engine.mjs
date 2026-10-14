#!/usr/bin/env node
// A stand-in engine for tests/run.test.mjs: `fake-engine.mjs <mode> [n] [x] -- <args the runner appends>`.
//   args          print the argv it was given (after the mode) as one JSON line, exit 0
//   sleep         sleep 30 s (a run that only a timeout ends)
//   codex <n>     print n codex exec --json tool actions, 50 ms apart, then a completed turn
//   claude <t> <usd>  print a claude -p --output-format json result with num_turns t and total_cost_usd usd
//   exit <n>      exit n
const [mode, a, b] = process.argv.slice(2);
const line = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (mode === 'args') line({ argv: process.argv.slice(3) });
else if (mode === 'sleep') await sleep(30_000);
else if (mode === 'codex') {
  line({ type: 'thread.started', thread_id: 't1' });
  line({ type: 'turn.started' });
  for (let i = 1; i <= Number(a); i += 1) {
    line({ type: 'item.started', item: { id: `item_${i}`, type: 'command_execution', command: 'ls', status: 'in_progress' } });
    line({ type: 'item.completed', item: { id: `item_${i}`, type: 'command_execution', command: 'ls', status: 'completed' } });
    await sleep(50);
  }
  line({ type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 } });
} else if (mode === 'claude') line({ type: 'result', subtype: 'success', num_turns: Number(a), total_cost_usd: Number(b), session_id: 's1' });
else if (mode === 'exit') process.exit(Number(a));
else {
  process.stderr.write(`fake-engine: unknown mode ${mode}\n`);
  process.exit(2);
}
