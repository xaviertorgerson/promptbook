---
epic: invoicing
status: draft
priority: P1
size: M
business_value: high
initiative: null
owner: null
---

# Epic: Invoicing

## Problem / motivation
The NFR below has no category and no measure: "fast" cannot be tested.

## Scope
**In:** render.

## Requirements

| ID | Requirement | Module | Verified by |
|---|---|---|---|
| REQ-1 | When a period's rating completes, the invoicer shall create exactly one invoice per account. | `core/invoicing` | unit test |
| NFR-1 | The invoice list is fast. | `api/invoices` | manual check |

## Tasks

## Acceptance (epic Definition of Done)
All REQ and NFR verified.
