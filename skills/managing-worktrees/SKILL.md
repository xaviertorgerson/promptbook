---
name: managing-worktrees
description: Use when a task needs its own checkout, or the user says "set up a worktree for BILL-9", "give this branch its own database and ports", "refresh my branch on main", "rebase the task branch", "clean up the worktrees", "remove the worktree for the merged PR", "which worktrees are stale", or "two agents are fighting over the dev database". Creates one isolated checkout per task keyed on its branch, derives its database, port block and caches from a naming rule, copies env files without committing them, records the base commit, refreshes it, and removes it only after an audit. Do not use for merging or landing a branch (landing-changes), for implementing the task inside the worktree (implementing-task), or for deciding how many tasks run at once (orchestrating-work).
license: MIT
compatibility: Any agent runtime that can run git 2.20 or later. Optional harness tools/validate.mjs (Node 22) to check task records.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Managing worktrees

Give each task one hermetic checkout and the resources derived from it, keep it current with its
base, and remove it only when nothing in it can be lost. File isolation is not enough: a shared
database, port or cache makes parallel tasks corrupt each other and look like flaky tests.

## Inputs

- The task file (`task` contract): `id`, `branch`, `touches`, `depends_on`.
- The runtime's task record if one exists (`task-record` contract): `repository.root`, `worktree`,
  `remote`, `base`, `base_commit`, `branch`; `development_target` for submodule work;
  `pull_requests`; `workspace`.
- The project's local-resource config: its port block, database server URL, the allowlist of
  untracked files a worktree needs (for example an env-file include list), and its init script.
- The concurrency limit: the grant's `limits.max_workers` when a coordinator acts under a grant,
  else the project's (default 3–5, one human's review span).

## Procedure

**Create (one per task, keyed on the branch)**

1. **Resolve the canonical repository** from the task record or the human; do not scan directories
   to guess. Confirm the primary checkout's state and leave it as it is: never reset, stash,
   switch or discard a dirty, ahead or off-branch primary checkout to make room.
2. **Check the limit and the lane.** Count live task worktrees for this repository. At the limit,
   queue; do not create. If this task's `touches` overlap an active task's, it is the same lane:
   warn and wait, unless a human authorizes running both.
3. **Fetch the base and record it.** Fetch the target base (default branch, or the integration
   branch for a per-epic flow) and record its exact commit. Branch from that commit, never from
   whatever is checked out.
4. **Create the worktree** at the derived path on the task branch (references/naming-and-resources.md):
   new branch from the recorded commit, or the existing remote branch when resuming. One worktree
   per branch; if one exists for this branch, reuse it after checking it is this task's.
5. **Initialize submodules** inside the new worktree before running any git command in a submodule
   directory (until then, git acts on the parent). Keep non-target submodules at their pins; set a
   target submodule's remote and branch only after it is initialized.
6. **Derive the resources** with the naming rule: database `app_<slug>`, a port block offset from
   the project's range, cache and build directories inside the worktree or keyed on the slug.
   Never hardcode a port; never point two worktrees at one database.
7. **Copy untracked inputs by allowlist.** Copy only the files on the project's include list (local
   env files) from the primary checkout; check they are ignored by git in the worktree before
   anything else runs; never print their contents; never stage them. Prefer a reference to the
   secret store over copying values (handling-credentials).
8. **Start and smoke-check.** Run the project's single init script; the first act in the worktree is
   its smoke check. Red on a fresh base is a stop: report it, do not start the task.
9. **Record it.** Write `repository.{root, worktree, remote, base, base_commit, branch}` (and
   `development_target` for a submodule) to the task record; add the base to the task's agent log.

**Refresh (keep the branch current)**

10. **Before anyone else has the branch** (no PR, or a draft no one else has pulled): rebase onto the
    fetched base, re-run the gates, push with `--force-with-lease=<branch>:<expected-sha>` only to
    your own task branch. **Once it is shared** (a PR under review, another agent or human has it):
    merge the base into the branch, no history rewrite. A rewrite of a shared branch needs explicit
    human authorization. Record the new base commit. Conflicts here are resolved as the author's own
    work; landing conflicts belong to landing-changes.

**Clean up (audited, never by age or in bulk)**

11. **Decide eligibility.** A merged or closed PR, or an explicit human request naming the task or
    group, makes a worktree eligible. Eligibility never authorizes removing the primary checkout,
    closing a PR, deleting a branch, or losing data.
12. **Run the audit** in references/cleanup-audit.md for each eligible worktree: owned by this task;
    exact path matches the record; no uncommitted or untracked work of value; no unpushed commits;
    commits recoverable from a remote branch, PR or merge; no running stateful process; submodules
    clean and recoverable; it is not the primary checkout or a parent other worktrees hang from.
13. **Remove what passed**, with its derived resources: stop its processes, drop its database
    (only the derived name, only after the audit), free its ports, delete its caches, then remove
    the worktree with git's own command and prune. Keep anything that failed the audit visible and
    report the exact blocker and the recommended next action.
14. **Close the record.** Archive the task record (or mark the worktree removed); cleanup changes
    no workflow status and no attention.

**Reap (periodic, report-first)**

15. Run the reaper in references/reaper.md: list worktrees, classify each (active, eligible,
    orphaned, blocked), audit the eligible ones, remove only those that pass, and report the rest.
    A worktree is never stale merely because it is old.

## Outputs

- A worktree on the task branch, its derived resources, and its task-record `repository` block
  (`base_commit` recorded). Example: references/task-record-example.yaml (validates against the
  `task-record` contract; if `harness validate` is available, run
  `node tools/validate.mjs --contract task-record <file>`).
- A cleanup report: per worktree, removed or kept with the blocker and next action.

## Gates and stop conditions

- Never remove: the primary checkout; a worktree whose parent workspace hosts others; anything with
  uncommitted, untracked-valuable, unpushed or unrecoverable work; anything with a running
  stateful process. Report instead.
- Never use a recursive delete on a worktree directory; use git's removal. Force removal only for
  the documented submodule case after the audit passed (references/cleanup-audit.md).
- Never delete a branch as part of cleanup; branch deletion is a separate, human-requested action.
- Hand to a human (attention `needs-human`, `next_action` naming the choice): an unexpected parent
  or duplicate workspace; a dirty primary checkout that blocks fast-forwarding; overlapping lanes;
  an audit blocker that only a human can resolve (keep or discard local work); a rewrite of a
  shared branch.

## References

- references/naming-and-resources.md — the naming rule, derived resources, env copying, limits.
- references/cleanup-audit.md — the audit checklist, submodule audit, the removal commands.
- references/reaper.md — the stale-worktree reaper and its report.
- references/task-record-example.yaml — a task record with the recorded base commit.
- references/engine-notes.md — how runtimes create and remove worktrees.
