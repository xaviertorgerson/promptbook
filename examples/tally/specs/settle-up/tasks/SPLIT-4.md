---
id: SPLIT-4
epic: settle-up
parent: null
status: spec-draft
priority: P1
size: S
cuj: CUJ-2
guiding_docs:
  - specs/settle-up/spec.md
  - docs/ux/settle-up.md#ux-2
  - DECISIONS.md#ADR-0001
branch: feat/split-4-revoke-link
lands_to: integration/settle-up
depends_on: [SPLIT-1]
owner: null
requirements: [REQ-5, NFR-2]
touches:
  - src/links/**
  - src/web/revoked/**
  - tests/links/**
inputs:
  - specs/settle-up/spec.md#requirements
  - docs/ux/settle-up.md#ux-2
  - { name: link table with revoked_at, kind: file, ref: migrations/0001_skeleton.sql, provided_by: SPLIT-1 }
risk: { level: medium, reasons: [revocation is the only way to cut off a forwarded link] }
evaluator:
  - { kind: tests, ref: the project's test command for src/links }
  - { kind: script, ref: harness trace . --strict }
  - { kind: agent-review, ref: evaluator }
budget: { max_turns: 80, max_usd: 2, max_minutes: 60 }
---

# SPLIT-4 · Revoke a household link

<!-- From skills/planning-work/references/task-template.md. Fictional sample data. -->

## Context
The organiser revokes a link (`DELETE /links/{id}`) and anyone holding it sees UX-2's Link revoked
state with no household data, at once. The skeleton's link table already has `revoked_at` and its
resolver returns no household for a revoked link (ADR-0001), so this task adds no migration and runs
in its own lane beside SPLIT-2.

## Acceptance criteria (EARS)
- AC-1 — When an organiser revokes a household link, the API shall resolve that link to no household from the next request on. (REQ-5)
- AC-2 — If a household link has been revoked, then the app shall show the link-revoked page and no household data. (REQ-5)
- AC-3 — If a request carries a revoked link, then every household endpoint shall return no rows. (NFR-2)

## Open questions

## Agent log (append-only, newest last)
- 2026-10-13 planner — planned (split from SPLIT-3 so revocation runs in its own lane); status spec-draft
