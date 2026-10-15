# Adapter: Herdr (runtime)

Herdr is a terminal runtime, not an engine: it owns the panes agents run in, classifies each agent's
state, and publishes events. It reads no promptbook contract. This adapter says how promptbook reads
what a Herdr-based runtime (stagehand, Heeler) keeps, and how Herdr's vocabulary maps onto the
attention machine. Facts are from the Herdr source and docs at commit `241b99c` (2026-10-13) and
stagehand at `48aff9a` on `main` (2026-09-30), with the Claude Code setup its
`feat/promptbook-contracts` branch adds at `5e5336f` (2026-10-14). stagehand writes no promptbook
format: it keeps its own task records, which the `task-record` contract reads unchanged, records a
delegation as a project note, and follows a project's own instructions for its task queue.
promptbook's formats adapt to it, not the reverse.

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

## What a Herdr runtime keeps, read through promptbook

| Contract | Where | Notes |
|---|---|---|
| `task-record` | `.orchestrator/tasks/<id>.yaml` in the coordinator's untracked control root; archived to `.orchestrator/archive/` after cleanup | stagehand's own recovery note, from its `assets/task-record.yaml`; `promptbook validate --contract task-record <record>` reads a saved one. A record filled from the template is the fixture `fixtures/valid/task-record/stagehand-development.yaml`, and a test checks that it still fills every key the template names when a stagehand checkout is present. The evidence the template leaves unnamed (latest result, reviewed heads, feedback, human decisions) is accepted under whatever names stagehand uses (task-record 1.4.0). `workspace.id` is the Herdr workspace, `role_sessions.<role>.pane_id` the pane, `wake.watches.<role>` the agent-wake watch id. |
| `grant` | not written by stagehand | stagehand records a delegation as one project note in its private control state, linked from its task records ("no new schema or event ledger is required"). A runtime that wants a checkable delegation record writes the `grant` format and checks it with `promptbook grant verify`; the field map below says where a project note's parts would go. |
| `run-record` | optional; stagehand records none | A runtime that wants spend history appends one line per agent turn it can measure. |
| `return` | not used by stagehand | stagehand reads the worker's latest answer in its pane; "no worker JSON or callbacks are required". A runtime may still ask a worker for a `return` object. |

The task queue is the project's: stagehand follows the instructions of the project it works in
(its `AGENTS.md` and the files it names). A stagecraft project's `specs/` tasks are such
instructions; stagehand has no promptbook-specific dispatch rule.

## stagehand ↔ promptbook field map

| stagehand | promptbook | Difference |
|---|---|---|
| `task_id` | `task-record.task_id` | Same. When the work is a workflow task, use its id (BILL-3). |
| `mode` (`development`, `reviewer-only`, `delegated-work`, `workspace-only`) | `task-record.mode` | Same values. Not `task.mode` (methodology). |
| `objective`, `intent_ref`, `repository.*`, `development_target.*`, `workspace.*`, `agents`, `role_sessions`, `wake.watches`, `pull_requests` | same names | Same shape. |
| `state.name` (`working`, `needs-human`, `complete`) | `task-record.state.name` (attention) | Same values; the schema enforces `next_action` for needs-human and its absence for complete. |
| `state.summary`, `state.next_role`, `state.next_action` | same | `summary` capped at 120 characters. |
| the template's optional evidence (latest result, per-PR reviewed head and outcome, selected feedback, human decisions with source and scope), named as stagehand chooses | accepted at the top level as the runtime's own evidence | promptbook's structured `result`, `reviews[]`, `decisions[]`, `grant` and `signals` are promptbook-optional; stagehand does not write them, and a record without them is complete. |
| a project note: the human grant and its source, requirements and non-goals, limits, integration targets, significant decisions | the parts a `grant` would hold: `source`, `scope.objective/requirements/non_goals/repositories`, `limits`, `actions[merge].repo/target/strategy` | stagehand: "Merge authority must identify repositories, target branches, strategy, and required evidence." The evidence floor is independent review and the required checks. |
| "Grants … may be narrowed or revoked" | `narrowed[]`, `revoked_at/by`, `revocable: true`, `expires_at` | Same idea; a grant needs `expires_at` and `limits.budget` only when no `limits.stop_when` bounds it. |

## Plugin and rules

A Herdr plugin is a directory with `herdr-plugin.toml` (`id`, `name`, `version`, `min_herdr_version`
required; `[[startup]]`, `[[events]]`, `[[actions]]`, `[[panes]]` arrays; commands are argv arrays,
not shell). A promptbook-aware wake relay would declare:

```toml
id = "promptbook.attention"
name = "Promptbook attention"
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
