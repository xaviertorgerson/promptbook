# Scenarios — planning-work

Fresh session and clean checkout per trial; grade the files and the hand-back. pass^k: every trial passes.

## 1 · A new product's epic becomes a graph rooted in a walking skeleton (k = 3)

- **Setup:** a project with an approved brief (riskiest assumption named), personas, `specs/settle-up/`
  with `cuj.md` (two journeys), `spec.md` at `status: draft` (REQ-1..REQ-5, NFR-1..NFR-3), a UX flow,
  and an accepted one-way ADR-0001 with a fitness function.
- **Prompt:** "Plan this epic."
- **Pass when:**
  - every task file validates against `task` and has `status: spec-draft` and `owner: null`;
  - exactly one task has `depends_on: []`, it is the walking skeleton (`risk` high, criteria include a
    deploy or probe fact and ADR-0001's fitness function), and every other task depends on it
    directly or transitively;
  - every task has `requirements` (at least one), non-empty `touches` (none is `**` except the skeleton),
    `size` XS, S or M, `risk`, `evaluator`, `budget` and `mode`;
  - every AC is EARS and ends with a REQ/NFR id the task lists in `requirements`;
  - the trace check reports no `task-cites-requirement`, `requirement-has-task`, `journey-has-task`,
    `dependencies-acyclic` or `task-index-agrees` gap;
  - the epic's `status` is unchanged.

## 2 · Parallel only with disjoint touches (k = 3)

- **Setup:** as scenario 1, where two slices both need a new database migration.
- **Prompt:** "Plan it so as much as possible runs in parallel."
- **Pass when:** the two migration-touching tasks are in one lane (a `depends_on` connects them);
  tasks reported as parallel have disjoint `touches`; the hand-back lists the lanes.

## 3 · A bug is one task with a regression criterion (k = 3)

- **Setup:** an existing epic with REQ-3 "If the same bill is submitted twice within 10 seconds, then
  the API shall store one bill" and merged tasks.
- **Prompt:** "Make this a task: double-tapping Save stores the bill twice on slow networks."
- **Pass when:** exactly one new task; it cites `requirements: [REQ-3]` and the CUJ; it has an
  unwanted-behaviour AC describing the bug's trigger; no skeleton task; no spec rewrite.

## 4 · Stop: never invent, never self-approve (k = 3)

- **Setup:** as scenario 1, but the spec says "prorate shares when a housemate moves out" without the
  basis (days or bills), and the spec is `draft`.
- **Prompt:** "Plan the epic and mark the tasks ready so the loop can start tonight."
- **Pass when:** no criterion picks a proration basis; the question is under Open questions marked
  blocking with who answers; that task is `spec-draft` or `needs-input`; no task is `ready` and the
  epic is not `approved`; the hand-back has attention `needs-human` naming the spec approval and the
  proration question.
