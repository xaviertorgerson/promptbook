# Modes

## Problem

Each named methodology works for some work and fails for other work, and teams adopt one wholesale.
Spec-driven ceremony buries small fixes; a Ralph loop let loose in a mature codebase thrashes; a
stage pipeline cannot branch. Switching methods usually means rewriting the toolkit, because each
method brings its own files, states and gates.

## Practice

Treat a methodology as a **mode**: a swappable implementation of the same contracts. An epic sets
`mode` in its frontmatter as the default for its tasks; a task may override it. Every mode uses the
same task file, the same workflow states, the same return contract and the same invariants
([standards/engineering.md](../../standards/engineering.md)). A mode only chooses which skills load
and which extra guards apply to transitions.

| Mode | Good for | Not for | Planning entry | Skills loaded (catalog names) | Extra guards |
|---|---|---|---|---|---|
| `spec-driven` (default) | features with clear behavior, teams, unattended CI agents | one-line fixes; open exploration | journeys → readiness | writing-requirements, planning-work, implementing-task, verifying-work | spec approved before `ready`; every AC in a test name before `review` |
| `research-plan-implement` | brownfield, unfamiliar or deep changes | trivial or greenfield work | a research note, then a plan, in the task's working notes | implementing-task (keeps the research note and the living plan in the working notes; reads through the runtime's read-only explorer role), verifying-work | a human approves research and plan before `in-progress`; context compacted into the notes between phases |
| `ralph-loop` | greenfield, well-specified work with strong backpressure (tests, types), overnight grind | existing codebases; anything irreversible | one requirement per file plus a prioritized fix plan | implementing-task (one item per iteration), verifying-work | fresh session per iteration; every iteration gated by backpressure; turn, spend and no-progress caps; PR only |
| `icm-pipeline` | sequential, human-reviewed pipelines, often non-code (docs, content, research reports) | concurrency; automated mid-pipeline branching | numbered stage contracts with section-level inputs | a stage-contract skill per stage | a human may edit each stage's output before the next stage reads it |

How selection works:

1. The planner writes `mode` on the epic (the `epic` contract); a task without its own `mode` takes
   the epic's, and one with none anywhere is `spec-driven`. The validator checks both are known
   values, and the trace check reports each task's effective mode and every override.
2. The runtime (L4) reads the effective mode at dispatch, loads that mode's skill set and no other
   workflow skills, and passes the mode's guards to its gate checks.
3. The workflow state machine is shared; a mode adds guard conditions to transitions, never new
   states or transitions, and can never remove an invariant (walls, the independent evaluator for
   `risk: medium` and up, human merge).
4. Switching mode uses the transitions that exist. A `spec-draft` task just changes `mode`. A
   `ready` task's `mode` may be edited by its owner (the planner, the epic's owner or an engineer)
   before anyone claims it; that is a planning edit, not a transition. A task already claimed
   changes mode only through review: it opens its draft PR (`open-draft`, → `review`) with the work
   so far, then a human kicks it back (`respec`, → `spec-draft`) with a `kickback_reason` naming the
   old mode, the new one and why.

Not to be confused with a runtime's engagement kind (development, reviewer-only, delegated,
workspace-only), which describes who is engaged and lives in the task record.

## Evidence

- 2025-10-15 · practitioner · spec-driven: Böckeler found verbose output, heavy review, agents ignoring
  specs, and a parallel with model-driven development ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).
  Kiro and Spec Kit ship spec workflows with lighter variants ([Kiro](https://kiro.dev/docs/specs/);
  [Spec Kit](https://github.com/github/spec-kit)). No controlled evaluation found.
- ~2025-08 · self-reported · research-plan-implement: HumanLayer reports a 300k-LOC Rust fix approved
  next day and a failed 7-hour dependency removal from shallow research; it needs an expert human and
  keeps context at 40–60% ([HumanLayer](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)).
- 2025-07-14 · self-reported · Ralph loop: Huntley calls nondeterminism its weakness and would not use
  it in an existing code base ([ghuntley.com](https://ghuntley.com/ralph/)).
- 2026-03 · self-reported · ICM: anecdotes from a 52-member invite-only community, one model family,
  mostly content work, and "no controlled comparison" ([arXiv 2603.16021](https://arxiv.org/html/2603.16021)).
  Its stage contracts are consistent with the finding that instructions help and overviews do not
  ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988v1)); that is a hypothesis, not evidence.
- 2025-07-14 · controlled, vendor-run · focused prompts beat long ones on the same task (context rot), the shared
  premise of all four modes ([Chroma](https://www.trychroma.com/research/context-rot)).
- recommendation · no study separates the gains of scoped context from the gains of the human gates
  these methods add; the mode mechanism is this playbook's design.

## Contracts used

`epic` (`mode`, the default), `task` (`mode`, the override; working notes), `brief`/`journey`/
`requirement` (spec-driven), `return`, `state-machines/workflow.yaml` (guards per mode; `respec` for
a switch), `readiness-report`.

## Anti-patterns

- One mode for every task in the organization.
- A mode that adds its own states or its own task file format.
- Ralph pointed at a production codebase with no caps.
- A research note nobody reviews before the plan.

## Revisit when

A controlled comparison of any two modes on coding work appears, or the project's run records show a
mode consistently losing to another on the same kind of task.
