---
id: SPLIT-1
epic: settle-up
parent: null
status: spec-draft
priority: P0
size: M
cuj: [CUJ-1, CUJ-2]
guiding_docs:
  - docs/product/brief.md
  - specs/settle-up/spec.md
  - DECISIONS.md#ADR-0001
  - ARCHITECTURE.md
branch: feat/split-1-walking-skeleton
depends_on: []
owner: null
requirements: [REQ-1, REQ-3, NFR-2]
touches:
  - src/**
  - tests/**
  - migrations/**
  - deploy/**
inputs:
  - specs/settle-up/spec.md#requirements
  - DECISIONS.md#ADR-0001
  - { name: first deploy stage, kind: service }
  - { name: first-stage deploy credential, kind: secret }
risk: { level: high, irreversible: false, reasons: [first pass through the real pipeline, proves the one-way ADR-0001] }
evaluator:
  - { kind: tests, ref: the project's test command }
  - { kind: script, ref: harness trace . --strict }
  - { kind: agent-review, ref: evaluator }
  - { kind: human, ref: code-owner }
budget: { max_turns: 200, max_usd: 6, max_minutes: 150 }
---

# SPLIT-1 · Walking skeleton: one household's bill, read only through its link

<!-- From skills/planning-work/references/skeleton-task-template.md. Fictional sample data. -->

## Context
Tests the riskiest assumption (A3: link access can keep households apart) and the one-way ADR-0001
before any feature work: one bill saved through the real datastore by one household, read through
that household's link, and refused to every other household, built once and deployed to the first
stage. AC-3 is ADR-0001's tenancy probe. Every other task depends on this one.

Risk high: never dispatched unattended. It lands on `main` (no `lands_to`), so the first deploy runs
from the protected branch; the schema it creates (household, member, bill, share, link with
`revoked_at`) is the data model sketch in ARCHITECTURE.md.

## Acceptance criteria (EARS)
- AC-1 — When an organiser saves a bill, the ledger shall add each member's even share to their balance. (REQ-1)
- AC-2 — When a housemate opens a valid household link, the app shall show that household's bills and the housemate's balance. (REQ-3)
- AC-3 — If a request carries one household's link, then every list endpoint shall return no rows of another household. (NFR-2)
- AC-4 — When a change merges, the pipeline shall deploy the one built artifact to the first stage by its digest. (REQ-1)
- AC-5 — While the first stage runs that artifact, the readiness probe shall report the datastore and configuration healthy. (REQ-1)

## Open questions
- [x] Which stage is first? → the shared staging stage (dana, 2026-10-13)

## Agent log (append-only, newest last)
- 2026-10-13 planner — planned as the walking skeleton; status spec-draft
