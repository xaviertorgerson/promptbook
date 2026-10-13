# Attention map (from the harness `attention` machine 1.0.0)

Columns: the signal value as the source writes it · suggested attention (— means none until you
inspect) · reconcile action · note. `signals.<role>.source` takes the value in the heading.

The `source` values (`herdr`, `a2a`, `mcp-tasks`, `claude-headless`, `codex-exec`, `ci`, `other`) are
the contract's own enum; use `other` for any runtime not listed. Engine specifics: `engine-notes.md`.

Reconcile: **inspect** = read the latest answer and artifacts, then decide · **record** = the signal
is the evidence · **ignore** = no change.

## Terminal multiplexer agent state (`source: herdr`, or `other` for another multiplexer)

| Value | Attention | Reconcile | Note |
|---|---|---|---|
| working | working | ignore | do not redispatch or interrupt |
| blocked | needs-human | inspect | input, approval or a decision is needed; find the actual prompt; never answer it |
| done | — | inspect | finished and unseen; read the answer: complete, working (a handoff) or needs-human |
| idle | — | inspect | finished or waiting, and seen; same as done |
| unknown | — | inspect | the runtime lost certainty; not a stop |
| lost-events notice | — | snapshot | resubscribe; reconcile from a snapshot plus the records |

## Remote agent task state (`source: a2a`)

| Value | Attention | Reconcile | Note |
|---|---|---|---|
| TASK_STATE_UNSPECIFIED | — | inspect | |
| TASK_STATE_SUBMITTED, TASK_STATE_WORKING | working | ignore | |
| TASK_STATE_INPUT_REQUIRED | needs-human | inspect | a human (or the grant holder) answers, never a guess |
| TASK_STATE_AUTH_REQUIRED | needs-human | record | credentials are always a human action |
| TASK_STATE_COMPLETED | — | inspect | the remote task only; read its artifacts; the local status is unchanged |
| TASK_STATE_FAILED | needs-human | inspect | decide retry, re-plan or park |
| TASK_STATE_CANCELED | — | inspect | who canceled it decides what follows |
| TASK_STATE_REJECTED | needs-human | record | the remote agent declined the work |

## Tool-call task state (`source: mcp-tasks`)

| Value | Attention | Reconcile | Note |
|---|---|---|---|
| working | working | ignore | |
| input_required | needs-human | inspect | waiting for elicitation or sampling; a human answers unless a grant covers it |
| completed | — | inspect | one tool call of the run, not the task |
| failed | — | inspect | the agent may recover itself; inspect before raising |
| cancelled | — | inspect | |

## Headless run result (`source: claude-headless`, `codex-exec`, or `other`; also `run-record.subtype`)

| Value | Attention | Reconcile | Note |
|---|---|---|---|
| success | — | inspect | complete only if the task advanced and there were no permission denials |
| ceiling: max turns (`error_max_turns`) | needs-human | record | re-plan or raise the budget; never retry blindly |
| ceiling: max budget (`error_max_budget_usd`) | needs-human | record | |
| crash or cancel (`error_during_execution`) | needs-human | inspect | cost fields may be zero |
| no valid structured return (`error_max_structured_output_retries`) | needs-human | record | treat the return as missing |
| permission denials > 0 (derived) | needs-human | record | each denial is a question for a human |
| no parseable result (derived) | needs-human | record | |

## Runner's verdict on a run (`run-record.outcome`; record under `source: other`)

| Value | Attention | Reconcile | Note |
|---|---|---|---|
| advanced | — | inspect | the task left ready/in-progress; its status says what comes next |
| stalled | needs-human | record | the task did not move, or another was claimed; the loop stops |
| failed | needs-human | record | |

## CI check (`source: ci`)

| Status / conclusion | Attention | Reconcile | Note |
|---|---|---|---|
| queued, in_progress, requested, pending | working | ignore | |
| waiting | working | ignore | an environment approval is a human gate owned by the workflow, not attention |
| success | — | inspect | evidence for the checks-green guard; the actor still commits the transition |
| neutral, cancelled, stale | — | inspect | stale: rerun |
| skipped | — | inspect | a skipped required check is not a pass |
| failure, timed_out | working | inspect | the author iterates; needs-human only at its ceiling |
| action_required | needs-human | record | |

## Workflow statuses a human must act on (read from the task file, not a signal)

`human-review`, `needs-input` and `blocked` are statuses, not signals. For the record:
`needs-input` and `blocked` → needs-human with the parked reason as next_action; `human-review` →
complete for orchestration (the PR is ready; the human gate is the status itself).
