---
id: BILL-7
epic: rating-engine
parent: null
status: review
priority: P1
size: M
cuj: [CUJ-2, CUJ-3]
guiding_docs:
  - specs/rating-engine/spec.md
  - DECISIONS.md#ADR-0012
branch: feat/bill-7-rerate-proration
depends_on: [BILL-3, BILL-4]
owner: coder-agent-2
requirements: [REQ-2, REQ-3]
touches:
  - apps/api/src/core/rating/**
risk: { level: medium, irreversible: false, reasons: [touches money paths] }
evaluator:
  - { kind: tests, ref: pnpm vitest run apps/api/src/core/rating }
  - { kind: script, ref: node scripts/ears-coverage.mjs specs/rating-engine/tasks/BILL-7.md }
  - { kind: agent-review, ref: verifying-work }
  - { kind: human, ref: code-owner }
budget: { max_turns: 120, max_usd: 4 }
sessions:
  - engine: claude
    session_id: 3f0c6c1e-6d1f-4b55-9c49-1f1f6b7b0c11
    actor: coder-agent-2
    role: coder
    started_at: 2026-10-13T09:00:00Z
    ended_at: 2026-10-13T09:41:00Z
    outcome: advanced
    run: .agent/loop-runs.jsonl
mode: spec-driven
---

# BILL-7 · Re-rate a prorated period without double-billing

## Context
A late event lands after a mid-cycle plan change. Re-rating must replace both segments' line items
atomically. Combines the replay safety of BILL-3 (REQ-2) with the split of BILL-4 (REQ-3).

## Acceptance criteria (EARS)
- AC-1 — When a rerate is requested for a prorated period, the rating engine shall replace the line items of both segments in one transaction.
- AC-2 — While a rerate of a prorated period is in progress, the rating engine shall reject a second rerate of either segment.
- AC-3 — If the plan change is withdrawn before the rerate, then the rating engine shall rate the whole period on the original plan.

## Open questions
- [x] Does a withdrawn plan change count as a change? → No; rate on the original plan (owner, 2026-10-11).

## Working notes
Base: main@4f1c2d9 · Mode: spec-driven · Risk: medium (evaluation mandatory, k = 2)

Plan
1. [x] Transactional replace of both segments — AC-1
2. [x] Row lock on the period rejects a concurrent rerate — AC-2
3. [x] Withdrawn change rates on the original plan — AC-3
4. [x] Evaluation on the current head — pass^2 on 9e3b1a7

Decisions inside scope
- Row lock, not an advisory lock: it survives a worker restart.

Outside this task (for the planner)
- The invoice preview double-counts prorations; not in `touches`.

Next: an engineer marks PR #240 ready (or a coordinator with a finalize grant).

## Agent log (append-only, newest last)
- 2026-10-13 coder-agent-2 — claimed on main@4f1c2d9; status → in-progress (session 3f0c6c1e).
- 2026-10-13 coder-agent-2 — AC-1..AC-3 implemented, tests named per criterion; draft PR #240; status → review.
- 2026-10-13 coder-agent-2 — evaluator pass on 9e3b1a7 (k = 2, different model family); handing back (session 3f0c6c1e).
