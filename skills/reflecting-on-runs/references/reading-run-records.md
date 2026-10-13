# Reading run records

One JSON line per agent run, appended by the runner (never by the agent). Fields of the `run-record`
contract:

| Field | Meaning | Look for |
|---|---|---|
| `task`, `session_id` | which task, which session | join to the task file and transcript |
| `started_at`, `ended_at` | timestamps | very long runs |
| `exit` | process exit code or signal name | non-zero, `SIGTERM`, `SIGKILL` |
| `outcome` | `advanced`, `stalled`, `failed` | anything but `advanced` |
| `reason` | why it stalled or failed (null when advanced) | repeated reasons across tasks |
| `subtype` | the engine's result subtype (e.g. max turns, max budget, error during execution) or null | budget and turn caps hit |
| `num_turns`, `total_cost_usd` | effort spent | outliers against the task's size |
| `status_before`, `status_after` | the task's workflow status around the run | a task that stays `ready` or `in-progress` across runs |
| `permission_denials` | denied tool calls | any non-zero: a question a human never saw |
| `attention` | `working`, `needs-human`, `complete` | `needs-human` clusters |
| `engine`, `runtime`, `model`, `permission_mode`, `budget`, `grant` | context | failures concentrated on one model or mode |

## Queries (jq, or any JSON tool)

```sh
# failures and stalls in a window, by reason
jq -r 'select(.started_at >= "2026-10-01") | select(.outcome != "advanced") | .reason' runs.jsonl | sort | uniq -c | sort -rn

# tasks that burned runs without moving
jq -r 'select(.outcome == "stalled") | .task' runs.jsonl | sort | uniq -c | awk '$1 > 1'

# runs that hit a permission wall
jq -c 'select((.permission_denials // 0) > 0) | {task, session_id, permission_denials}' runs.jsonl

# cost outliers
jq -r '[.task, .total_cost_usd] | @tsv' runs.jsonl | sort -k2 -rn | head
```

## Reading them right

- A `stalled` run is a signal only when the stall is the agent's fault (it claimed another task,
  stopped early); a task parked as `blocked` or `needs-input` by design is not a failure.
- `permission_denials > 0` means a wall held. The lesson is never "avoid the wall"; it is either a
  missing question to a human or a task that should not have been dispatched unattended.
- Repeated identical `reason` strings across tasks point at the harness (a skill, a script, a cap),
  not at the task.
- The run record says what happened, not why; open the transcript or verdict before writing the
  class.
