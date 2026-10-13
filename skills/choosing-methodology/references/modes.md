# The four modes

Every mode shares the task file, the workflow states (spec-draft → ready → in-progress → review →
human-review → merging → merged; blocked, needs-input, suspended), the return contract and the
invariants. A mode adds guards to transitions; it never adds states and never removes an invariant.

## Invariants no mode removes

- Walls: policy denies and project hooks hold in every mode.
- A human approves the spec (the plan) and production releases; merge stays human unless a grant says otherwise.
- An independent evaluator before `human-review`, mandatory for risk medium and up.
- Every acceptance criterion id named in a test before `review` (code work).
- Turn, spend and no-progress caps on every unattended run.

## spec-driven (default)

| | |
|---|---|
| Good for | features with clear behavior; teams; unattended CI agents |
| Not for | one-line fixes at full depth; open exploration |
| Planning entry | journeys → requirements → tasks → readiness, entered at the depth size and risk need |
| Skills loaded | writing-requirements, planning-work, implementing-task, verifying-work |
| Guards | spec approved before `ready`; every AC id in a test name before `review` |
| Runtime | fresh or persistent sessions; parallel tasks only with disjoint `touches` |

## research-plan-implement

| | |
|---|---|
| Good for | brownfield, unfamiliar or deep changes; any high-risk code |
| Not for | trivial or greenfield work; teams with no expert reviewer |
| Planning entry | a research note, then a plan, both in the task's Working notes |
| Skills loaded | researching-codebase, writing-living-plans, implementing-task, verifying-work (the first two are planned L3 skills; until they ship, the research and plan are written in Working notes by implementing-task) |
| Guards | a human approves research and plan before `in-progress`; context compacted into the notes between phases |
| Runtime | attended or with a human checkpoint after research and after plan; keep context at 40–60% |

## ralph-loop

| | |
|---|---|
| Good for | greenfield, well-specified work with strong backpressure (tests, types); overnight grind |
| Not for | existing codebases; anything irreversible; risk high |
| Planning entry | one requirement per file plus a prioritized fix plan |
| Skills loaded | implementing-task (one item per iteration), verifying-work |
| Guards | fresh session per iteration; every iteration gated by backpressure; turn, spend and no-progress caps; PR only, never a direct push |
| Runtime | a sequential loop; stops on the first stalled iteration |

## icm-pipeline

| | |
|---|---|
| Good for | sequential, human-reviewed pipelines, often non-code: docs, content, research reports |
| Not for | concurrency; automated mid-pipeline branching |
| Planning entry | numbered stage contracts with section-level inputs (each stage names exactly what it reads) |
| Skills loaded | a stage-contract skill per stage (project-defined) |
| Guards | a human may edit each stage's output before the next stage reads it; a stage starts only when its input exists |
| Runtime | stages as tasks chained by `depends_on`; one at a time |

## Not a mode

The runtime's engagement kind (development, reviewer-only, delegated-work, workspace-only) says who
is engaged and lives in the task record's `mode` field; it is unrelated to the task's methodology
`mode`.
