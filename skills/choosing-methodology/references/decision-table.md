# Decision table: size × risk × repo state × work type

Read top to bottom; the first matching row wins.

| # | Work type | Repo state | Risk | Size | Mode | Why |
|---|---|---|---|---|---|---|
| 1 | content pipeline: sequential stages, a human edits between them, no branching | any | any | any | icm-pipeline | stage contracts with section-level inputs keep each stage's context small and give a human an edit point; frameworks keep the edge on concurrency and branching |
| 2 | content pipeline that branches automatically or needs concurrency | any | any | any | spec-driven | icm-pipeline cannot branch mid-pipeline; express stages as tasks with `depends_on` |
| 3 | code | any | high or irreversible | any | research-plan-implement | a human approves the research and the plan before code; a bad plan line becomes many bad code lines |
| 4 | code | existing | medium | M–XL | research-plan-implement | unfamiliar or deep change in a mature codebase; context compacted into notes between phases |
| 5 | code | existing | low–medium | XS–S | spec-driven, lightest entry | one task citing an existing requirement plus a regression criterion; research would be ceremony |
| 6 | code | existing | low | M–XL | spec-driven | clear behavior, team review, unattended agents allowed within caps |
| 7 | code | greenfield | low | any, with strong backpressure (tests, types run every iteration) and a prioritized fix plan | ralph-loop | fresh session per iteration, one item each, gated by backpressure; good for an overnight grind |
| 8 | code | greenfield | low | any, weak backpressure | spec-driven | without tests and types the loop has nothing to stop it |
| 9 | code | greenfield | medium | any | spec-driven | criteria and an evaluator before review |
| 10 | anything not above | — | — | — | spec-driven (default) | the shared default |

## Additional conditions

| Condition | Effect |
|---|---|
| no expert human available to review research and plans | research-plan-implement degrades; prefer spec-driven with a stronger evaluator |
| the work is open exploration with no deliverable yet | none of the four; a delegated investigation (runtime engagement `delegated-work`) that returns a result, then pick a mode |
| a one-line fix | spec-driven at its lightest; do not run the full planning pipeline |
| the project's run records show one mode losing on this kind of task | switch per `switching.md` |

## What the four axes mean

- **Size:** the task's `size` (XS, S, M, L, XL). XL is split before it is ready, whatever the mode.
- **Risk:** the task's `risk`; `irreversible: true` counts as high.
- **Repo state:** greenfield = the change defines the structure; existing = it must fit structure,
  conventions and dependents that already exist.
- **Work type:** code (verified by tests and types) or a content pipeline (verified by a human
  reading each stage's output).
