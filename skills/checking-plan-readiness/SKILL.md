---
name: checking-plan-readiness
description: Use when an epic's plan must be checked before the spec is approved — "is the plan ready", run the trace check, write readiness.md, find orphan requirements, journeys without tasks, parallel tasks that overlap. Do not use for fixing the gaps (planning-work) or built work (verifying-work).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Best with Node 22 and the harness validator (validate --trace --readiness); without it, the manual checklist in references/ applies.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Checking plan readiness

Decide whether an epic's plan is complete enough for its owner to approve, by running checks, not
by reading the plan and forming an opinion. The output is a readiness report, a list of what to fix
and who fixes it, and one question for the owner. You never approve the spec.

Typical asks: "is the plan ready", "check readiness", "run the trace check", "are there orphans",
"does every requirement have a task", "do any parallel tasks overlap", "write readiness.md", "can we
approve the spec".

Hand off instead: fixing the gaps it finds (the owning skill, e.g. writing-requirements or
planning-work); verifying built work (verifying-work).

## Inputs

- The project root: `docs/product/` (brief, personas), `specs/<epic>/` (spec.md, cuj.md, tasks/),
  `docs/ux/<epic>.md`, `DECISIONS.md` or `docs/adr/`, and the test files.
- Contract `readiness-report` (`specs/<epic>/readiness.md`): frontmatter `epic`, `generator`,
  optional `generated_at` and `source_commit`, `adoption` (full | legacy), `epic_status`, `verdict`
  (ready | not-ready), `counts` {error, warning, info}, `coverage` {journeys, requirements, tasks,
  criteria} each {covered, total}, `gaps[]` (rule, severity, blocks_readiness, epic, subject,
  message, file, line); sections Verdict, Coverage, Gaps. A `ready` verdict has no error and no gap
  that blocks readiness.

## Procedure

1. **Scope.** Run for one epic when its plan is complete (tasks written, spec at `draft`), again
   after every fix, and before any task moves to `ready`. A single bug task needs only the
   task-level rows of the checklist (it cites a requirement and a journey; its criteria are EARS);
   skip the report.
2. **Run the trace.** If `harness validate` is available, run
   `harness validate --trace <root> --readiness specs` (from a harness checkout:
   `node tools/validate.mjs --trace <root> --readiness <root>/specs`; add `--tests "<glob>"` when
   test files live outside the default globs). It writes `specs/<epic>/readiness.md` for every epic,
   with the project's current commit; never edit that file by hand, regenerate it. When the report
   is committed with the plan, add `--no-timestamp`: it then changes only when the plan does.
3. **Otherwise, run the manual trace** in `references/readiness-checklist.md`, part A: the same
   rules, ids, severities and blocking flags as the tool. Then write `specs/<epic>/readiness.md` from
   `references/readiness-template.readiness.md` with `generator: manual/checking-plan-readiness@0.1.0`, the
   counts and coverage you measured, and one gap per finding. Mark it plainly as manual in the Verdict.
4. **Run the plan checks the trace does not cover** (checklist part B): parallel tasks with
   overlapping `touches`; tasks of size L or XL; blocking open questions; one-way ADRs not yet
   accepted; tasks that do not reach the walking skeleton; user-facing journeys without a passing
   walkthrough; tasks missing `risk`, `evaluator` or `budget`.
5. **Look for contradictions** (checklist part C): a REQ that serves a non-goal or a Scope Out item;
   two REQs or NFRs that cannot both hold; a criterion that differs from the REQ it cites; a task or
   requirement citing a superseded ADR; the spec's Tasks table disagreeing with task frontmatter.
6. **Decide the verdict.** `ready` only when the trace has no error and no blocking gap **and**
   parts B and C found nothing blocking. A tool report can say `ready` while part B blocks; then the
   verdict you hand to the owner is not ready, and the report stays as generated.
7. **Route every finding to its owner** using the table in the checklist (orphan persona →
   defining-personas, journey without a requirement → writing-requirements, user-facing journey
   without a flow → designing-flows, NFR without a decision → choosing-architecture, task issues →
   planning-work). Do not fix them here.
8. **Hand the decision to the owner.** The verdict is evidence; approving the spec is the owner's
   gate (spec approval, never delegable). Ask once: approve the spec, or send it back with the
   named fixes.
9. **After the owner answers**: on approve, the owner sets the epic to `approved` with themselves as
   `owner`, and planning-work moves the tasks with no blocking question to `ready`. On send-back,
   the owning skills fix the gaps and this skill runs again.

## Outputs

- `specs/<epic>/readiness.md` (contract `readiness-report`), generated by the tool or written from
  the manual template.
- A hand-back with attention `needs-human`: the verdict, the coverage line, every blocking finding
  with the skill that fixes it, the plan-check and contradiction findings, and one blocking decision
  for a human: "Approve the <epic> spec?" with options approve / send back.

## Gates and stop conditions

- **Never approve the spec, never set `ready`, never mark a gap resolved by editing the report.**
  The spec gate is the owner's alone; a grant cannot delegate it.
- **Never report ready on a plan you could not check.** If an artifact fails to parse or the tests
  cannot be found, the verdict is not ready and the hand-back says what could not be checked.
- **Stop (needs-human)** at the end of every run, ready or not: the next action is always the
  owner's decision or a fix by another skill.

## References

- `references/readiness-checklist.md` — part A: the trace rules with severity and blocking flags,
  part B: plan checks, part C: contradictions, and the routing table to the owning skill.
- `references/readiness-template.readiness.md` — `readiness.md` for a manual run; validates against
  `readiness-report`.
