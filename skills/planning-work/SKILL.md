---
name: planning-work
description: Use when an approved spec or epic must become task files — "plan this epic", "break it into tasks", walking skeleton first, depends_on, touches and which tasks can run in parallel, size, risk, EARS AC-n; split an XL task; make a bug a task. Do not use for building one (implementing-task).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Optional - Node 22 and the harness validator to check task files and the trace graph.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Planning work

Decompose an epic into task files that are the queue: each one a thin vertical slice an agent can
finish and prove in one focused session, ordered by `depends_on`, starting with a walking skeleton
that proves the riskiest assumption through the real pipeline. Decompose; do not design the
implementation, and never invent a criterion the spec does not support.

Typical asks: "plan this epic", "decompose into tasks", "break the spec down", "write the task
files", "what's the walking skeleton", "which tasks can run in parallel", "size these tasks", "make
this bug a task".

Hand off instead: shaping a vague idea (framing-products, mapping-journeys); writing the
requirements themselves (writing-requirements); checking the plan is complete
(checking-plan-readiness); building a task (implementing-task).

## Inputs

- `specs/<epic>/spec.md` (REQ and NFR rows; the epic's default `mode` in its frontmatter),
  `cuj.md`, `docs/ux/<epic>.md`, `DECISIONS.md` (one-way ADRs and their fitness functions), the
  brief's riskiest assumption.
- Existing tasks across `specs/*/tasks/` (ids are never reused; prefixes stay per epic).
- Contract `task`: required `id`, `epic`, `status`, `priority`, `cuj`, `guiding_docs`, `branch`,
  `depends_on`, `owner`; optional `parent`, `size`, `requirements`, `touches`, `inputs`, `risk`,
  `evaluator`, `budget`, `mode`, `lands_to`; sections Context, Acceptance criteria, Open questions,
  Agent log.
  Templates: `references/task-template.task.md`, `references/skeleton-task-template.task.md`.

## Procedure

1. **Size the work.**

   | Work | Tasks |
   |---|---|
   | Bug | One task citing the REQ/NFR it violates (`requirements:`), the CUJ it breaks, and a regression criterion (an unwanted-behaviour AC describing the bug's trigger). No skeleton. |
   | Chore | One task citing the REQ/NFR it serves. No skeleton. |
   | Feature inside a proven skeleton | Two to six tasks; no skeleton unless the feature crosses a new one-way ADR. |
   | New product, or a new one-way door | A walking skeleton first, then feature tasks that all depend on it. |
   | `risk: high` anywhere | Plan one stage earlier than size suggests; a human evaluator on those tasks. |

2. **Cut the walking skeleton** (`references/task-graph.md`): the thinnest slice of the riskiest
   journey that runs through every real piece, including the data store, auth, build, deploy to
   the first stage, health probe and the one-way ADRs, using no mocks of the risky parts. Its criteria are
   pipeline facts (built once, deployed, health green, the journey passes in a browser) plus the
   fitness functions the ADRs name. `risk: high`; every other task `depends_on` it.
3. **Slice the rest vertically**: one observable behaviour of one journey per task, through every
   layer it needs, rather than one layer across many behaviours. Each task cites the REQ/NFR ids it
   implements in `requirements` (at least one) and the journey(s) in `cuj`. A task that serves no
   journey is scope creep: leave it out and say so.
4. **Size for one focused session.** About five criteria at most, one reviewable change, one CUJ
   slice. `size` L or XL is split before it can be `ready`, not after it stalls.
5. **Fill the harness fields** (`references/task-fields.md`):
   - `touches`: path globs it will edit, including shared hot spots (lockfiles, migrations,
     route tables). Never empty; never `**`.
   - `inputs`: section-level paths (`specs/<epic>/spec.md#requirements`) or
     `{name, kind, ref, provided_by}` for a secret, service, decision or dataset it needs first.
   - `risk`: low | medium | high, or `{level, irreversible, reasons}`; money, personal data,
     auth and irreversible actions are high.
   - `evaluator`: ordered checks that decide "met": tests and the criterion-coverage script
     always; a separate reviewing agent from medium risk; a human for high risk.
   - `budget`: `{max_turns, max_usd, max_minutes}` for the whole task, from size and risk.
   - `mode`: only where the task differs from the epic's `mode` (the spec's frontmatter; absent
     means spec-driven); research-plan-implement for deep changes in unfamiliar code; never
     ralph-loop for high risk or an existing codebase (choosing-methodology owns the choice).
   - `lands_to`: only when the epic lands through an integration branch (`integration/<epic>`);
     the task then goes `merging` → `integrated`, and `merged` when a human merges that branch.
6. **Write the criteria**: AC-1…AC-n restating only the requirements this task implements, one
   EARS sentence each ending with the REQ/NFR id; UI tasks name the states the flow designed. Each
   AC id will appear in a test name `<TASK-ID> AC-n …`.
7. **Never invent.** An unknown the spec does not answer goes to Open questions as
   `- [ ] (blocking) <question> → <who answers>`. A blocking question keeps the task out of `ready`;
   when a decision is required, the task is `needs-input`.
8. **Order and find lanes.** Set `depends_on` so the graph has no cycle and the skeleton is the
   root. Two tasks with no dependency path between them may run in parallel only when their `touches`
   are disjoint (the overlap rule is in `references/task-graph.md`); overlapping tasks form one lane,
   so add a `depends_on` between them.
9. **Write every task at `status: spec-draft`, `owner: null`**, and fill the spec's Tasks table
   (Task, Title, CUJ, Priority, Depends on) so its CUJ column matches each task's `cuj`. Do not
   change the epic's status.
10. **Validate.** If `harness validate` is available, run it on `specs/<epic>/tasks/` and then
    `--trace <root>` (in a harness checkout: `node tools/validate.mjs …`). Fix `task-cites-requirement`,
    `requirement-has-task`, `journey-has-task`, `task-exists`, `dependencies-acyclic` and
    `task-index-agrees` here; hand the plan to checking-plan-readiness.
11. **After the owner approves the spec** (never before), move each task with no blocking question
    from `spec-draft` to `ready` in one commit per epic. Deferred slices go to the project's
    deferred-work list with a promotion trigger, not into low-priority tasks.

## Outputs

- `specs/<epic>/tasks/<ID>.md` (contract `task`), all `spec-draft`; the spec's Tasks table.
- A hand-back: the graph (skeleton first), the parallel lanes, the open questions with their owners,
  and anything left out as scope creep.

## Gates and stop conditions

- **The spec gate is the owner's.** Tasks stay `spec-draft` until the owner moves the epic to
  `approved`; never set `ready` on your own judgement, and never mark the epic approved.
- **Stop (needs-human)** when the walking skeleton cannot be cut because a one-way ADR is still
  `Proposed`; when a slice needs a requirement that does not exist (send it to writing-requirements);
  when a criterion would need a number or a decision the spec does not give.
- A plan whose skeleton fails goes back to choosing-architecture, not forward into features.

## References

- `references/task-template.task.md` — a feature task, ready to fill; validates against `task`.
- `references/skeleton-task-template.task.md` — the walking-skeleton task, ready to fill.
- `references/task-fields.md` — each harness field, with risk → evaluator and size → budget tables.
- `references/task-graph.md` — skeleton cutting, vertical slicing, the session-size test, the
  touches-overlap rule and lanes, and the Tasks table.
