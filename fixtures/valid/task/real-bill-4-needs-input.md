---
id: BILL-4
epic: rating-engine
status: needs-input
priority: P2
cuj: CUJ-3
guiding_docs:
  - specs/rating-engine/spec.md
  - specs/rating-engine/cuj.md
branch: feat/bill-4-proration
depends_on: [BILL-2]
owner: null
---

# BILL-4 · Prorate mid-cycle plan changes

## Context
An account changes plan mid-period (CUJ-3). The period must be split at the change date and each
segment rated on its own plan, prorated by remaining days. Gated by `rating.proration_enabled`.

## Acceptance criteria (EARS)
- AC-1 — When a plan change lands mid-period, the rating engine shall split the period at the change date.
- AC-2 — Where proration is enabled, the rating engine shall rate each segment on its own plan and prorate by remaining days.
- AC-3 — If proration is disabled, then the rating engine shall rate the whole period on the post-change plan.

## Open questions
- [ ] Proration basis — calendar days or billing days? **Blocks readiness** until billing ops decides.

## Agent log (append-only, newest last)
- 2026-06-22 example-agent — drafted from CUJ-3; the proration-basis decision (calendar vs billing days) is a genuine ambiguity I must not guess — parked with the question for the product owner; status → needs-input.
