---
id: BILL-6
epic: rating-engine
status: integrated
priority: P1
size: S
cuj: CUJ-1
guiding_docs:
  - specs/rating-engine/spec.md
branch: feat/bill-6-tier-boundaries
depends_on: [BILL-5]
owner: coder-agent-1
requirements: [REQ-1]
touches: [apps/api/src/core/rating/tiers.ts]
risk: medium
lands_to: integration/rating engine
mode: spec-driven
---

# BILL-6 · Rate usage across tier boundaries

## Context
Tier-2 landing: this task's PR targets `integration/rating-engine` under GRANT-4; it reaches `main`
when the owner merges the integration branch.

## Acceptance criteria (EARS)
- AC-1 — When a period's usage crosses a tier boundary, the rating engine shall rate each unit at the tier it falls in.
- AC-2 — If a plan has no tiers, then the rating engine shall rate every unit at the flat price.

## Open questions

## Agent log (append-only, newest last)
- 2026-10-13 orchestrator — evaluator passed 8f0a3e6; approve-pr under GRANT-4; status → merging.
- 2026-10-13 orchestrator — merged checks green on integration/rating-engine; integrate; status → integrated.
