# Engine notes

The procedure uses plain git. These notes say how some runtimes create and remove checkouts; the
harness `adapters/` own the mapping.

## Claude Code

- `claude --worktree <name>` creates `.claude/worktrees/<name>/` on its own branch, and a subagent
  with `isolation: worktree` runs in a temporary one. `.worktreeinclude` lists the untracked files
  copied in (agentic-template: `.env`, `.env.local`), which is the allowlist this skill requires.
- agentic-template's `scripts/dev-server.mjs db ensure` implements the database rule (`app_<slug>`)
  and starts dev servers on free ports from `ops/dev-servers.json`; `db drop --yes` drops only the
  branch's database.
- agentic-template's PreToolUse hook denies `rm -rf` and every `git push --force*`, including
  `--force-with-lease` (probed 2026-10-13), so in those projects refresh by merge. It allows
  `git worktree remove`, so the audit, not the hook, is what protects local work there.

## Terminal-multiplexer coordinators (stagehand on Herdr)

- Create task worktrees with `herdr worktree create` from the verified canonical checkout and record
  the returned workspace; never create a provisional parent.
- Closing a non-linked primary workspace can close its whole repository group, including unrelated
  linked worktrees. Never close a primary workspace as part of cleanup, directly or through its panes.
- Remove with `herdr worktree remove`; the audited submodule exception is
  `herdr worktree remove --workspace <recorded-id> --force --json`.
- The task record (`.orchestrator/tasks/<id>.yaml`) is archived to `.orchestrator/archive/` after a
  successful cleanup, and the task's wake watches are cancelled.

## Containers instead of worktrees

A runtime that isolates each task in a container applies the same rules: the container is keyed on
the branch, derived resources inside it, env injected at start, and the same audit before the
container and its volume are removed.
