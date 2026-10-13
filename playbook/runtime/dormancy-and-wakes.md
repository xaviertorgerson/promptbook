# Dormancy and wakes

## Problem

A coordinator that polls burns tokens asking "done yet?", interrupts working agents, and turns
timing noise into decisions. A coordinator that treats every runtime signal as progress advances
work that never finished: an idle terminal is not a merged PR.

## Practice

- **Sleep until something is actionable.** Work starts on events: a spec approved, a task set
  `ready`, a PR pushed, a review submitted, a human decision, an agent turn ending. Schedules are for
  audits and release trains, never for the flow. No polling loop, cron agent or repeated status
  prompt.
- **Subscribe, don't ask.** The runtime watches each worker and queues a wake when its state
  changes. Workers send no callbacks and carry no orchestration instructions.
- **A wake is a hint.** On a wake, the coordinator inspects the worker's latest answer and the
  durable evidence (git, PR, CI, verification), then saves the reconciled outcome. Wakes may
  coalesce; a duplicate or stale wake must not repeat work, publication or merging.
- **Runtime signals map to attention, never to workflow status.** Runtime `blocked`, an
  `INPUT_REQUIRED`/`AUTH_REQUIRED` task state, an `input_required` result, or a permission prompt in
  an unattended run all mean `needs-human`. Only evidence (a PR opened, a review passed, a human
  approval) advances the task's workflow status.
- **Asks surface; they don't stall.** In an unattended run a permission ask becomes a denial that is
  reported as a question for a human and routed to their phone, not answered by the coordinator.
- **Reconcile on start.** After a restart or a lost event stream, rebuild from a snapshot of live
  state plus the task records, and advance directly to the furthest state the evidence supports.
- **A bounded check-in is not polling.** A periodic "still working" notice from a cheap non-LLM timer
  is an opportunity to look, not a reason to interrupt.

## Evidence

- 2026-09-30 · practice · stagehand wakes on `pane.agent_status_changed` with "no polling loop, cron
  agent, repeated status prompts, or silent retry spiral"; "a wake is a hint, not an event ledger";
  runtime idle or done never advances workflow state
  ([SKILL.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/SKILL.md);
  [workflow-state.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/references/workflow-state.md)).
- 2026-10 · vendor · Herdr's event history "is not durable"; a lagging subscriber gets `events_lost`
  and reconciles via a session snapshot ([socket API](https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/socket-api.mdx)).
- 2026-10 · secondary · Google Cloud Tech: an agent must "truly be able to sleep" and wake on
  webhooks, schedules, approvals or callbacks ([transcript, paraphrase](https://www.youtubetotranscript.com/transcript?v=l6KeLCuB90o)).
- 2026-05-12 · vendor · Google ADK resumes runs from webhooks with a state delta
  ([Google](https://developers.googleblog.com/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/)).
- 2026 · vendor · A2A task states include `INPUT_REQUIRED` and `AUTH_REQUIRED`; MCP Tasks use
  `input_required` ([A2A](https://a2a-protocol.org/latest/specification/); [MCP](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)).
- 2026-09-23 · practice · agentic-template's north star: "Event-driven, not polled"; its CI agents
  wake on forge events ([AGENTS.md](https://github.com/xaviertorgerson/agentic-template/blob/master/AGENTS.md)).
- 2026-10-12 · practice · Heeler pushes Blocked and Done to a phone from the same Herdr event
  ([Heeler](https://github.com/ZingerLittleBee/Heeler/blob/main/README.md)).

## Contracts used

`task-record` (attention), `state-machines/attention.yaml` (signal → attention mapping),
`state-machines/workflow.yaml` (status advances only on evidence). Runtime bindings: `adapters/herdr`, `adapters/ci`.

## Anti-patterns

- A loop that asks a worker for status every few minutes.
- Marking a task done because its pane went idle.
- Auto-approving a permission prompt to keep the run moving.
- Replaying every missed handoff after a restart instead of reconciling.

## Revisit when

Runtime event streams become durable (then reconciliation can shrink), or a standard runtime-state
protocol replaces the per-runtime mappings.
