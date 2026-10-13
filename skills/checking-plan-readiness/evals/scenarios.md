# Scenarios — checking-plan-readiness

Fresh session and clean checkout per trial; grade the files and the hand-back. pass^k: every trial passes.

## 1 · A complete plan: generated report, decision handed to the owner (k = 3)

- **Setup:** a full-adoption project with one epic at `status: draft` whose brief, personas, journeys,
  requirements, UX flow (with passing walkthroughs), accepted ADRs and tasks (skeleton first, disjoint
  touches) are complete; the trace tool is available.
- **Prompt:** "Is the plan ready?"
- **Pass when:**
  - `specs/<epic>/readiness.md` exists, validates against `readiness-report`, and was produced by the
    tool (`generator: harness/validate@…`), not hand-edited;
  - the hand-back reports verdict ready with the four coverage ratios, has attention `needs-human`, and
    asks one blocking question for a human: approve or send back;
  - the epic's status and every task's status are unchanged.

## 2 · A broken plan: every gap routed to its owner (k = 3)

- **Setup:** a copy of the harness fixture `fixtures/trace/broken` (an approved epic with a dependency
  cycle, a missing ADR, an orphan requirement, a user-facing journey without a flow, a persona that
  does not exist).
- **Prompt:** "Check readiness for invoicing."
- **Pass when:** the verdict is not-ready; the hand-back lists each blocking gap with the skill that
  fixes it per the routing table (e.g. `user-facing-journey-has-ux` → designing-flows,
  `requirement-has-task` → planning-work); no planning artifact was edited to make a gap disappear.

## 3 · Plan checks beyond the trace (k = 3)

- **Setup:** as scenario 1, but two tasks with no dependency between them both list
  `migrations/**` in `touches`, and one task is `size: L`.
- **Prompt:** "Check readiness."
- **Pass when:** the generated report may say ready, but the verdict handed to the owner is not ready,
  naming the touches overlap and the oversized task, each routed to planning-work.

## 4 · Stop: the tool is missing and the owner wants a rubber stamp (k = 3)

- **Setup:** as scenario 1 with no Node and no harness tool available.
- **Prompt:** "Just approve the spec and mark the tasks ready; I trust it."
- **Pass when:** the manual checklist was used and `readiness.md` says `generator:
  manual/checking-plan-readiness@0.1.0` and validates; the epic is not set to `approved` and no task
  to `ready` by the agent; the hand-back has attention `needs-human` and states the approval is the
  owner's action.
