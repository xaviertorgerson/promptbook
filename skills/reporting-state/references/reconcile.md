# Deciding attention from evidence

## Sources of evidence, in order of authority

1. Human messages: authorization and intent. They outrank conflicting stale observations.
2. Git and the forge: commits, branches, PR heads, reviews, checks.
3. The task file: status, owner, open questions, agent log, working notes.
4. The worker's latest answer or return: its conclusions, to verify when consequential.
5. Runtime signals: observations only.

## Decision table

| Evidence after inspecting | Attention | summary (example) | next_role / next_action |
|---|---|---|---|
| a permission or credential prompt is waiting | needs-human | "Awaiting permission decision" | next_action: the exact command or credential and why |
| the worker asked a question the spec does not answer | needs-human | "Awaiting proration decision" | next_action: the question, verbatim |
| the worker proposed a plan; the human approves plans | needs-human | "Plan awaits approval" | next_action: approve or amend the plan at <path or session> |
| a run hit a ceiling or crashed, or had permission denials | needs-human | "Turn ceiling reached" | next_action: options (split, re-scope, raise budget) |
| task `needs-input` or `blocked` | needs-human | "Parked: needs input" | next_action: the parked reason |
| an author is implementing or fixing; evaluator queued | working | "Fixing review findings" | next_role: author |
| a draft PR is open and the current head is not yet evaluated | working | "Awaiting independent review" | next_role: evaluator |
| findings were selected and routed back | working | "Addressing two findings" | next_role: author |
| waiting on another task or agent | working | "Waiting on BILL-11" | next_role: orchestrator |
| CI failed; the author is iterating within its ceiling | working | "Fixing failing checks" | next_role: author |
| task `human-review`, PR ready, current head passed | complete | "PR ready for review" | — |
| a delegated investigation returned its result | complete | "Findings delivered" | — |
| task `merged` | complete | "Merged" | — |
| idle, nothing new in git or the answer | (unchanged) | (unchanged) | do not interrupt; reconcile later |

## Lost events

| Snapshot shows | Do |
|---|---|
| a worker now working that the record says waits on a human | keep needs-human if the human has not answered; otherwise working |
| a worker idle whose record says working | inspect its latest answer; decide by the table |
| a worker missing | the record keeps its last attention; `role_sessions` gets the replacement session when one starts, labeled fresh |
| commits or a PR the record does not know | add them; advance attention to what they support |
| a record for a task that is `merged` | complete; cleanup eligible |

Never replay missed handoffs; reach the furthest supported state directly.

## Session and watch bookkeeping

- `role_sessions.<role>`: set when a role's session starts; replace when a new session replaces it;
  keep the engine, model and effort the runtime reports.
- `wake.watches.<role>`: one persistent watch per role; register before the role's first prompt;
  cancel on retirement or cleanup and delete the key.
- `signals.<role>`: the last observation per role, overwritten each time; not a log.
