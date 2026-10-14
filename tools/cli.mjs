#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// `harness <command>`: one entry point for the tools. Each command is its own script, run in a child
// process with the same arguments, so every tool keeps its own usage, flags and exit codes.

const DIR = path.dirname(fileURLToPath(import.meta.url));

export const COMMANDS = {
  validate: { script: 'validate.mjs', about: 'validate artifacts against their contracts' },
  trace: { script: 'validate.mjs', prefix: ['--trace'], about: 'check the trace graph of a project (validate --trace)' },
  lint: { script: 'lint-skills.mjs', about: 'lint skills against the authoring rules' },
  simulate: { script: 'simulate.mjs', about: 'simulate the runtime contracts under faults' },
  'compile-policy': { script: 'compile-policy.mjs', about: 'compile agent-policy.yaml into an engine\'s settings' },
  run: { script: 'run.mjs', about: 'launch an engine under its compiled runner.json and its caps' },
  'check-requires': { script: 'check-requires.mjs', about: 'probe this host for a profile\'s requires' },
  lock: { script: 'lock.mjs', about: 'pin or verify toolkit.lock' },
  grant: { script: 'grant.mjs', about: 'verify a grant: provenance, owners, narrowing (grant verify)' },
  'eval-routing': { script: 'eval-routing.mjs', about: 'run routing evals through a model command' },
  'import-evals': { script: 'import-evals.mjs', about: 'convert an agentic-template evals.md into the eval files' },
};

const USAGE = `harness — the contracts' tools (Layer 3).

  harness <command> [args]      harness <command> --help for a command's own usage

${Object.entries(COMMANDS).map(([k, v]) => `  ${k.padEnd(16)} ${v.about}`).join('\n')}

Every command exits 0 on success, 1 when a check fails, 2 on a usage error.`;

export function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(USAGE);
    return cmd ? 0 : 2;
  }
  const c = COMMANDS[cmd];
  if (!c) {
    console.error(`harness: unknown command "${cmd}"\n\n${USAGE}`);
    return 2;
  }
  const r = spawnSync(process.execPath, [path.join(DIR, c.script), ...(c.prefix ?? []), ...rest], { stdio: 'inherit' });
  if (r.error) {
    console.error(`harness: ${r.error.message}`);
    return 2;
  }
  return r.status ?? 1;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
