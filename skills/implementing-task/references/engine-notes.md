# Engine notes

The procedure names no engine. These notes say how some runtimes provide what it needs; the
harness `adapters/` own the mapping and are the place to correct it. Unverified items are marked.

## Claude Code

- Worktree: `claude --worktree <ID>` creates one under `.claude/worktrees/`; a subagent definition
  with `isolation: worktree` runs in a temporary one. Untracked files listed in `.worktreeinclude`
  are copied in (agentic-template copies `.env` this way; see managing-worktrees for the rule).
- Structured return: `claude -p --output-format json --json-schema <return.schema.json>`; the
  return is in `.structured_output`. Unattended runs pin `--permission-mode dontAsk` plus
  `--allowedTools`, `--max-turns` and `--max-budget-usd` (agentic-template ADR-0021,
  `fix/agent-run-caps`); every denied ask shows up in `permission_denials`.
- Evaluator: a subagent in its own context (agentic-template's `reviewer` and `test-runner`). Set
  its model explicitly; "inherit" gives the writer's model, which defeats "different family".
- Never run a loop or CI session with `--bare`: it skips hooks, which disarms the walls.

## Codex

- Structured return: `codex exec --output-schema <schema>` (unverified in the harness adapter).
- Worktrees are made with plain `git worktree`; the runner records the path.

## Gemini CLI

- Subagents cannot spawn subagents; the evaluator must be dispatched by the runner, not by the
  coder session.

## Terminal-multiplexer coordinators (stagehand on Herdr)

- The coordinator creates the workspace and worktree and records them in the task record; the author
  receives only objective, checkout, branch, base commit and boundaries. The author does not read or
  write orchestration state, and no worker JSON is required: the coordinator reads the pane. A
  `return` file is still the portable hand-back when the runtime wants one.
