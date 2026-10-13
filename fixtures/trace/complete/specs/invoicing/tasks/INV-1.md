---
id: INV-1
epic: invoicing
status: review
priority: P1
size: S
cuj: CUJ-1
guiding_docs:
  - specs/invoicing/spec.md
  - DECISIONS.md#ADR-0001
branch: feat/inv-1-download
depends_on: []
owner: coder-agent
requirements: [REQ-1, NFR-1]
---

# INV-1 · Download an invoice

## Context
The owner's download path (CUJ-1).

## Acceptance criteria (EARS)
- AC-1 — When an owner requests an invoice PDF, the API shall return it with its stored total.
- AC-2 — If the invoice belongs to another tenant, then the API shall return 404.

## Open questions

## Agent log (append-only, newest last)
- 2026-10-12 coder-agent — draft PR open; status → review.
