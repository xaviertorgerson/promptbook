# Engine and runtime notes: where signals come from

The procedure is runtime-neutral. These notes say where each signal originates as of 2026-10-13;
the harness adapters (`adapters/herdr`, `adapters/ci`, `adapters/<engine>`) own the mapping.

## Herdr (terminal multiplexer)

- `AgentStatus` is `idle | working | blocked | done | unknown` (`src/api/schema/common.rs`, commit
  241b99c). `done` is finished and unseen; viewing it turns it `idle`.
- Delivered as the socket event `pane.agent_status_changed` (`pane_id`, `agent_status`); plugins get
  it through an `[[events]] on = "pane.agent_status_changed"` manifest entry.
- History is not durable: a lagging subscriber gets `events_lost` and must reconcile from
  `session.snapshot`.
- stagehand's agent-wake plugin coalesces notices per watch, keeps at most one unacknowledged plus one
  pending wake, sends `kind: still-working` reminders (default 15 minutes) and `kind:
  state-uncertain` after observed activity turns unknown. Record its watch id in `wake.watches`.
- stagehand's `assets/task-record.yaml` validates as `task-record` unchanged.

## A2A (remote agents)

Task states per the A2A v1.0 specification section 4.1.3; `INPUT_REQUIRED` and `AUTH_REQUIRED` are
interrupted states.

## MCP Tasks

`working`, `input_required`, `completed`, `failed`, `cancelled` (experimental in spec 2025-11-25;
an extension in 2026-07-28 with tasks/get, tasks/update, tasks/cancel).

## Headless engine runs

- Claude Code `claude -p --output-format json`: result `subtype` (`success`, `error_max_turns`,
  `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries`) and
  `permission_denials`. Under `--permission-mode dontAsk` an ask becomes a denial (ADR-0021, agentic-template
  branch `docs/adr-permission-precedence`, `c177fa1`).
- Codex `codex exec`: the runner records the terminal event as `subtype` (unverified field names).
- The runner writes one `run-record` line per run (`.agent/loop-runs.jsonl`).

## CI

Check runs: `status` queued, in_progress, waiting, requested, pending; `conclusion` success,
failure, neutral, cancelled, skipped, timed_out, action_required, stale (GitHub check runs; Forgejo
Actions reports the same names).
