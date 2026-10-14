---
name: choosing-methodology
description: Use when choosing which mode agents work an epic or task in — spec-driven, research-plan-implement, a Ralph loop overnight, or an icm-pipeline for docs or content; "which methodology for this epic", "too much ceremony for this fix", "switch its mode". Do not use for writing the plan (planning-work).
license: MIT
compatibility: Any agent runtime. Optional - Node 22 and the harness validator for the task contract.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Choosing a methodology

A methodology is a **mode**: a swappable implementation of the same contracts. Every mode uses the
same task file, the same workflow states, the same return contract and the same invariants. A mode
only chooses which skills load and which extra guards apply to transitions. Pick one per epic as
the default and override per task only when a task's shape differs.

Typical asks: "which methodology for this", "should this be spec-driven or research-plan-implement",
"can we Ralph-loop this overnight", "this is a docs/content pipeline, not code", "switch this epic's
mode", "the spec-driven ceremony is too heavy for this fix", "this brownfield change keeps going
wrong".

Hand off instead: writing the plan's content (writing-requirements, planning-work,
mapping-journeys); dispatching the tasks once a mode is set (orchestrating-work).

## Inputs

- The epic's spec and task files (`epic`, `task` contracts): `size`, `risk` (incl. `irreversible`),
  `touches`, `evaluator`, current `mode`, `status`.
- The repository's state: greenfield (little or no code; the task defines the shape) or existing
  code (conventions, dependents, history to respect); test and type coverage of the area touched.
- The work type: code, or a content pipeline (docs, reports, research, content stages reviewed by a human).
- Who is available: an expert human to review research and plans; an attended or unattended runtime.

## Procedure

1. **Classify the work** on four axes: size (XS–S, M, L–XL), risk (low, medium, high or
   irreversible), repo state (greenfield, existing), work type (code, content pipeline).
2. **Pick the mode** from the decision table (`references/decision-table.md`). Short form:

| Work | Mode |
|---|---|
| content pipeline (docs, reports, research, content), sequential stages a human edits between | icm-pipeline |
| code, existing codebase, unfamiliar or deep change, or any risk high | research-plan-implement |
| code, greenfield, well-specified, strong backpressure (tests, types), risk low, reversible | ralph-loop (unattended allowed within caps) |
| code with clear behavior, a team or unattended agents, everything else | spec-driven (default) |
| XS–S fix with an existing requirement | spec-driven at the lightest entry: one task, a regression criterion |

   Tie-breakers: risk beats size (high risk never takes ralph-loop); existing code beats speed
   (ralph-loop is not for existing codebases); a content pipeline that branches or needs concurrency
   is not icm-pipeline; with no expert human to review research, prefer spec-driven over
   research-plan-implement.
3. **State what the mode loads and guards** (`references/modes.md`): the skills the runtime loads
   for its tasks (and no other workflow skills), the guards it adds to transitions, and the invariants
   it can never remove (walls, the evaluator's verdict on every task, human merge, human spec approval).
4. **Record it.** Set the epic's default as `mode` in the spec's frontmatter (the `epic` contract;
   absent means spec-driven) and `mode` on a task file only where the task differs (a task's `mode`
   overrides the epic's). Add one line of rationale to the spec ("mode: research-plan-implement —
   brownfield payment path, risk high"). Validate if the validator is available:
   `node tools/validate.mjs specs/<epic>/`.
5. **Hand the guards to the runtime**: the runtime reads the effective mode (the task's, else the
   epic's, else spec-driven) at dispatch, loads that mode's skill
   set and passes the guards to its gate checks (orchestrating-work).

### Switching mode mid-epic

A mode change on a task already past `spec-draft` is a kick-back, never a silent edit:

1. Let any running worker commit and write its handoff; stop it.
2. Commit the task back to `spec-draft` (a `respec`, by the owner or an engineer, from `review` or
   `human-review`) with `kickback_reason` naming the old mode, the new one and why ("ralph-loop
   thrashed on existing module boundaries; switching to research-plan-implement"). The workflow has
   no `in-progress → spec-draft` transition: an in-progress task first gets its draft PR opened
   (→ `review`) with the work so far, then the human respecs it.
3. Keep what was learned: the branch stays; the working notes keep the research and failed
   approaches; open PRs are left as drafts or closed by the human.
4. Satisfy the new mode's entry guard before `ready` again (e.g. a reviewed research note and plan).
5. A `spec-draft` task just changes `mode`. A `ready` task has no transition back to `spec-draft`:
   the owner or an engineer edits `mode` before anyone claims it (suspend it first if a claim is
   imminent), and the new mode's claim guard applies. Merged tasks keep theirs.
6. Changing the epic's `mode` changes the effective mode of every task without its own `mode`.
   Before changing it, pin the old value on tasks already claimed (their switch goes through review
   and `respec` as above); `ready` tasks follow rule 5.

## Outputs

`mode` on each task file, the epic default and rationale in the spec body, and for a switch, the
kick-back commit with its reason. No new states, no new task file format.

## Gates and stop conditions

Ask the human (`needs-human`) before: running ralph-loop on anything risk high, irreversible or in an
existing codebase; switching a task that is in review or later; choosing research-plan-implement
with no human available to approve the research and plan; any mode that would drop an invariant.
Stop and recommend a switch (to the human) when run records show a mode losing on the same kind of
task: repeated stalls, no-progress stops, or evaluator rejections of the same kind.

## References

- `references/decision-table.md` — the full size × risk × repo state × work type table with reasons.
- `references/modes.md` — per mode: good for, not for, planning entry, skills loaded, guards, runtime rules.
- `references/switching.md` — the kick-back procedure with a worked example.
- `references/examples/BILL-15.task.md` — a task after a mode switch; validates against the `task` contract.
