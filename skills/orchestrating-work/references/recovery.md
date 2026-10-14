# Recovery after a crash, restart or lost events

Recovery reads durable state only: task records, task files, git, the forge and the runtime's live
snapshot. A transcript or a session id is a hint. Never replay old handoffs.

## Order of trust

1. Human messages and decisions recorded with their source (authority, intent).
2. Git and the forge: commits, branches, PR heads, reviews, required checks (what happened).
3. Task files: status, owner, agent log, working notes (where the work stands), read where each
   status lives: a claimed task's on its branch head (`git ls-remote --heads` lists the claims), a
   landed one's on its target, the rest on the default branch.
4. Worker answers and returns (their conclusions; verify consequential ones).
5. Runtime signals and saved attention (observations only).

## Procedure

1. Load live grants. A missing, expired, revoked or unrelated grant enables nothing; keep working
   only on what the human started directly.
2. List `.orchestrator/tasks/*.yaml`. For each record, read its task file, branch and PR.
3. Decide the furthest supported state:

| Evidence | Record becomes | Next |
|---|---|---|
| task `merged` | complete; cleanup eligible | audited cleanup, archive the record |
| task `human-review`, PR ready, current head passed review | complete | nothing until the human acts |
| task `review`, PR open, no verdict on the current head | working, next_role evaluator | start or resume the evaluator on that head |
| the current head failed evaluation (or a code review requested changes) | working, next_role author | route the recorded findings to the author |
| task `in-progress`, branch has commits after the base, no PR | working, next_role author | resume or restart the author from the branch and agent log |
| task `in-progress`, owner is this runtime, no commits, no live worker | working | the claim stands; restart the author on the same branch |
| task `ready` and no branch on the remote, but the record says working | working → re-check | the claim never landed: retire the worker, audit the checkout, select again |
| task branch exists, the default branch's copy says `ready` | follow the branch head | the default branch is stale for every in-flight task by design; never "fix" it |
| task `blocked`, `needs-input` or `suspended` | needs-human | the parked reason, verbatim, as next_action |
| owner changed to a human | complete for orchestration | stop the worker after it commits; record the take-over |
| record and task disagree in another way | needs-human | name the disagreement |

4. Match workers: a live worker whose session matches `role_sessions` keeps its watch; a missing one
   is restarted from durable state and labeled a fresh session, never a resume. Cancel watches whose
   worker is gone; register replacements before the first prompt.
5. Drain pending wakes after the inventory, not before; acknowledge each after handling it.
6. Save every changed record with `updated_at`, then resume selection.

## Lost events

On a lost-events notice or a gap you cannot account for: resubscribe, take a snapshot of live
workers and their states, and run the procedure above. A worker that is idle now may have finished,
asked a question, or failed; read its latest answer before recording anything.

## What never happens in recovery

- Re-creating a worktree, branch, PR or session that exists.
- Re-publishing a review, re-finalizing a PR, or re-merging.
- Counting a stale approval or a pass on an older head as current.
- Asking a worker to reconstruct a history of events; ask once for its current result and head.
