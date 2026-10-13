---
id: INV-1
epic: invoicing
status: review
priority: P1
cuj: CUJ-1
guiding_docs:
  - docs/missing-chapter.md
branch: feat/inv-1-download
depends_on: [INV-2]
owner: coder-agent
requirements: [REQ-1, REQ-9]
---

# INV-1 · Download an invoice

## Context
x

## Acceptance criteria (EARS)
- AC-1 — When an owner requests an invoice PDF, the API shall return it.
- AC-2 — If the invoice belongs to another tenant, then the API shall return 404.

## Open questions

## Agent log (append-only, newest last)
