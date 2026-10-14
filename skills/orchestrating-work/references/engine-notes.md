# Engine and runtime notes

The procedure in SKILL.md names no engine or runtime. These notes record how the harness adapters
bind it as of 2026-10-13; `adapters/<name>/README.md` in the harness owns the mapping, and this file
follows it. Verify on use: the products below change fast.

## Sequential loop (agentic-template `scripts/loop.mjs`, claude-cli runtime)

- Dispatches the highest-priority `ready` task whose `depends_on` are all merged and whose owner is
  null, one fresh headless session per iteration, by id.
- Per-run ceilings `--max-turns` and `--max-budget-usd` (env `AGENT_MAX_TURNS`,
  `AGENT_MAX_BUDGET_USD`; defaults 200 and $5); stops on a failed run, a stalled task, or when no task
  is dispatchable; appends a `run-record` line to `.agent/loop-runs.jsonl`.
- ADR-0021 (agentic-template branch `docs/adr-permission-precedence`, `c177fa1`) requires every unattended run to pass `--permission-mode dontAsk` with `--allowedTools`;
  check the loop and CI workflows you run actually pass it before trusting the allowlist.

## Forge-event CI agents (agentic-template `.github/workflows/agent-*.yml`)

- planner on an approved spec, coder on a task set ready, reviewer on every PR push (comments only),
  merge on a human approval (the only job with a token that can land on the protected branch).
- Each is dormant until its enabling variable is set; each carries the same per-run ceilings.

## Terminal multiplexer (Herdr with stagehand's coordinator)

- Herdr's `pane.agent_status_changed` event carries `idle | working | blocked | done | unknown`;
  stagehand's agent-wake plugin relays it to the coordinator as a coalesced, acknowledged notice and
  sends a periodic `still-working` reminder (default 15 minutes).
- Event history is not durable; on `events_lost` reconcile from `session.snapshot` plus the task records.
- stagehand keeps records in `.orchestrator/tasks/` and archives to `.orchestrator/archive/`; its
  record validates as `task-record` unchanged.
- stagehand itself imposes no fixed concurrency cap; under this skill a grant's `max_workers` is the cap.

## Hosted agent services

- Anthropic Managed Agents: a durable session log outside the context and a harness restarted with
  `wake(sessionId)`; multiagent runs up to 25 concurrent workers (vendor-reported).
- A2A remote agents: map task states with the attention table (reporting-state).

## Subagent defaults that make caps matter

Claude Code defaults to nesting depth 3 and 20 concurrent subagents; the OpenAI Responses
multi-agent beta defaults to 3 concurrent; Gemini CLI subagents cannot nest. All three default a
subagent to the parent's model. Set depth 1, the grant's width and an explicit model per role.
