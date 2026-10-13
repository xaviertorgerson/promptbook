# Stale-worktree reaper

A periodic, report-first sweep. It removes only worktrees that are eligible and pass the cleanup
audit; it reports everything else. Run it on a schedule the project chooses (daily is plenty), or
when a human asks "which worktrees are stale". It never deletes by age and never in bulk.

## 1. Inventory

```sh
git worktree list --porcelain        # path, HEAD, branch, locked/prunable flags
git worktree prune --dry-run -v      # registrations whose directory is already gone
```

Join each entry with: the task record whose `repository.worktree` matches; the task file's
`status`; the PR state for the branch (open, draft, merged, closed); the last commit time; the
slot file entry; running processes under the path.

## 2. Classify

| Class | Rule | Action |
|---|---|---|
| active | task `in-progress` or `review`, or a session or process is running in it | leave; list only |
| waiting | task `human-review`, `merging`, `blocked`, `needs-input` or `suspended` | leave; list with how long it has waited |
| eligible | PR merged or closed, or task `merged`, or a human named it for cleanup | run the cleanup audit; remove if it passes |
| orphaned | no task record and no task file names its branch | never remove; report for a human to adopt or discard |
| locked | `git worktree lock` was set | leave; report the lock reason |
| prunable | the directory is gone, only the registration remains | `git worktree prune` (removes metadata only) |
| primary | the first entry, or a parent of other worktrees | never touched |

Age is a column in the report, never a class. A worktree untouched for a month with unpushed
commits is someone's work.

## 3. Act

For each `eligible` worktree: run references/cleanup-audit.md, then remove with its derived
resources, or keep it with the blocker. For `prunable`: prune. Nothing else.

## 4. Report

```
reaper 2026-10-13 · repo acme/billing · 6 worktrees (limit 4 running)
active     BILL-11  .worktrees/BILL-11  in-progress  session 7c2e  —
waiting    BILL-7   .worktrees/BILL-7   human-review 2d          —
removed    BILL-3   .worktrees/BILL-3   PR #231 merged; db and slot 1 freed
kept       BILL-9   .worktrees/BILL-9   PR #238 closed; 2 commits on no remote → push or confirm disposable
orphaned   —        ../billing-spike    no task names branch spike/rates → adopt or discard (human)
pruned     BILL-2   (directory missing) registration removed
Needs you: BILL-9 (keep or discard 2 commits); ../billing-spike (adopt or discard).
```

Each "needs you" line becomes a task-record `next_action` with attention `needs-human` when the
worktree belongs to a recorded task.
