---
id: BILL-3
epic: rating-engine
status: in-progress
priority: P1
cuj: CUJ-2
guiding_docs:
  - specs/rating-engine/spec.md
branch: feat/bill-3-idempotent-rerate
depends_on: [BILL-2]
owner: null
---

# BILL-3 · Make re-rating idempotent

## Context
In progress with no owner: the claim lock (owner + status in one commit) was half-written.

## Acceptance criteria (EARS)
- AC-1 — When a rerate is requested for an already-rated period, the rating engine shall replace that period's line items atomically.

## Open questions
- [ ] none

## Agent log (append-only, newest last)
- 2026-10-12 coder — status → in-progress.
