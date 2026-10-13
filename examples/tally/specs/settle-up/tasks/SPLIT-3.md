---
id: SPLIT-3
epic: settle-up
parent: null
status: in-progress
priority: P1
size: M
cuj: CUJ-2
guiding_docs:
  - specs/settle-up/spec.md
  - docs/ux/settle-up.md#ux-2
  - DECISIONS.md#ADR-0001
  - DECISIONS.md#ADR-0003
  - DECISIONS.md#ADR-0004
branch: feat/split-3-settle-from-link
lands_to: integration/settle-up
depends_on: [SPLIT-1, SPLIT-2]
owner: tally-coder
requirements: [REQ-4, REQ-8, NFR-3, NFR-4]
touches:
  - src/household/**
  - src/ledger/**
  - src/web/household/**
  - migrations/**
  - tests/household/**
inputs:
  - specs/settle-up/spec.md#requirements
  - docs/ux/settle-up.md#ux-2
  - docs/ux/prototypes/settle-up/index.html
risk: { level: medium, reasons: [the link is the only credential for housemates] }
evaluator:
  - { kind: tests, ref: the project's test command for src/household and src/ledger }
  - { kind: script, ref: harness trace . --strict }
  - { kind: agent-review, ref: evaluator }
budget: { max_turns: 150, max_usd: 5, max_minutes: 120 }
---

# SPLIT-3 · Settle a share from a household link

<!-- From skills/planning-work/references/task-template.md. Fictional sample data. -->

## Context
CUJ-2 through UX-2: a housemate marks a share paid from the link, can undo for 24 hours, and the
page works with the keyboard alone on every browser of ADR-0004's matrix. Adds a `paid_at` migration,
so it waits for SPLIT-2 (one lane on `migrations/**`). Revocation is SPLIT-4.

## Acceptance criteria (EARS)
- AC-1 — When a housemate marks a share paid, the ledger shall set that share's balance to zero. (REQ-4)
- AC-2 — While a share was marked paid less than 24 hours ago, the household page shall offer Undo. (REQ-8)
- AC-3 — The household page shall pass the automated accessibility audit with 0 serious violations. (NFR-3)
- AC-4 — The household page shall let a housemate complete CUJ-2 with the keyboard alone. (NFR-3)
- AC-5 — The household page shall let a housemate complete CUJ-2 in every browser of the device matrix. (NFR-4)

## Open questions

## Agent log (append-only, newest last)
- 2026-10-13 planner — planned; status spec-draft
- 2026-10-13 dana — spec approved (gate 1); status → ready
- 2026-10-15 tally-coder — claim (dispatched once SPLIT-2 was integrated: same epic, and the migrations lane was free); base integration/settle-up@9c4e7a1; status → in-progress
