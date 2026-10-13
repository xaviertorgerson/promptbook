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
Rated line items exist; nothing renders them for the customer.

## Scope
**In:** render, list, download. **Out:** payment.

## Requirements

| ID | Requirement | Module | Verified by | CUJ |
|---|---|---|---|---|
| REQ-1 | When a period's rating completes, the invoicer shall create exactly one invoice per account. | `core/invoicing` | unit test | CUJ-2 |
| REQ-2 | While an invoice is sent, the invoicer shall reject any change to its line items. | `core/invoicing` | unit test | CUJ-2 |
| REQ-3 | When an owner downloads an invoice, the API shall return a PDF whose total equals the invoice total. | `api/invoices` | e2e | CUJ-1 |

### Non-functional

| ID | Category | Requirement | Measure | Verified by | ADR |
|---|---|---|---|---|---|
| NFR-1 | performance | The invoice list loads fast for large accounts. | p95 < 300 ms for 5,000 invoices | load test | ADR-0031 |
| NFR-2 | security | An owner sees only their tenant's invoices. | 0 cross-tenant rows in the negative-path suite | permission test | — |

## Tasks

## Acceptance (epic Definition of Done)
All REQ and NFR verified.
