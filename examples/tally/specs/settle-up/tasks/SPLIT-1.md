---
id: SPLIT-1
epic: settle-up
parent: null
status: merged
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
owner: dana
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
  - { kind: script, ref: promptbook trace . --strict }
  - { kind: agent-review, ref: evaluator }
  - { kind: human, ref: code-owner }
budget: { max_turns: 200, max_usd: 6, max_minutes: 150 }
sessions:
  - { engine: claude, session_id: 6a1f0c52-3d4b-4e8a-9f21-0c7d5b3a9e14, actor: dana, role: coder, started_at: "2026-10-14T08:35:00Z", ended_at: "2026-10-14T12:50:00Z", outcome: advanced }
  - { engine: gemini, session_id: eval-3c9a1f4-k2, actor: tally-evaluator, role: evaluator, started_at: "2026-10-14T13:06:00Z", ended_at: "2026-10-14T13:34:00Z", outcome: verdict, run: .agent/loop-runs.jsonl }
---

# SPLIT-1 · Walking skeleton: one household's bill, read only through its link

<!-- From Skilldex skills/planning-work/assets/skeleton-task-template.task.md. Fictional sample data. -->

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
- 2026-10-13 dana — spec approved (gate 1); status → ready
- 2026-10-14 dana — claim: risk high, so supervised on the workstation, never dispatched unattended; base main@0b7d4e2; status → in-progress
- 2026-10-14 dana — draft PR #1 at 3c9a1f4; AC-1..AC-5 named in tests; status → review
- 2026-10-14 tally-evaluator — verdict pass on 3c9a1f4 (k = 2): .agent/verdicts/SPLIT-1-3c9a1f4.md
- 2026-10-14 dana — PR #1 marked ready; status → human-review
- 2026-10-14 dana — approved PR #1 at 3c9a1f4 (gate 2, pr-approval; a forge review, not a commit); status → merging
- 2026-10-14 merge — landed on main@7e21c0b, merged checks green; status → merged, written by the merge on main. Staging serves the image by digest (AC-4, AC-5).
