---
epic: rating-engine
status: approved
priority: P1
size: L
business_value: 5
initiative: monetization
owner: maria
---

# Epic: Rating engine

- **Owner / date:** maria · 2026-10-01
- **CUJs:** [`cuj.md`](cuj.md)  ·  **ADRs:** ADR-0012
- **Rationale (value vs effort):** turns metered usage into revenue; P1 despite L.

## Problem / motivation
Aggregated usage exists per account, but nothing turns it into money.

## Scope
**In:** rate usage against plans; emit line items. **Out:** invoices, tax.

## Requirements

| # | Requirement (one behavior) | Module it touches | Verified by | CUJ |
|---|---|---|---|---|
| REQ-1 | When a period is marked aggregated, the rating engine shall rate it against the account's active plan. | `core/rating` | unit test | CUJ-1 |
| REQ-2 | Re-rating an already-rated period produces no duplicate line items. | `core/rating` | idempotency test | CUJ-2 |

### Non-functional

| # | Category | Requirement | Measure | ADR |
|---|---|---|---|---|
| NFR-1 | performance | Rating a period of 10k usage records completes quickly. | p95 < 2 s on one worker | ADR-0012 |

## Tasks

| Task | Title | CUJ | Priority | Depends on |
|---|---|---|---|---|
| [`BILL-1`](tasks/BILL-1.md) | Scaffold the rating module | CUJ-1 | P1 | — |

## Acceptance (epic Definition of Done)
All REQ and NFR verified · every task merged · harvest: none, single-domain learnings only.
