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

## Codex

A non-interactive `exec` call per case. The adapter marks its non-interactive page unverified; check
the installed version's help before scripting it (adapter: `adapters/codex`).

## Gemini CLI and Antigravity

A non-interactive prompt call per case; in non-interactive mode, prompts for approval become denials,
which is harmless here because the routing call needs no tools (adapter: `adapters/gemini`).

## Any engine

If no headless mode is available, run the router prompt through the vendor's API with the cheapest
model. The skill catalog, prompt and grading stay identical; only the transport changes.
