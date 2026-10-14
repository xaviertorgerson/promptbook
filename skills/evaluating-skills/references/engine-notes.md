# Engine notes: calling a model non-interactively for routing evals

The procedure is engine-neutral. The harness adapters own the exact flags; these notes say where to
look and what to check. Re-verify against the adapter before relying on a flag.

## Claude Code

A headless call with a cheap model, the router prompt on stdin, text output, no tools. agentic-template's
`scripts/skill-evals.mjs` runs one call per case on the cheapest model and its workflow runs it on
every push touching skills, once a repository variable enables it. Unattended runs pin a no-prompt
permission mode with an allowlist (adapter: `adapters/claude`).

Measured on 2026-10-13 (version 2.1.296), the original 28 descriptions on the same cases: inside a
hosted session the CLI inherits that session's reminders (account email, commit attribution, the
host's notes on saving skills) and an effort override, and the cheap router passed 84%; with the
environment reduced it passed 94%; started from an empty directory instead of the repository, whose
git status and recent commits the environment block otherwise carries (they tipped criteria
questions toward code review), 98%. The runner behind skills/ROUTING-RESULTS.md therefore starts the
CLI in an empty directory with an environment reduced to PATH, HOME, the proxy and CA variables and
the authentication variables, and the flags `-p --model haiku --effort low --output-format json
--tools "" --no-session-persistence --strict-mcp-config --safe-mode --disable-slash-commands
--no-chrome`, with the router prompt's instructions and catalog as `--system-prompt` (cached across
cases) and the fenced message as the user turn. About $0.0001 per case.

### The runner, verbatim (router.mjs)

Every routing run in skills/ROUTING-RESULTS.md and every `measured` routing entry in a skill's
evals/evidence.md used this file. Save it outside any repository; it creates `emptycwd/` beside
itself and starts every call there.

```js
#!/usr/bin/env node
// Router runner for `harness eval-routing --runner`: reads the router prompt on stdin, prints the
// model's one-line answer. The prompt's fixed head (instructions + skill catalog) goes in the system
// prompt so it is cached across cases; the fenced <message> and the reply instruction go in the user
// turn. Each call's cost (USD) is appended to $RR_COSTLOG when set.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const EMPTY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'emptycwd');
fs.mkdirSync(EMPTY, { recursive: true });
const prompt = fs.readFileSync(0, 'utf8');
const at = prompt.lastIndexOf('\n<message>\n');
if (at === -1) { console.error('runner: no <message> block in the prompt'); process.exit(2); }
const head = prompt.slice(0, at).trimEnd();
const user = `${prompt.slice(at + 1).trim()}\n\nReply with exactly one line: the skill names separated by commas, or the word none.`;
const effort = process.env.RR_EFFORT ? ['--effort', process.env.RR_EFFORT] : [];
const args = ['-p', '--model', process.env.RR_MODEL ?? 'haiku', ...effort, '--output-format', 'json', '--tools', '', '--no-session-persistence',
  '--strict-mcp-config', '--safe-mode', '--disable-slash-commands', '--no-chrome', '--system-prompt', head];
// A clean environment and an empty working directory: only what the CLI needs to reach the model,
// so no host context (session reminders, host skill notes, effort overrides) and no repository
// context (the environment block's git status and recent commits) reaches the router.
const KEEP = ['PATH', 'HOME', 'HTTPS_PROXY', 'https_proxy', 'NO_PROXY', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'ANTHROPIC_BASE_URL', 'CLAUDE_SESSION_INGRESS_TOKEN_FILE'];
const ENV = { DISABLE_TELEMETRY: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
for (const k of KEEP) if (process.env[k] !== undefined) ENV[k] = process.env[k];
for (let attempt = 0; attempt < 3; attempt++) {
  const r = spawnSync('claude', args, { cwd: EMPTY, env: ENV, input: user, encoding: 'utf8', maxBuffer: 8 << 20, timeout: 110000 });
  let j;
  try { j = JSON.parse(r.stdout); } catch { continue; }
  if (process.env.RR_COSTLOG) fs.appendFileSync(process.env.RR_COSTLOG, `${j.total_cost_usd ?? 0}\n`);
  if (j.is_error) continue;
  process.stdout.write(`${String(j.result ?? '').trim()}\n`);
  process.exit(0);
}
console.error('runner: model call failed 3 times');
process.exit(1);
```

KEEP lists the authentication variables of the hosted environment the runs used; add your own
(an API key variable, for example) when the CLI authenticates another way.

### Reproducing a committed result

```sh
git clone https://github.com/QuentinTorg/skilldex "$SKILLDEX" && git -C "$SKILLDEX" checkout fc572b6
# from the harness checkout, with router.mjs saved from the block above:
RR_MODEL=haiku RR_EFFORT=low RR_COSTLOG=cost.log node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" \
  --skill <name> --runner "node /path/to/router.mjs" --runs 3 --model claude-haiku-5-5 --out routing-results-<name>.jsonl
```

The tuned run (skills/routing-results-2026-10-13.jsonl) predates `--runs` and `--out`: it ran the
same command three times per skill with `--json` in place of `--runs 3 --model … --out …` and folded
the three outputs into one line per case; `--runs 3 --out` writes the same lines. The held-out runs
add `--cases heldout.routing.jsonl`, and the personal one `--set personal`.

## Codex

A non-interactive `exec` call per case. The adapter marks its non-interactive page unverified; check
the installed version's help before scripting it (adapter: `adapters/codex`).

## Gemini CLI and Antigravity

A non-interactive prompt call per case; in non-interactive mode, prompts for approval become denials,
which is harmless here because the routing call needs no tools (adapter: `adapters/gemini`).

## Any engine

If no headless mode is available, run the router prompt through the vendor's API with the cheapest
model. The skill catalog, prompt and grading stay identical; only the transport changes.
