---
id: SPLIT-3
epic: settle-up
parent: null
status: spec-draft
priority: P1
size: M
cuj: CUJ-2
guiding_docs:
  - specs/settle-up/spec.md
  - docs/ux/settle-up.md#ux-2
  - DECISIONS.md#ADR-0001
  - DECISIONS.md#ADR-0003
branch: feat/split-3-settle-from-link
depends_on: [SPLIT-1, SPLIT-2]
owner: null
requirements: [REQ-4, REQ-5, REQ-8, NFR-3]
touches:
  - src/household/**
  - src/links/**
  - src/ledger/**
  - migrations/**
  - tests/household/**
inputs:
  - specs/settle-up/spec.md#requirements
  - docs/ux/settle-up.md#ux-2
  - docs/ux/prototypes/settle-up/index.html
risk: { level: medium, reasons: [the link is the only credential for housemates] }
evaluator:
  - { kind: tests, ref: the project's test command for src/household and src/links }
  - { kind: script, ref: criterion coverage for specs/settle-up/tasks/SPLIT-3.md }
  - { kind: agent-review, ref: reviewer }
budget: { max_turns: 150, max_usd: 5, max_minutes: 120 }
mode: spec-driven
---

# SPLIT-3 · Settle a share from a household link

<!-- From skills/planning-work/references/task-template.md. Fictional sample data. -->

## Context
CUJ-2 through UX-2: a housemate marks a share paid from the link, can undo for 24 hours, and a
revoked link shows nothing. Depends on SPLIT-2 because both add migrations (one lane).

## Acceptance criteria (EARS)
- AC-1 — When a housemate marks a share paid, the ledger shall set that share's balance to zero. (REQ-4)
- AC-2 — If a household link has been revoked, then the app shall show the link-revoked page and no household data. (REQ-5)
- AC-3 — While a share was marked paid less than 24 hours ago, the household page shall offer Undo. (REQ-8)
- AC-4 — The household page shall pass the automated accessibility audit with 0 serious violations. (NFR-3)
- AC-5 — The household page shall let a housemate complete CUJ-2 with the keyboard alone. (NFR-3)

## Open questions

## Agent log (append-only, newest last)
- 2026-10-13 planner — planned; status spec-draft
