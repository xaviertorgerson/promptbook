---
id: EPIC-1
epic: my-epic
parent: null
status: spec-draft
priority: P0
size: M
cuj: CUJ-1                      # the riskiest journey, thinnest path through it
guiding_docs:
  - docs/product/brief.md
  - specs/my-epic/spec.md
  - DECISIONS.md#ADR-0001
  - ARCHITECTURE.md
branch: feat/epic-1-walking-skeleton
depends_on: []                  # the root: every other task in the epic depends on this one
owner: null
requirements: [REQ-1, NFR-2]    # the one behaviour it carries end to end, and the NFRs it measures first
touches:                        # broad by nature; nothing else runs until it is merged
  - src/**
  - tests/**
  - <build, deploy and probe config paths>
inputs:
  - DECISIONS.md#ADR-0001
  - { name: <first deploy stage>, kind: service }
  - { name: <deploy credential for the first stage>, kind: secret }
risk: { level: high, reasons: [first pass through the real pipeline, proves one-way ADR-0001] }
evaluator:
  - { kind: tests, ref: <the project's test command> }
  - { kind: script, ref: <criterion-coverage check for this task file> }
  - { kind: agent-review, ref: reviewer }
  - { kind: human, ref: code-owner }
budget: { max_turns: 200, max_usd: 6, max_minutes: 150 }
mode: spec-driven
---

# EPIC-1 · Walking skeleton: <the riskiest journey> end to end through the real pipeline

<!-- The thinnest real slice: one journey, one screen or endpoint, one write and read through the real
     data store and the real auth, built by real CI, deployed to the first real stage, checked by the
     real probe. No mocks of the parts that carry the risk. Its criteria are pipeline facts, not
     feature completeness. If it fails, the epic goes back to architecture. -->

## Context
Tests the riskiest assumption (<A-n from the brief>) and the one-way decisions (<ADR ids>) before any
feature work. Later tasks extend it; none may leave it broken. Its journey's smoke test runs at every
session start and in CI.

## Acceptance criteria (EARS)
- AC-1 — When <the journey's trigger>, the <system> shall <the one observable response, through the real data store>. (REQ-1)
- AC-2 — When a change merges, the build shall produce one artifact that the first stage runs by its digest. (REQ-1)
- AC-3 — While the first stage runs the artifact, the readiness probe shall report the data store and configuration healthy. (REQ-1)
- AC-4 — If <the isolation or safety condition the one-way ADR protects>, then the <system> shall <deny it>. (NFR-2)
- AC-5 — The <fitness function named in ADR-0001> shall fail any change that breaks <the decision>. (NFR-2)

## Open questions
- [ ] <question> → <who answers>

## Agent log (append-only, newest last)
- YYYY-MM-DD <actor> — planned as the walking skeleton; status spec-draft
