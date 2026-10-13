# Worktree per task

## Problem

Two sessions in one checkout corrupt each other's files. File isolation is not enough: parallel
agents sharing a dev database, a port or a cache corrupt each other with interleaved migrations and
test data, and the result looks like flaky tests. Cleanup done casually deletes work that was never
pushed.

## Practice

- **One isolated checkout per task**, keyed on the task's branch: a git worktree or a container. One
  session per checkout; sessions are not shared across tasks.
- **Derive every shared resource from the branch.** Database name, port block, cache directory and
  any local service get a value computed from the branch, so a worktree is hermetic and repeatable.
  Untracked files the app needs (local env files) are copied in by an allowlist, never by hand.
- **Start the app the same way every time.** One init script brings the worktree's stack up; the
  session's first act is a smoke check.
- **Base on a recorded commit.** Fetch the target base, record its exact commit, branch from it. Never
  reset, stash or discard a dirty primary checkout to make room.
- **Audited cleanup.** A worktree is removed only after checking: owned by this task, no uncommitted or
  unpushed work, no running stateful process, its commits recoverable from a remote branch or PR.
  Derived resources go with it. If removal is blocked, keep it visible and report why. A merged or
  closed PR makes a worktree eligible; it never authorizes deleting the primary checkout or a branch.

## Evidence

- 2026-09-23 · practice · agentic-template gives each worktree its own database `app_<branch>` and a
  free port block from the project's range ([concurrency.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/concurrency.md)).
- 2026-09-30 · practice · stagehand records the base commit, preserves dirty primary checkouts, and
  audits ownership, recoverability and process state before removing a worktree
  ([safety-and-escalation.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/references/safety-and-escalation.md)).
- 2026-02-11 · vendor · OpenAI's app booted per worktree, each with an ephemeral observability stack
  the agent could query ([OpenAI](https://openai.com/index/harness-engineering/)).
- 2025-09-26 · vendor · Sculptor isolates each agent in a container so dependencies need no reinstall
  per agent ([Imbue](https://imbue.com/sculptor)).
- 2026-04-10 · vendor · Vibe Kanban, a worktree-per-agent board, sunset as native features absorbed
  its value ([Vibe Kanban](https://vibekanban.com/blog/shutdown)).
- 2026-10 · vendor · Claude Code subagents with worktree isolation remove an unchanged worktree on
  finish ([subagents](https://code.claude.com/docs/en/sub-agents)); adapters bind this in `adapters/`.

## Contracts used

`task` (`branch`, `touches`), `task-record` (repository root, worktree, base commit, branch,
workspace id), `state-machines/attention.yaml` (cleanup does not change attention).

## Anti-patterns

- Parallel worktrees on one shared dev database.
- Ports hardcoded, so the second worktree fails to start and the agent "fixes" the config.
- Worktrees deleted in bulk by age.
- Closing a primary workspace and taking its linked worktrees with it.
- A task branch created from whatever happened to be checked out.

## Revisit when

The runtime provisions isolated sandboxes per task with derived resources natively, or containers
become cheaper to start than worktrees for the pack's stack.
