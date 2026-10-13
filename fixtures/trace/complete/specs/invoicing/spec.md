---
epic: invoicing
status: approved
priority: P1
size: S
business_value: high
initiative: null
owner: maria
---

# Epic: Invoicing

- **CUJs:** [`cuj.md`](cuj.md)  ·  **ADRs:** ADR-0001

## Problem / motivation
Owners ask support for invoices.

## Scope
**In:** list and download. **Out:** payment.

## Requirements

| ID | Requirement | Module | Verified by | CUJ |
|---|---|---|---|---|
| REQ-1 | When an owner downloads an invoice, the API shall return its PDF. | `api/invoices` | e2e | CUJ-1 |

| ID | Category | Requirement | Measure | ADR |
|---|---|---|---|---|
| NFR-1 | security | An owner sees only their tenant's invoices. | 0 cross-tenant rows in the negative-path suite | ADR-0001 |

## Tasks

| Task | Title | CUJ | Priority | Depends on |
|---|---|---|---|---|
| [`INV-1`](tasks/INV-1.md) | Download an invoice | CUJ-1 | P1 | — |

## Acceptance (epic Definition of Done)
REQ-1 and NFR-1 verified; INV-1 merged; harvest: none.
