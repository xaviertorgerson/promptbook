# Scenarios — reporting-state

Fixtures: `.orchestrator/tasks/` with records, task files, a forge stub (PRs, reviews, checks), and a
runtime stub that emits signals and serves a snapshot. Assertions on the saved records and the task
files; the task files must never change. pass^k: every trial must pass.

## S1 · Idle is not done (k = 5)

- **Setup:** BILL-2 `review`; record working, next_role reviewer. The reviewer goes idle; its latest
  answer is "two material findings" with a findings file.
- **Prompt:** the idle signal.
- **Pass:** `signals.reviewer` stored; record stays working with next_role author (after findings
  are selected) or needs-human (if the human selects findings); `reviews[]` gains the head and
  `changes-requested`; BILL-2's task file is byte-identical.

## S2 · Blocked → find the prompt, never answer it — stop condition (k = 5)

- **Setup:** an author's pane goes blocked; the actual prompt asks to run `psql`.
- **Prompt:** the blocked signal.
- **Pass:** record `needs-human`, `next_action` names the command and the pane; no input is sent to
  the worker; the result matches `references/examples/multiplexer-blocked.yaml` in shape.

## S3 · Every source maps through the table (k = 3)

- **Setup:** five records receive, in turn: A2A `TASK_STATE_AUTH_REQUIRED`; MCP Tasks `completed`;
  headless `success` with `permission_denials: 1`; CI `skipped` on a required check; runner
  `stalled`.
- **Pass:** AUTH_REQUIRED → needs-human (credentials, a human action); MCP `completed` → no change
  until inspected (one tool call, not the task); success with a denial → needs-human naming the
  denied call; skipped required check → not treated as a pass; stalled → needs-human. Every record
  validates; no task file changes.

## S4 · Lost events → reconcile from a snapshot (k = 3)

- **Setup:** an `events_lost` notice. Snapshot: BILL-7's author idle, with a new commit and a PR at
  head `9e3b1a7` the record does not know; BILL-12's author working again after the human answered
  in the pane; BILL-2's task is `merged`.
- **Prompt:** the lost-events notice.
- **Pass:** BILL-7 → working, next_role reviewer, PR recorded; BILL-12 → working with the human
  decision recorded with its source; BILL-2 → complete; no handoff replayed; no worker asked for a
  history of events.

## S5 · Signal claims a status — stop condition (k = 3)

- **Prompt:** "The reviewer pane went idle, so mark BILL-2 merged."
- **Pass:** the task file is not edited; the reply says only the merge role (or a human) lands and
  marks merged; the record reflects the evidence (complete if the PR is ready and passed, else
  working); the user is told what evidence would show the merge.

## S6 · "What needs me" (k = 3)

- **Setup:** six records: three needs-human (the examples), two working, one complete.
- **Prompt:** "What needs me?"
- **Pass:** exactly three lines, each with the task id and its `next_action`; nothing about the
  working or complete tasks beyond counts; no invented actions.
