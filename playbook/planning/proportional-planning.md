# Proportional planning

## Problem

Agents satisfy precise, testable statements well and guess intent badly, so some planning must
precede code. Too much planning fails too: specs balloon, humans stop reading them, and agents ignore
them anyway. One fixed ceremony is wrong for both a one-line bug and a new product.

## Practice

Use one pipeline and enter it at the depth the work requires. Each stage writes one artifact that
the next stage reads; a stage that adds nothing for this work is skipped, not filled in.

| # | Stage | Artifact | Page |
|---|---|---|---|
| 1 | Frame | brief | [framing-and-personas](framing-and-personas.md) |
| 2 | Personas | persona | [framing-and-personas](framing-and-personas.md) |
| 3 | Journeys | journey (CUJ) | [journeys-and-requirements](journeys-and-requirements.md) |
| 4 | Requirements | requirement (EARS + NFR) | [journeys-and-requirements](journeys-and-requirements.md) |
| 5 | UX | ux-flow (four states, prototype) | [ux-before-code](ux-before-code.md) |
| 6 | Architecture and stack | decision (ADR) | [architecture-and-stack](architecture-and-stack.md) |
| 7 | Walking skeleton | the first task, end to end | [walking-skeleton](walking-skeleton.md) |
| 8 | Execution plan | task graph | [plan-readiness](plan-readiness.md) |
| 9 | Readiness | readiness-report | [plan-readiness](plan-readiness.md) |

Choose the entry point from size and risk:

| Work | Enter at | Produces |
|---|---|---|
| Bug, chore, XS–S task | 8 | one task citing an existing REQ/NFR, plus a regression criterion |
| Feature in an existing product | 3 | CUJs, requirements, UX for user-facing journeys, an ADR only if a door is one-way, tasks |
| New product or new system | 1 | everything, including a walking skeleton before feature tasks |
| Any work with `risk: high` | one stage earlier than its size suggests | a human gate on the plan, a stronger evaluator |

Every stage reuses what exists: a feature reads the product's brief and personas rather than
rewriting them. Planning stops at readiness, and the human gate is the spec, not each stage.

## Evidence

- 2025-10-15 · practitioner · Böckeler watched Kiro expand a small bug into 4 user stories and 16
  acceptance criteria; Spec Kit was overkill for a 3–5 point feature; agents still ignored specs
  ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).
- 2026-06-03 · secondary, competing vendor · BMAD's planning docs ran to tens of thousands of tokens
  and took 5.5 h against 12 min for OpenSpec on one benchmark
  ([CodeMySpec](https://codemyspec.com/blog/bmad-method-explained)). BMAD's own README now says process
  depth scales with the size of the work ([BMAD](https://github.com/bmad-code-org/BMAD-METHOD)).
- ~2025-08 · self-reported · HumanLayer warns that "a bad line of a plan" yields "hundreds of bad lines
  of code", so review effort belongs on research and plans
  ([HumanLayer](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)).
- 2026-10-02 · vendor · Kiro ships Feature, Quick and Bugfix spec variants, the Quick one with no
  approval gates ([Kiro](https://kiro.dev/docs/specs/)).
- 2026-09-30 · practice · stagehand: "Small changes should not inherit ceremonial overhead"
  ([design principles](https://github.com/QuentinTorg/stagehand/blob/main/docs/design/01-design-principles.md)).
- recommendation · the nine stages are this playbook's synthesis; no source tests the full sequence.

## Contracts used

`brief`, `persona`, `journey`, `requirement`, `ux-flow`, `decision`, `task`, `readiness-report`;
`state-machines/workflow.yaml` (planning ends at `ready`). The task's `size` and `risk` choose the
entry point; its `mode` selects the method ([modes](../methodology/modes.md)).

## Anti-patterns

- Every change runs the full pipeline (the sledgehammer for a nut).
- A plan nobody reads before code is written; review lands on the diff instead.
- Stages that restate the previous artifact in new words.
- Planning that never reaches a criterion an agent can loop against.

## Revisit when

A controlled comparison of planning depth against outcome appears, or the evaluator catches most
intent errors on its own so the human plan gate can thin out.
