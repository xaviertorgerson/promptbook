---
name: reporting-state
description: Use when a runtime signal arrives or the status view must be brought up to date — "the author pane went blocked", "the remote agent says input required", "the run hit its turn limit", "CI failed on the PR", "update the task records", "we lost events, catch up", "why is this task red", "what needs me" — mapping signals from terminal multiplexers, remote-agent task states, tool-call task states, headless run results and CI checks to attention (working, needs-human, complete), keeping each task record's summary, next role, next action, sessions and watches, and reconciling from a snapshot after lost events. A signal never changes a task's workflow status. Do not use for changing workflow status (implementing-task, landing-changes), choosing or dispatching work (orchestrating-work), or deciding whether an action is authorized (delegating-authority).
license: MIT
compatibility: Any agent runtime that can read its workers' state and git. Optional - Node 22 and the harness validator (node tools/validate.mjs --contract task-record).
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Reporting state

Turn what a runtime observed into what a human needs to know, and nothing more. Attention is the
runtime's three-value view of a task: **working** (agents have work underway, including waits on
another agent or task), **needs-human** (a specific human action is required, named), **complete**
(nothing further is needed from the human in this workflow; a PR ready for human review counts).
Attention lives in task records, returns and run records. It never lives in a task file, and no
signal ever moves a task's workflow status.

## Inputs

- The signal: its source, value, the role or worker it concerns, and when it was observed.
- The mapping in `references/attention-map.md` (from the harness `attention` machine): a suggested
  attention and a reconcile action (`inspect`, `record`, `ignore`) per source and value.
- The worker's latest answer or `return` object; the task file (status, owner, open questions, agent
  log); git and the forge (branch, PR head, reviews, checks); the run record when a run ended.
- `.orchestrator/tasks/<id>.yaml` (`task-record`), the record you maintain.

## Procedure

### On a signal

1. **Look it up** in the attention map by source and value. Unknown source or value: treat as
   `inspect` with no suggested attention.
2. **Store the observation** under `signals.<role>`: `{source, value, observed_at}` (source one of
   the contract's values; see the map for which to use). This is evidence, not a transition.
3. **Reconcile** per the map's action:
   - `ignore`: keep what you know (a worker reported working; a check is queued). Change nothing else.
   - `record`: the signal is the evidence (a ceiling hit, credentials required, an action required).
     Set the suggested attention and write `next_action`.
   - `inspect`: read the worker's latest answer and the relevant artifacts before deciding.
     Idle or done is not finished; blocked or input-required means find the actual question or
     permission (never answer it); a remote task completed is one step, not the task.
4. **Decide attention from evidence** (`references/reconcile.md`): a specific human action needed →
   `needs-human`; the request finished with nothing for the human → `complete`; otherwise `working`.
5. **Update the record** (template in `references/task-record-template.md`):
   - `state.name`: the attention.
   - `state.summary`: a specific 3–5-word phrase ("Awaiting proration decision"), ≤ 120 characters.
   - `state.next_role`: author, reviewer, evaluator, worker, workspace_agent or orchestrator while working; omit when complete.
   - `state.next_action`: one concrete step; required for needs-human, absent when complete.
   - `role_sessions.<role>`: session id, engine, model, effort when a session started or changed; a
     fresh session replacing a lost one is new, never labeled a resume.
   - `wake.watches.<role>`: the watch id when registered; remove when cancelled.
   - `reviews[]` bound to the PR head reviewed; `decisions[]` with the human's source and scope.
   - `pull_requests`, `result`, `updated_at`.
6. **Validate** if the validator is available: `node tools/validate.mjs --contract task-record <file>`.
7. **Acknowledge** the signal with the runtime once the record is saved. A duplicate or stale signal
   changes nothing and repeats nothing.

### On lost events, a restart, or "catch up"

1. Resubscribe if the runtime has a subscription.
2. Take one snapshot: live workers and their current state, pending notices, plus each active
   record's task file, branch, PR head, reviews and checks.
3. For each record, set the attention the evidence supports now (`references/reconcile.md`, Lost
   events). Do not replay the missing history or ask workers to reconstruct it; ask a worker once for
   its current result only when nothing durable shows it.
4. Save every changed record, then drain pending notices.

### When asked "what needs me"

Report from the records: one line per task that is `needs-human`, naming its `next_action`; tasks
working or complete need no line. End with "None." when nothing needs the human.

## Never

- Change `status` (or `owner`) in a task file because of a signal. Status moves only by a commit from
  the role that owns the transition, on evidence.
- Mark `complete` because a worker went idle, a remote task completed, or a check passed.
- Answer a permission prompt, supply credentials, or send approval input.
- Keep counters, phase histories or booleans in the record; keep evidence and the next action.
- Treat a worker's report of human approval as approval.

## Outputs

`.orchestrator/tasks/<id>.yaml` (`task-record` contract), archived to `.orchestrator/archive/` after
cleanup; attention on run records the runtime writes; a short "needs you" list for the human.
Examples that validate: `references/examples/`.

## Gates and stop conditions

The record goes to `needs-human` with `next_action` when: a permission or credential request is
found; a run hit a turn or spend ceiling, crashed without a result, or reported permission denials;
the runtime's ceiling for review iterations is reached; a remote agent rejected or failed the task;
evidence and record disagree in a way you cannot resolve; human authority is unclear. Escalate those
to the human; do not retry, re-dispatch or interrupt a working agent because a signal arrived.

## References

- `references/attention-map.md` — every runtime signal mapped to attention and a reconcile action.
- `references/reconcile.md` — deciding attention from evidence, including lost events.
- `references/task-record-template.md` — the record's fields with rules.
- `references/engine-notes.md` — where each runtime's signals come from (adapters own the mapping).
- `references/examples/` — task records (`*.task-record.yaml`) and run records (`runs.run-record.jsonl`) that validate against their contracts.
