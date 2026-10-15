---
id: SPLIT-4
epic: settle-up
parent: null
status: in-progress
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
owner: tally-coder
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
  - { kind: script, ref: promptbook trace . --strict }
  - { kind: agent-review, ref: evaluator }
budget: { max_turns: 100, max_usd: 3, max_minutes: 90 }
sessions:
  - { engine: claude, session_id: 9f4b2c71-6e8a-4d05-a1c3-5e7f9b0d2a86, actor: tally-coder, role: coder, started_at: "2026-10-15T08:01:00Z", ended_at: "2026-10-15T08:23:00Z", outcome: stalled, run: .agent/loop-runs.jsonl }
---

# SPLIT-4 · Revoke a household link

<!-- From Skilldex skills/planning-work/assets/task-template.task.md. Fictional sample data. -->

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
- 2026-10-13 dana — spec approved (gate 1); status → ready
- 2026-10-15 tally-coder — claim (dispatched by the coordinator); base integration/settle-up@7e21c0b; status → in-progress
- 2026-10-15 tally-coder — handoff: AC-1 resolver change committed and pushed on the branch (no PR yet); `psql` on the worktree database was denied (unattended: an ask is a denial); the question is in the return; status unchanged
