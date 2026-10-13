---
id: BILL-2
epic: rating-engine
status: human-review
priority: P1
cuj: CUJ-1
guiding_docs:
  - specs/rating-engine/spec.md
  - specs/rating-engine/cuj.md
branch: feat/bill-2-rate-usage
depends_on: [BILL-1]
owner: example-agent
---

# BILL-2 · Rate aggregated usage against the plan rate

## Context
With the module scaffolded (BILL-1), compute real charges: read a period's aggregated usage and the
account's active plan, and emit one `LineItemRated` per rated dimension. Serves CUJ-1.

## Acceptance criteria (EARS)
- AC-1 — When a period is marked aggregated, the rating engine shall emit one `LineItemRated` per rated dimension.
- AC-2 — The rating engine shall stamp every line item with the `rate_version` it used.
- AC-3 — If the account's plan id is unknown, then the rating engine shall fail the rating and emit no line items.

## Open questions
- [ ] Tiered vs flat rates in v1? → (assume flat for this task; tiers are a follow-up in FUTURE.md)

## Agent log (append-only, newest last)
- 2026-06-22 example-agent — claimed; implemented rate() with flat plan rates; AC-3 error path done; tests green.
- 2026-06-22 example-agent — first pass complete, all EARS criteria verified; marked the PR ready-for-review; status → human-review (awaiting the human gate).
