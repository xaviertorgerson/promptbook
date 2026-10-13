# Adapter: Herdr (runtime)

Herdr is a terminal runtime, not an engine: it owns the panes agents run in, classifies each agent's
state, and publishes events. It reads no harness contract. This adapter says which contracts a
Herdr-based runtime (stagehand, Heeler) produces and consumes, and how Herdr's vocabulary maps onto
them. Facts are from the Herdr source and docs at commit `241b99c` (2026-10) and stagehand at
`48aff9a`.

## Signals → attention

Herdr's `AgentStatus` is `idle | working | blocked | done | unknown`
(`src/api/schema/common.rs`). `done` means finished and not yet seen; viewing it turns it `idle`;
"both `idle` and `done` mean ready for input" ([concepts][concepts]). The state reaches a
subscriber as the event `pane.agent_status_changed` with `pane_id` and `agent_status`
([socket API][socket]); plugins receive it through an `[[events]] on = "pane.agent_status_changed"`
manifest entry and `HERDR_PLUGIN_EVENT_JSON` ([plugins][plugins]).

The mapping is `state-machines/attention.yaml` → `sources.herdr`. In short: `working` → working;
`blocked` → needs-human after inspecting the actual prompt; `done`, `idle`, `unknown` → no
attention until the coordinator reads the agent's answer. **None of them changes a task's workflow
status.** Herdr's event history "is not durable": on `events_lost`, rebuild from `session.snapshot`
and the task records.

## Contracts a Herdr runtime keeps

| Contract | Where | Notes |
|---|---|---|
| `task-record` | `.orchestrator/tasks/<id>.yaml` in the coordinator's control root; archived to `.orchestrator/archive/` after cleanup | stagehand's `assets/task-record.yaml` validates unchanged (fixture `fixtures/valid/task-record/stagehand-development.yaml`). `workspace.id` is the Herdr workspace, `role_sessions.<role>.pane_id` the pane, `wake.watches.<role>` the agent-wake watch id. |
| `grant` | `.orchestrator/grants/GRANT-n.yaml`, linked from each task record's `grant` | stagehand keeps delegation in one free-form "project note"; the `grant` schema is its structured form. See the field map below. |
| `run-record` | optional; stagehand records none | A runtime that wants spend history appends one line per agent turn it can measure. |
| `return` | not used by stagehand | stagehand reads the worker's latest answer in its pane; "no worker JSON or callbacks are required". A runtime may still ask a worker for a `return` object. |

## stagehand ↔ harness field map

| stagehand | harness | Difference |
|---|---|---|
| `task_id` | `task-record.task_id` | Same. When the work is a workflow task, use its id (BILL-3). |
| `mode` (`development`, `reviewer-only`, `delegated-work`, `workspace-only`) | `task-record.mode` | Same values. Not `task.mode` (methodology). |
| `objective`, `intent_ref`, `repository.*`, `development_target.*`, `workspace.*`, `agents`, `role_sessions`, `wake.watches`, `pull_requests` | same names | Same shape. |
| `state.name` (`working`, `needs-human`, `complete`) | `task-record.state.name` (attention) | Same values; the schema enforces `next_action` for needs-human and its absence for complete. |
| `state.summary`, `state.next_role`, `state.next_action` | same | `summary` capped at 120 characters. |
| legacy `attention_required`, `attention_reason`, `waiting_on`, stage names | — | Not accepted; stagehand itself converts them at its display boundary. |
| per-PR reviewed head and outcome (free-form) | `reviews[] {pr, head, outcome}` | Structured. |
| human decisions "with their source and scope" | `decisions[] {decision, source, scope, at}` | Structured. |
| project note: grant/source, requirements, non-goals, limits, integration targets | `grant`: `source`, `scope.objective/requirements/non_goals/repositories`, `limits`, `actions[merge].repo/target/strategy` | stagehand: "Merge authority must identify repositories, target branches, strategy, and required evidence" — the schema requires all four and fixes the evidence floor at independent review + required checks. |
| "Grants … may be narrowed or revoked" | `narrowed[]`, `revoked_at/by`, `revocable: true`, `expires_at` | The harness adds a mandatory expiry; stagehand has none. |

## Plugin and rules

A Herdr plugin is a directory with `herdr-plugin.toml` (`id`, `name`, `version`, `min_herdr_version`
required; `[[startup]]`, `[[events]]`, `[[actions]]`, `[[panes]]` arrays; commands are argv arrays,
not shell). A harness-aware wake relay would declare:

```toml
id = "harness.attention"
name = "Harness attention"
version = "0.1.0"
min_herdr_version = "0.8.2"
platforms = ["linux", "macos"]

[[events]]
on = "pane.agent_status_changed"
command = ["./attention", "observe"]   # writes task-record.signals.<role>; never a task status
```

Herdr commands an agent may run are an engine concern: stagehand ships them as Codex execpolicy
rules (`.codex/rules/herdr.rules`, allow / prompt / forbidden; `workspace close` and `server stop`
forbidden). An `agent-policy.yaml` `forbid: [{command: [herdr, workspace, close]}]` compiles to the
same rule through the Codex adapter.

[concepts]: https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/concepts.mdx
[socket]: https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/socket-api.mdx
[plugins]: https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/plugins.mdx
