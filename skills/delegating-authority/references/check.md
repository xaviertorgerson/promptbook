# Checking an action against grants

Run immediately before the action, every time. The first "no" decides.

| # | Question | Read | If no |
|---|---|---|---|
| 1 | Is the action delegable at all? | the never-grantable list; a merge whose base is the protected branch | stop; the human acts |
| 2 | Does no policy deny or project wall forbid it? | the operator's policy, project deny rules, branch protection | stop; walls win |
| 3 | Is there a live grant for me? | `.orchestrator/grants/*.yaml`: `granted_at` ≤ now < `expires_at`, no `revoked_at`, `granted_to.role` (and `agent`, `runtime` if set) match | ask the human |
| 4 | Does its current `actions` list this action? | `actions` (strings or objects) | ask |
| 5 | Does `scope` cover the subject? | `repositories` contains the PR's or task's repository; if `epics`/`tasks`/`requirements` are listed, the subject is among them; not in `non_goals` | ask |
| 6 | (merge) Do the parameters match? | the merge action's `repo` = the PR's repository; `target` = the PR's base branch, exactly, and not the protected branch (`protected_branch`, and the forge's default branch); `strategy` = the strategy you will use; `requires`: the reviewer role passed this exact head, required checks are green on it, the head did not change since, and a human approval exists if listed | ask, or wait for the missing evidence |
| 7 | Are the limits intact? | live workers < `limits.max_workers` (to start a worker: of every live grant that dispatches work; a merge-only grant's bounds merges); Σ run records `total_cost_usd` with `grant: GRANT-n` < `limits.budget.max_usd`; no `limits.stop_when` met | stop delegated work; needs-human |
| 8 | Act and record | task record `decisions += {decision, source: GRANT-n, scope, at}`; run record `grant: GRANT-n` | — |

## Worked checks

With `references/examples/GRANT-7-milestone-no-merge.grant.yaml` live:

| Action | Answer | Step |
|---|---|---|
| start BILL-12 (in rating-engine, ready) | yes | 8 |
| start a fifth worker | no — max_workers is 4 | 7 |
| approve the author's plan for BILL-12 | yes | 8 |
| mark PR 260 ready for review | no — `finalize` is not granted | 4 |
| merge PR 260 into main | no — main is the protected branch, which no grant covers | 1 |
| start a task in the invoicing epic | no — not in scope | 5 |
| approve the next epic's spec | no — never delegable | 1 |

With `references/examples/GRANT-8-integration-merge.grant.yaml` live:

| Action | Answer | Step |
|---|---|---|
| merge PR 262 (base `integration/rating-engine`, head reviewed and green) by merge commit | yes | 8 |
| merge PR 262 by squash | no — strategy is `merge` | 6 |
| merge PR 263 into `main` | no — main is the protected branch (the grant's `protected_branch`); no grant covers it | 1 |
| merge PR 262 after the author pushed a new head | no — the pass was for the old head | 6 |
| merge PR 41 in acme/web into `integration/rating-engine` | no — repository | 5 |
| merge `integration/rating-engine` into `main` | no — promoting an integration branch is never delegable | 1 |
