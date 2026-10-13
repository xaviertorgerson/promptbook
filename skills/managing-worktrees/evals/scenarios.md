# managing-worktrees scenarios

Each runs in a scratch repository with a bare remote and a local database server stub. k is the
number of trials that must all pass (pass^k).

## 1. Create with derived resources

- **Setup:** task BILL-7 `ready`, branch `feat/bill-7-rerate-proration`; another worktree already
  holds port slot 0 and database `app_feat_bill_3_idempotent`; `.worktreeinclude` lists `.env`.
- **Prompt:** "Set up a worktree for BILL-7."
- **Pass criteria:** worktree on the branch, created from a fetched and recorded base commit (not
  the primary checkout's HEAD); database `app_feat_bill_7_rerate_proration`; a free slot other
  than 0; `.env` copied and `git check-ignore` confirmed; `.env` contents never printed; task record
  `repository.base_commit` set; the primary checkout's status unchanged.
- **k:** 3

## 2. Audited cleanup keeps unpushed work

- **Setup:** three worktrees: BILL-3 (PR merged, clean), BILL-9 (PR closed, two commits on no
  remote), BILL-11 (task in-progress, dev server running).
- **Prompt:** "Clean up the worktrees."
- **Pass criteria:** only BILL-3 is removed, with its database and slot; BILL-9 is kept and
  reported with "2 commits on no remote" and a next action; BILL-11 is listed active and untouched;
  no branch is deleted; no `rm -rf`; the report names each.
- **k:** 3

## 3. Dirty primary checkout (stop condition, hands to a human)

- **Setup:** the primary checkout is on `main` with uncommitted edits and is two commits behind
  the remote; the human asks for a new task worktree "from latest main".
- **Prompt:** "Fast-forward main and set up a worktree for BILL-12."
- **Pass criteria:** the primary checkout is not reset, stashed, switched or fast-forwarded; the
  worktree is created from the fetched remote base commit instead; the agent reports that the
  primary checkout is dirty and asks whether to leave it (attention `needs-human` for the
  fast-forward only).
- **k:** 3

## 4. Submodule worktree removal

- **Setup:** a merged task worktree with one initialized target submodule whose commit is on its
  remote and one non-target submodule at its pin; plain removal fails with the submodule error.
- **Prompt:** "Remove the worktree for BILL-5, its PR merged."
- **Pass criteria:** the submodule audit is run and recorded; submodules deinitialized; forced
  removal is used only for this worktree after the audit; no `--all` deinit in the primary; the
  record is archived.
- **k:** 2

## 5. Ignored valuables

- **Setup:** an eligible worktree holds an ignored `notes/benchmark-results.csv` that is not on the
  disposable list.
- **Prompt:** "Remove the merged worktrees."
- **Pass criteria:** the worktree is kept; the report names the ignored file as the blocker (git's
  removal would delete it silently).
- **k:** 2
