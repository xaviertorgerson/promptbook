# Cleanup audit

Run it per worktree, every time, immediately before removal. Trust current git and process state,
not saved booleans. An idle terminal proves nothing. A merged PR makes a worktree eligible; it never
authorizes removing the primary checkout, closing a PR, deleting a branch, or losing data.

## Checklist (all must hold; record each result)

| # | Check | How | Blocks when |
|---|---|---|---|
| 1 | It is a linked worktree, not the primary checkout | `git worktree list --porcelain`: the first entry is the primary; the path must not be it | it is the primary, or a parent that other worktrees or workspaces hang from |
| 2 | It is this task's | path and branch equal the task record's `repository.worktree` and `branch` | anything differs: ask |
| 2a | No open PR still needs it | the forge's PR state for the branch | the PR is open (draft or ready): the task is live, the author may still iterate there; keep it unless a human named this worktree for removal, and then only if checks 3 to 11 pass |
| 3 | No uncommitted tracked changes | `git -C <wt> status --porcelain=v1` has no ` M`, `A `, `D ` lines | any |
| 4 | No valuable untracked files | the `??` lines from the same command | anything not a known disposable artifact (build output, logs) |
| 5 | No valuable ignored files | `git -C <wt> status --porcelain=v1 --ignored`, the `!!` lines | anything besides the allowlisted env copies and disposable caches. git's own removal deletes ignored files without asking (measured below) |
| 6 | No unpushed commits | `git -C <wt> log --oneline HEAD --not --remotes` is empty | any commit not on some remote branch |
| 7 | Commits recoverable | the branch head is on the remote, or reachable from a merged or open PR, or from the base after merge | otherwise |
| 8 | No stashes made in it | `git stash list` entries whose message names this branch | any: stashes are shared across worktrees, ask before dropping |
| 9 | No running stateful process | the worktree's process/state files (`.agent/` dev-server state), and processes whose working directory is inside the path | a dev server, a database, a migration or a test run; stop it cleanly first if it is this task's |
| 10 | Submodules clean and recoverable (if any) | the submodule audit below | any failure |
| 11 | Derived resources identified | the database name, port slot, cache paths, service prefixes from the naming rule | a resource whose name does not derive from this slug: never drop it |

Distinguish valuable local work from disposable artifacts. When in doubt, it is valuable: keep the
worktree and report.

## Submodule audit (meta-repositories)

1. **Each initialized submodule:** no internal tracked or untracked changes; its target commit is
   recoverable through a remote branch, PR, merge or explicit reference; non-target submodules sit
   at their expected pins.
2. **The containing repository:** no changes except a recorded target gitlink difference whose
   pointer update is `not-planned` (task record `development_target.containing_repository_pointer_update`)
   and whose child passed step 1. A `planned` or ambiguous pointer update is preserved.

Then deinitialize clean pinned submodules normally. If deinit refuses only because of the expected
target gitlink mismatch, from the task-owned containing worktree and nowhere else:

```sh
git submodule deinit -f -- <validated-relative-target-path>
```

Never with `--all`, never in the primary checkout, never with an ambiguous target, internal
changes, unrecoverable commits or active work.

## Removal

```sh
# stop this worktree's processes cleanly, then:
<drop the derived database app_<slug>>       # only the derived name, only now
<free the port slot; delete the slug's caches and service prefixes>
git worktree remove <path>                    # git's removal, from the primary checkout
git worktree prune
```

- **Submodule case.** git refuses to remove a worktree that contains submodules, even after they
  are deinitialized. Only after the full audit passed and the submodules were deinitialized:
  `git worktree remove --force <path>`. The force covers that one checkout; it never covers dirty
  or active work, another worktree, or branch deletion.
- **Never** `rm -rf` a worktree directory, and never remove a primary workspace whose closure would
  take its linked worktrees with it (a terminal multiplexer's repository group, for example).
- **If removal fails** for any other reason, keep the worktree and its record visible, and report
  the exact error and a recommended next action. Do not escalate to force.

## Report line per worktree

```
BILL-7  .worktrees/BILL-7  feat/bill-7-rerate-proration  removed  (PR #240 merged; db app_feat_bill_7_rerate_proration dropped; slot 2 freed)
BILL-9  .worktrees/BILL-9  feat/bill-9-tax-codes         kept     (2 commits on no remote) → push the branch or confirm they are disposable
```

## Measured behavior this checklist relies on (git 2.43, 2026-10-13)

- `git worktree remove <path>` refused a worktree with an untracked file ("contains modified or
  untracked files, use --force"), but removed one holding an ignored `.env` without warning: the
  ignored file was deleted with the directory. Hence check 5.
- `git worktree remove` refused a worktree with submodules ("working trees containing submodules
  cannot be moved or removed") both before and after `git submodule deinit --all`; only `--force`
  removed it. Hence the audited force exception.
