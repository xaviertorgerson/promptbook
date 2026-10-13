# Engine notes: calling a model non-interactively for routing evals

The procedure is engine-neutral. The harness adapters own the exact flags; these notes say where to
look and what to check. Re-verify against the adapter before relying on a flag.

## Claude Code

A headless call with a cheap model, the router prompt on stdin, text output, no tools. agentic-template's
`scripts/skill-evals.mjs` runs one call per case on the cheapest model and its workflow runs it on
every push touching skills, once a repository variable enables it. Unattended runs pin a no-prompt
permission mode with an allowlist (adapter: `adapters/claude`).

## Codex

A non-interactive `exec` call per case. The adapter marks its non-interactive page unverified; check
the installed version's help before scripting it (adapter: `adapters/codex`).

## Gemini CLI and Antigravity

A non-interactive prompt call per case; in non-interactive mode, prompts for approval become denials,
which is harmless here because the routing call needs no tools (adapter: `adapters/gemini`).

## Any engine

If no headless mode is available, run the router prompt through the vendor's API with the cheapest
model. The skill catalog, prompt and grading stay identical; only the transport changes.
