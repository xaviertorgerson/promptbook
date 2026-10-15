---
id: SPLIT-2
epic: settle-up
parent: null
status: integrated
priority: P1
size: S
cuj: CUJ-1
guiding_docs:
  - specs/settle-up/spec.md
  - docs/ux/settle-up.md#ux-1
  - DECISIONS.md#ADR-0002
branch: feat/split-2-save-once
lands_to: integration/settle-up
depends_on: [SPLIT-1]
owner: tally-coder
requirements: [REQ-2, REQ-6, REQ-7, NFR-1]
touches:
  - src/bills/**
  - src/web/bills/**
  - migrations/**
  - tests/bills/**
inputs:
  - specs/settle-up/spec.md#requirements
  - docs/ux/settle-up.md#ux-1
  - { name: bill table and its migration, kind: file, ref: migrations/0001_skeleton.sql, provided_by: SPLIT-1 }
risk: medium
evaluator:
  - { kind: tests, ref: the project's test command for src/bills }
  - { kind: script, ref: promptbook trace . --strict }
  - { kind: agent-review, ref: evaluator }
budget: { max_turns: 100, max_usd: 3, max_minutes: 90 }
sessions:
  - { engine: claude, session_id: 2b8e47d1-90c3-4a5f-b6e2-71d4c0a9f358, actor: tally-coder, role: coder, started_at: "2026-10-15T08:01:00Z", ended_at: "2026-10-15T08:31:00Z", outcome: advanced, run: .agent/loop-runs.jsonl }
  - { engine: claude, session_id: 5c03a9e8-1f2d-4b67-8e90-a3b5d7c1e246, actor: tally-coder, role: coder, started_at: "2026-10-15T09:04:00Z", ended_at: "2026-10-15T09:24:00Z", outcome: advanced, run: .agent/loop-runs.jsonl }
  - { engine: claude, session_id: 8d1e6f20-4a7b-4c3d-9e5f-0b2a8c6d4e71, actor: tally-coder, role: coder, started_at: "2026-10-15T10:09:00Z", ended_at: "2026-10-15T10:11:00Z", outcome: advanced, run: .agent/loop-runs.jsonl }
---

# SPLIT-2 · Save a bill exactly once

<!-- From Skilldex skills/planning-work/assets/task-template.task.md. Fictional sample data. -->

## Context
The save path of CUJ-1 (UX-1): a double tap or a retry on a slow network must not store a bill
twice, a failed save keeps the draft, and an invalid amount saves nothing. Shares the migrations
folder with SPLIT-3, so they form one lane and SPLIT-3 waits for this one.

## Acceptance criteria (EARS)
- AC-1 — If the same bill is submitted twice within 10 seconds, then the API shall store one bill. (REQ-2)
- AC-2 — If saving a bill fails, then the new-bill screen shall keep the entered bill as a draft and offer Retry. (REQ-6)
- AC-3 — If a bill's amount is not a positive number, then the new-bill screen shall show a field error and save nothing. (REQ-7)
- AC-4 — The bills API shall acknowledge a saved bill within 300 ms at p95 under 20 rps. (NFR-1)

## Open questions

## Working notes
- Follow-up for the planner (dispose-findings, 2026-10-15): the bills list query has no index on
  `(household_id, created_at)`; outside this task's criteria and touches, so not fixed here.

## Agent log (append-only, newest last)
- 2026-10-13 planner — planned; status spec-draft
- 2026-10-13 dana — spec approved (gate 1); status → ready
- 2026-10-15 tally-coder — claim (dispatched by the coordinator); base integration/settle-up@7e21c0b; status → in-progress
- 2026-10-15 tally-coder — draft PR #2 at a41c9e2; AC-1..AC-4 named in tests; status → review
- 2026-10-15 tally-evaluator — verdict fail on a41c9e2: AC-1, two identical submits racing both stored: .agent/verdicts/SPLIT-2-a41c9e2.md
- 2026-10-15 coordinator — dispose-findings under GRANT-1: finding 1 to the author now, finding 2 to Working notes as a follow-up
- 2026-10-15 tally-coder — iterate on finding 1; status → in-progress
- 2026-10-15 tally-coder — unique index on (household_id, idempotency_key) in migrations/0002 and a race test for AC-1; PR #2 at d8f03b7; status → review
- 2026-10-15 tally-evaluator — verdict pass on d8f03b7 (k = 2): .agent/verdicts/SPLIT-2-d8f03b7.md
- 2026-10-15 tally-coder — PR #2 marked ready: checks green, criteria met and in tests, the evaluator's pass on this head; status → human-review
- 2026-10-15 coordinator — approve-pr under GRANT-2 at d8f03b7: a forge review (the reviewer's pass, the evaluator's verdict and required checks on that head), no commit on the task branch; status → merging
- 2026-10-15 coordinator — integrated into integration/settle-up@9c4e7a1 by merge commit, merged checks green; status → integrated (this line and the one above are in the merge commit's copy of this file)
