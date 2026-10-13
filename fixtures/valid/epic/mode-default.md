---
epic: rating-engine
status: draft
priority: P2
size: M
business_value: medium
initiative: null
owner: maria
mode: research-plan-implement
---

# Epic: Rating engine (brownfield rework)

- **Mode:** research-plan-implement — the rating path is old code nobody here wrote; tasks inherit it.

## Problem / motivation
Rating is slow and nobody knows why.

## Scope
**In:** profile and fix the rating path. **Out:** new plans.

## Requirements

| # | Requirement (one behavior) | Module it touches | Verified by |
|---|---|---|---|
| REQ-1 | The rating engine shall rate a 10k-record period in one pass over the records. | `core/rating` | unit test |

## Tasks

| Task | Title | CUJ | Priority | Depends on |
|---|---|---|---|---|

## Acceptance (epic Definition of Done)
REQ-1 verified · every task merged.
