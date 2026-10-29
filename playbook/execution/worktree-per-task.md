# Worktree per task

## Problem

Two sessions in one checkout corrupt each other's files. File isolation is not enough: parallel
agents sharing a dev database, a port or a cache corrupt each other with interleaved migrations and
test data, and the result looks like flaky tests. Cleanup done casually deletes work that was never
pushed.

## Practice

- **One isolated checkout per task**, keyed on the task's branch: a git worktree or a container. One
  session per checkout; sessions are not shared across tasks. The branch is also the claim: pushing
  it as a new ref claims the task, and the task's in-flight status lives on its head.
- **Derive every shared resource from the branch.** Database name, port block, cache directory and
  any local service get a value computed from the branch, so a worktree is hermetic and repeatable.
  Untracked files the app needs (local env files) are copied in by an allowlist, never by hand.
- **Start the app the same way every time.** One init script brings the worktree's stack up; the
  session's first act is a smoke check.
- **Base on a recorded commit.** Fetch the target base, record its exact commit, branch from it. Never
  reset, stash or discard a dirty primary checkout to make room.
- **Audited cleanup.** A worktree is removed only after checking: owned by this task, no uncommitted or
  unpushed work, no running stateful process, its commits recoverable from a remote branch or PR.
  Derived resources go with it. A branch that exists only locally is pushed to an `archive/<name>`
  ref before its worktree goes, so cleanup never decides that unpushed work was worthless. If removal is blocked, keep it visible and report why. A merged or
  closed PR makes a worktree eligible; it never authorizes deleting the primary checkout or a branch.

## Evidence

- 2026-09-23 · practice · agentic-template gives each worktree its own database `app_<branch>` and a
  free port block from the project's range ([concurrency.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/concurrency.md)).
- 2026-09-30 · practice · stagehand records the base commit, preserves dirty primary checkouts, and
  audits ownership, recoverability and process state before removing a worktree
  ([safety-and-escalation.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/references/safety-and-escalation.md)).
- 2026-10 · practice · heirloom keeps `archive/*` branches for local-only design work before cleanup
  ([archive/design-ux-laws](https://github.com/xaviertorgerson/heirloom/tree/archive/design-ux-laws)).
- unsourced · in heirloom, one session's edits, written by repo-root paths, landed on a second
  agent's branch in the primary checkout and had to be copied out and restored (the operator's
  notes, 2026-10); treat it as recommendation.
- 2026-02-11 · vendor · OpenAI's app booted per worktree, each with an ephemeral observability stack
  the agent could query ([OpenAI](https://openai.com/index/harness-engineering/)).
- 2025-09-26 · vendor · Sculptor isolates each agent in a container so dependencies need no reinstall
  per agent ([Imbue](https://imbue.com/sculptor)).
- 2026-04-10 · vendor · Vibe Kanban, a worktree-per-agent board, sunset as native features absorbed
  its value ([Vibe Kanban](https://vibekanban.com/blog/shutdown)).
- 2026-10 · vendor · Claude Code's `isolation: worktree` runs a subagent in a temporary worktree
  ([subagents](https://code.claude.com/docs/en/sub-agents)); `adapters/` binds each engine's equivalent.

## Contracts used

`task` (`branch`, `touches`), `state-machines/workflow.yaml` (`status_authority`: the branch is the
claim and holds the in-flight status), `task-record` (repository root, worktree, base commit, branch,
workspace id; `resources`: the derived database, port block, caches and service prefixes, the cleanup
`audit`, and `worktree_removed_at`, which requires an audit that passed),
`state-machines/attention.yaml` (cleanup does not change attention).

## Anti-patterns

- Parallel worktrees on one shared dev database.
- Ports hardcoded, so the second worktree fails to start and the agent "fixes" the config.
- Worktrees deleted in bulk by age.
- Editing a linked worktree's files by the primary checkout's absolute path: the edits land in the
  primary checkout, on whatever branch another session switched it to.
- Closing a primary workspace and taking its linked worktrees with it.
- A task branch created from whatever happened to be checked out.
- A claim committed to the default branch, where agents may not push, or a status "fixed" there by
  hand while the task branch holds the live one.

## Revisit when

The runtime provisions isolated sandboxes per task with derived resources natively, or containers
become cheaper to start than worktrees for the pack's stack.
