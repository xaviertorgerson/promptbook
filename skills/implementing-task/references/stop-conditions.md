# Stop conditions

Never loop forever and never guess. Each stop below names the workflow transition (task machine of
the workflow contract), whether the coder role may make it, what to write, and the return's
`attention`. Always commit and push what is green first, then make the transition in its own commit
with an agent-log line that names the prior status (`status was <prior>; status → <side state>:
<reason>`), because side states resume to the status they were entered from.

| Condition | Transition (from → to) | Coder may? | Write | Return |
|---|---|---|---|---|
| A behavior the spec does not decide, and both answers change behavior | `need-input` (in-progress or review → needs-input) | yes | an unchecked Open question, marked blocking, with options and your recommendation | `needs-human`, the question in `decisions_needed` (`for: human`, `blocking: true`) |
| A named input is missing (secret, service, decision, dataset), or a credential is needed | `block` (→ blocked) for an external dependency; `need-input` when a human must decide | yes | the missing input by name, never its value; who provides it | `needs-human` |
| A criterion is contradictory, untestable, or the spec is wrong | at `review`: `respec-surfaced` (review → spec-draft, needs a kickback reason); at `in-progress`: `need-input` | yes | `kickback_reason`, or the first agent-log line; what is wrong and a proposed rewrite | `needs-human` |
| The task is too big for its budget or one session | `need-input` | yes | a proposed split into sibling tasks with `AC-n` each; do not create them yourself unless the planner role is yours | `needs-human` |
| A needed edit lies outside `touches` and overlaps another active task's lane | `need-input` | yes | the paths and the overlapping task id | `needs-human` |
| A gate stays red and the only fix weakens a test, an assertion or a wall | `need-input` | yes | the failing check verbatim; why the honest fix is out of scope | `needs-human` |
| The same failure twice with no progress (repeated attempts, same error) | `need-input` | yes | what was tried, both times, and what you would try next | `needs-human` |
| The run's turn or spend cap is near (about 90%), or the task `budget` is spent | stay; if the task cannot continue, `need-input` | yes | the next step in Working notes so a fresh session resumes | `needs-human` |
| A permission request was denied (unattended runs deny every ask) | none by itself | — | the denied action and why it was needed | `needs-human`, the denial as a question |
| `risk: high` or `irreversible: true` and no human supervises this run | none: do not claim | — | nothing in the task file | `needs-human`: "needs a supervised session" |
| A verdict fails twice on the same criterion | stay at `review` | — | the two verdict summaries (forward them, do not paraphrase) | `needs-human` |
| A human set `owner` to themselves, or moved `status` | none: yield | — | a handoff line: done, left, uncertain | `working` if the human is now acting, else `needs-human` |
| The work belongs to another task or another epic | none | — | a note for the planner in Working notes | `needs-human` if it blocks you, else `complete` for your own criteria |

Not the coder's to make: `suspend` and `unsuspend` (owner, engineer), `redo` and `respec` from
`human-review` (owner, engineer), `mark-pr-ready` (engineer, or a coordinator under a `finalize`
grant), `approve-pr`, `land`.

## A good question

Specific, answerable in one line, with the options and their consequences:

> AC-3 says "rate on the original plan" but not which rate version. Use the version in force at the
> period start (simpler, matches invoices already sent) or at the rerate time (matches current price
> list)? Recommendation: period start. Blocking: yes.

A bad question asks the human to restate the task ("what should I do?") or approve a routine
implementation choice.

## Resuming from a side state

Whoever picks the task up after the human answers records the move back (`resume-answered`,
`unblock`): read the agent-log line that parked it, restore that prior status, add a line
"resumed from needs-input: <answer>". A fresh session never claims to resume a prior session; it
resumes from the task file, branch and commits.
