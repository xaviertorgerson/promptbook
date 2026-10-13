---
id: SPLIT-2
epic: settle-up
parent: null
status: spec-draft
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
owner: null
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
  - { kind: script, ref: harness trace . --strict }
  - { kind: agent-review, ref: evaluator }
budget: { max_turns: 80, max_usd: 2, max_minutes: 60 }
---

# SPLIT-2 · Save a bill exactly once

<!-- From skills/planning-work/references/task-template.md. Fictional sample data. -->

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

## Agent log (append-only, newest last)
- 2026-10-13 planner — planned; status spec-draft
