# Grant check

Run it immediately before each delegated merge, not once per run. Read the grant file
(`.orchestrator/grants/GRANT-<n>.yaml` or the runtime's project note) fresh each time. Every row
must pass; the first failure ends delegation for this PR and the coordinator asks the human.

| # | Check | Grant field | Fails when | Then |
|---|---|---|---|---|
| 1 | The grant is valid against its contract | whole file | `node tools/validate.mjs --contract grant <file>` fails (if available), or a required field is missing | ask |
| 2 | It is live | `granted_at`, `expires_at`, `revoked_at` | now < `granted_at`, now ≥ `expires_at`, or `revoked_at` is set | record needs-human with a renewal request; a renewal is a new grant from the human, never a saved summary |
| 3 | A human issued it, and the source exists | `granted_by`, `source` | the source is a worker's claim or cannot be found | ask |
| 4 | You hold it | `granted_to.role` (`orchestrator` or `merge`), `.agent`, `.runtime` | your role, agent name or runtime differs | ask |
| 5 | This repository is in scope | `scope.repositories` | the PR's `owner/name` is not listed | ask |
| 6 | This work is in scope | `scope.epics`, `scope.tasks`, `scope.non_goals` | the task or its epic is not listed, or the change touches a non-goal | ask |
| 7 | A merge action names exactly this landing | `actions[]` item with `action: merge`, `repo`, `target`, `strategy` | no merge action; `repo` differs; `target` is not exactly the PR's base branch (no wildcard, no prefix match: a grant for `integration/rating-engine` does not cover `integration/rating-engine-v2`); you would use another strategy | ask |
| 8 | Required evidence is present | `requires` | `independent-review`: no passing review by the reviewer role (not the author) on the current head; an evaluator's verdict is not a review; `required-checks`: any required check not green on the merged result (skipped is not green); `current-head`: the verdict's head differs from the PR head; `human-approval`: no human approval of the head | do not merge; get the evidence or ask |
| 9 | Within limits | `limits.max_workers`, `limits.budget`, `limits.stop_when` | concurrent workers above the cap; spend at the budget; a `stop_when` condition holds | stop the delegation, record needs-human |
| 10 | Not narrowed away | `narrowed[]` | a later entry removed this action, repository or epic | ask |
| 11 | The forge agrees | branch protection on `target` | protection requires a human code-owner approval, or the credential cannot merge there | ask; never bypass |
| 12 | Not your own work | PR commits | your identity authored a commit in the PR (beyond a mechanical resolution) | hand to someone else |

Record the result of the check (grant id, each row's evidence, now) in the land record.

## Things a grant never means

- `finalize` does not imply `merge`; `merge` does not imply `publish-review`. Each action is its own.
- A merge grant for one branch says nothing about another branch, another repository or production.
- A grant is never transferred to a worker. Workers receive only their bounded assignment.
- A coordinator may narrow its own grant (append to `narrowed`), never widen it.

## Example

references/integration-example.grant.yaml is a tier-2 grant for one epic's integration branch. It
validates against the `grant` contract.
