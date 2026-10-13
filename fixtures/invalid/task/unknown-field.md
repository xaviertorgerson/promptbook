---
id: BILL-3
epic: rating-engine
status: ready
priority: P1
cuj: CUJ-2
guiding_docs: []
branch: feat/bill-3-idempotent-rerate
depends_on: []
owner: null
assignee: alice
---

# BILL-3 · Make re-rating idempotent

## Context
"assignee" is not a task field: the claim lock is owner. A typo here would silently bypass claiming.

## Acceptance criteria (EARS)
- AC-1 — When a rerate is requested for an already-rated period, the rating engine shall replace that period's line items atomically.

## Open questions

## Agent log (append-only, newest last)
