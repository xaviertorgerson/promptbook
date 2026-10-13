---
id: EPIC-2                      # <PREFIX>-<n>: stable, never reused; equals the file name
epic: my-epic                   # the folder under specs/
parent: null                    # a parent task id for a subtask, else null
status: spec-draft              # stays spec-draft until the owner approves the spec
priority: P2                    # P0 · P1 · P2 · P3
size: S                         # XS · S · M; L and XL are split before ready
cuj: CUJ-1                      # one id, or a list [CUJ-1, CUJ-2]
guiding_docs:                   # read before coding: the task's context contract
  - specs/my-epic/spec.md
  - DECISIONS.md#ADR-0001
branch: feat/epic-2-short-slug  # one branch and one worktree per task
depends_on: [EPIC-1]            # the walking skeleton, and any task whose touches overlap
owner: null                     # null: an agent may claim it once ready
requirements: [REQ-2, NFR-1]    # the REQ/NFR ids this task implements (at least one)
touches:                        # path globs it will edit; disjoint touches may run in parallel
  - src/feature/**
  - tests/feature/**
inputs:                         # section-level paths, or named secrets, services, decisions, data
  - specs/my-epic/spec.md#requirements
  - docs/ux/my-epic.md#ux-1
risk: medium                    # low · medium · high, or {level, irreversible, reasons}
evaluator:                      # what decides "met", in order
  - { kind: tests, ref: <the project's test command for touched paths> }
  - { kind: script, ref: <criterion-coverage check for this task file> }
  - { kind: agent-review, ref: reviewer }
budget: { max_turns: 120, max_usd: 4, max_minutes: 90 }
mode: spec-driven               # spec-driven · research-plan-implement · ralph-loop · icm-pipeline
---

# EPIC-2 · <one-line imperative title>

<!-- Copy to specs/<epic>/tasks/<ID>.md and replace every <...>. The frontmatter is machine-read (the
     queue, claims, lanes); the body is what the coder builds against and the evaluator checks.
     About 30-50 lines. Check: harness validate specs/<epic>/tasks/<ID>.md. -->

## Context
<2-4 sentences: which slice of which journey this is, why now, what it unblocks. Link, don't restate.>

## Acceptance criteria (EARS)
<!-- One EARS sentence each, ending with the REQ/NFR id. At most about five. Each id appears in a test
     name "<TASK-ID> AC-n ..." before the task reaches review. -->
- AC-1 — When <trigger>, the <system> shall <observable response>. (REQ-2)
- AC-2 — If <unwanted condition>, then the <system> shall <handling response>. (REQ-2)
- AC-3 — The <system> shall <measured quality>. (NFR-1)

## Open questions
<!-- An unanswered (blocking) question keeps the task out of ready. -->
- [ ] <question> → <who answers>

## Agent log (append-only, newest last)
- YYYY-MM-DD <actor> — planned; status spec-draft
