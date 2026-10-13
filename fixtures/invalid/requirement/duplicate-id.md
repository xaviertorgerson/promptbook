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
R2 and REQ-2 normalize to the same id: a task citing REQ-2 would be ambiguous.

## Scope
**In:** render.

## Requirements

| # | Requirement (one behavior) | Module it touches | Verified by |
|---|---|---|---|
| R1 | Create one invoice per account per period. | `core/invoicing` | unit test |
| R2 | Reject changes to a sent invoice. | `core/invoicing` | unit test |
| REQ-2 | Render the invoice as a PDF. | `core/invoicing` | snapshot test |

## Tasks

## Acceptance (epic Definition of Done)
All Rn verified.
