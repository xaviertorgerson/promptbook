# Observability

## Problem

Agent runs are expensive, non-deterministic and mostly unattended. Without per-run records you
cannot tell whether a change to the agent setup helped, which task burned the budget, or why the cache stopped
hitting. Dashboards of "activity" mislead: parallel motion is not progress.

## Practice

- **One run record per agent run**, appended as one JSON line: task id, role, engine, model, effort,
  session id, turns, input/output/cache-read/cache-write tokens, cost, exit, outcome (status before
  and after), permission denials, evaluator verdict. The runtime writes it, not the agent.
- **Export spans in the open GenAI conventions** (`invoke_agent`, `execute_tool`, token and cache
  attributes). Pin the instrumentation version; the conventions are still in development. Prompt and
  tool content stay redacted by default.
- **Watch three numbers**, per task and per week:

| Number | Computed from | Tells you |
|---|---|---|
| cost per task | run records grouped by task id, to `merged` | whether the agent setup is getting cheaper |
| cache hit rate | cache-read tokens ÷ all input tokens (uncached, cache read, cache write) | whether the prefix is stable; a drop names a cause |
| evaluator pass rate | first-pass verdicts ÷ evaluations | whether writers are improving or evaluators are lax |

- **What to look at weekly**, from `promptbook report --since <a week ago>` over the run records: the
  cost per merged task (the per-task cost of the tasks the board shows merged that week; the number
  the agent setup exists to lower); the cache hit rate, overall and for the costliest tasks (a drop means
  the prefix changed: instructions, tool list, or a model or effort switch mid-session); the denial
  count (each denial is a question for a human: grant the tool or change the instruction); and the
  stalled and needs-human runs (the loop stops at the first, so each is a task to re-scope or a
  question to answer, not a run to repeat).
- **Supervision surface is the task graph.** The board (generated from task files) and the runtime's
  attention view (red needs a human, yellow working, green complete) are the views a human watches.
  Notifications fire only on exceptions: `needs-human`, a red gate, a rollback.
- **Report time honestly.** Elapsed time and measured tokens; never estimated token counts.

## Evidence

- 2026-10 · standard · OTel GenAI agent spans define `invoke_agent`, `execute_tool` and
  `gen_ai.usage.cache_read.input_tokens`, status "Development"
  ([OTel](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)).
- 2026-10 · vendor · Claude Code exports cost and token metrics (including cache read and creation)
  and beta traces with content redacted by default ([monitoring](https://code.claude.com/docs/en/monitoring-usage)).
- 2026-10 · vendor · `/usage` reports cache hit share and likely causes of misses; enterprise baseline
  about $13 per developer per active day ([costs](https://code.claude.com/docs/en/costs)).
- 2025-07-18 · vendor · Manus: cache hit rate is the key production metric
  ([Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)).
- 2026-04-15 · vendor · Microsoft: every agent action traceable to an authorizing human
  ([Microsoft](https://devblogs.microsoft.com/all-things-azure/agentic-devops-practices-principles-strategic-direction/)).
- undated · practitioner · Osmani warns parallel activity metrics can mislead
  ([Addy Osmani](https://addyosmani.com/blog/claude-code-agent-teams/)).
- 2026-10-14 · measured · Claude Code 2.1.300, two `claude -p --model haiku --output-format json`
  calls (one and two turns, empty directory, clean environment): the result has `usage`
  (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`) and
  `modelUsage` per model, whose `costUSD` equalled `total_cost_usd`; the loop records the per-model
  sum ([loop.mjs](https://github.com/xaviertorgerson/agentic-template/blob/8188f6d/scripts/loop.mjs)).
- 2026-10-13 · practice · branch `fix/agent-run-caps` appends task, session id, turns, cost, exit and
  outcome per run to `.agent/loop-runs.jsonl`; stagehand reports elapsed time "without inventing token
  measurements" ([safety-and-escalation.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/references/safety-and-escalation.md)).

## Contracts used

`run-record` (JSONL; matches the loop's `.agent/loop-runs.jsonl`), `task-record` (attention for the
supervision view), `task` (id joins runs to work).

## Anti-patterns

- Cost captured by reading a file nobody checks is non-empty.
- A dashboard of messages sent and agents running, with no outcome column.
- Prompt content exported to a third-party backend by default.
- Notifications on every status change.

## Revisit when

The OTel GenAI conventions reach stable status (then drop version pinning), or a fourth number proves
more predictive of the agent setup's quality in the project's own data.
