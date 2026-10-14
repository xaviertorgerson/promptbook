# One protocol, four runtime shapes

The procedure is identical; each runtime supplies the wake, the worker and the evidence differently.
Engine and product names live in `engine-notes.md`.

| Step | Sequential loop (one checkout, fresh session per run) | Forge-event agents (CI jobs) | Terminal multiplexer with a coordinator session | Hosted agent service |
|---|---|---|---|---|
| What wakes the coordinator | the previous run exiting | a forge event: task file set ready, PR pushed, review submitted, human approval | the multiplexer's agent-state event relayed to the coordinator; human messages | the service's task-state callback or webhook |
| Who coordinates | the loop script (code); no model turn | the workflow definitions (code) | a long-lived coordinator agent following this skill | the service's orchestrator, or your code polling nothing and resuming on webhooks |
| Workers | one headless run at a time | one job per role per event | persistent author and evaluator panes per task | remote tasks per role |
| Concurrency | 1 | jobs per event, bounded by the forge's concurrency settings and the grant | grant `max_workers` | grant `max_workers` and the service's limit |
| Persistence of a role | fresh session per run; continuity from the task file and branch | fresh job per event; continuity from the task file, branch, PR | the same session across the review loop | the service's session, resumable by id |
| Returns | headless structured output, one per run | the job's structured output; PR comments for review | the worker's normal answer, read when woken; a `return` file when asked | the remote task's artifacts |
| Run record | the loop appends one line per run | the job appends or uploads one line per run | optional; one line per measurable turn | from the service's usage report |
| Caps | turn and spend flags per run; no-progress stop after one stalled run | the same flags per job; job timeout | grant limits; per-role ceilings where the engine supports them | the service's budget settings plus grant limits |
| Evidence on wake | task files after the run | the event payload plus git and the forge | the pane's latest answer plus git and the forge | the remote task's state plus git and the forge |
| Lost events | none (synchronous) | missed events are re-derived from task files on the next event | resubscribe and reconcile from a snapshot | re-read task states on resume |

## What stays the same everywhere

- Select by status, owner, depends_on, mode guard, disjoint touches, then priority and id.
- One writer per task; an independent evaluator; readers only fan out.
- Every run has a turn cap, a spend cap and a no-progress stop; unattended runs pin the no-prompt
  mode with an allowlist, so an ask returns as a denial to report.
- Status moves only by commits from the roles that own them; signals change attention at most.
- The task record and git are the recovery substrate; session ids are an optimization.

## Choosing one

| Situation | Shape |
|---|---|
| A short queue of independent low-risk tasks, one checkout, overnight | sequential loop |
| A team repo where work should start the moment a task becomes ready, with no machine left running | forge-event agents |
| One developer supervising several tasks interactively with persistent review pairs | terminal multiplexer coordinator |
| Long-running remote work with a service that hosts sessions and sandboxes | hosted service |

A project may run two at once (a local coordinator plus forge-event review) only if the claim, the
task branch created on the remote as a new ref, is the single lock both respect: each reads the
remote's branches before dispatching.
