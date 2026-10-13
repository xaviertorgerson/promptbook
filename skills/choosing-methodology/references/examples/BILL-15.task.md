---
id: BILL-15
epic: rating-engine
parent: null
status: spec-draft
priority: P1
size: M
cuj: CUJ-2
guiding_docs:
  - specs/rating-engine/spec.md
  - DECISIONS.md#ADR-0012
branch: feat/bill-15-ledger-adjust
depends_on: [BILL-3]
owner: null
kickback_reason: "ralph-loop → research-plan-implement: three iterations stalled on the existing ledger module's invariants; needs a research note on how postings are reversed"
requirements: [REQ-4]
touches:
  - apps/api/src/core/ledger/**
risk: { level: high, irreversible: false, reasons: [posts money movements] }
evaluator:
  - { kind: tests, ref: npm test -- ledger }
  - { kind: agent-review, ref: reviewer }
  - { kind: human, ref: code-owner }
budget: { max_turns: 150, max_usd: 5 }
mode: research-plan-implement
---

# BILL-15 · Adjust a posted rating through a reversing entry

## Context
A re-rate must correct a posted rating without editing the posted ledger entry. The first attempt
ran as a ralph-loop and stalled three times on the ledger's append-only invariant.

## Acceptance criteria (EARS)
- AC-1 — When a re-rate changes a posted amount, the ledger shall write a reversing entry and a new entry instead of updating the posted one.
- AC-2 — If a reversing entry would make an account's balance negative, then the ledger shall reject the adjustment and record the reason.

## Open questions
- [ ] Do reversing entries carry the original posting's period or the adjustment's period? (blocking; owner)

## Working notes
Mode switched to research-plan-implement. Before `ready`: a research note on how postings are
reversed today (callers, invariants, tests), then a plan, both approved by a human. Tried under
ralph-loop: updating the posted row (violates append-only), a soft-delete flag (breaks the balance
view). Branch feat/bill-15-ledger-adjust keeps those three commits for reference.

## Agent log (append-only, newest last)
- 2026-10-12 loop — iterations 1–3 stalled on the append-only ledger invariant; draft PR opened as a record of the attempt; status → review.
- 2026-10-13 owner — respec: mode ralph-loop → research-plan-implement; branch kept; see Working notes; status → spec-draft.
