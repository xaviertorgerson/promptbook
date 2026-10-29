# Durable checkpoints

## Problem

Sessions crash, expire, compact and live on one machine. A step whose only record is a model's
context is lost with it, and the next session re-does or contradicts it. Markdown prose that the
model rewrites drifts; a plan made inside a session dies with the session.

## Practice

Keep two kinds of state, each in one place:

| State | Where | Written by | Read by |
|---|---|---|---|
| **Workflow** (what the work is and where it stands) | tracked task files and git: status, owner, criteria, open questions, append-only agent log, working notes, commits, PRs | the writer and the gates | every session, teammate and CI job |
| **Runtime** (who is running it, where) | one task record per task per runtime, untracked: workspace, worktree, base commit, role sessions, wake watches, PRs, attention, summary, next action | the coordinator | the coordinator after a restart |

- **Checkpoint on every transition.** A claim, a commit, a handoff, a gate result and a park each
  write durable state before anything else happens. Never design a step whose only record of progress
  lives in an agent's session.
- **Structured over prose for state.** Status and ownership are frontmatter fields; models tamper
  less with structured fields.
- **A living plan.** Multi-session tasks keep a short `Working notes` section in the task file: the
  current plan, what changed and why. It is rewritten, not appended to; the agent log is the append-only part.
- **Session ids are an optimization.** Record them so a session can resume, but recovery always works
  from the task file, branch and commits. A fresh session is never labeled a resume.
- **A dead session's uncommitted diff is evidence, not a checkpoint.** When a session dies mid-task
  its edits often survive in the worktree. Recovery starts a fresh session on the task and tells it
  the diff is inherited, unreviewed work: read it critically, finish to the task's criteria, run the
  gates, commit. The dead session's transcript is not reloaded.
- **Machine-local memory is a cache.** Anything a teammate, CI or another machine needs is committed.

## Evidence

- 2025-11-26 · vendor · Anthropic's long-running harness kept a progress file, a JSON feature list
  (models tamper with JSON less than Markdown) and commits
  ([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).
- 2026-04-08 · vendor · Managed Agents keep an append-only session log outside the context and a
  stateless harness restarted by `wake(sessionId)` ([Anthropic](https://www.anthropic.com/engineering/managed-agents)).
- 2025-07-18 · vendor · Manus recites a rewritten `todo.md` to fight drift over about 50 tool calls
  ([Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)).
- 2026 · secondary · LangGraph checkpoints every superstep; 2026-04 · vendor · Microsoft Agent
  Framework 1.0 shipped checkpointed graphs ([Groundy](https://groundy.com/articles/langgraph-1-2-0-makes-error-handler-resume-crash-durable-with-conditions/);
  [Microsoft](https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/)).
- 2026-10 · vendor · Claude Code auto memory is machine-local and loads only the first 200 lines or
  25 KB ([memory](https://code.claude.com/docs/en/memory)).
- 2026-09-23 · practice · agentic-template: "Never design a step whose only record of progress lives
  in an agent's in-memory session" ([LOOPING.md](https://github.com/xaviertorgerson/agentic-template/blob/master/LOOPING.md)).
- 2026-09-30 · practice · stagehand's task record has three attention states and "no counters";
  "Save meaningful outcomes, not every message" ([workflow-state.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/references/workflow-state.md)).
- unsourced · heirloom recovered two background builds of about 90 tool calls each, killed by
  transient API errors, by a fresh agent reviewing and finishing the worktree's uncommitted diff (the
  operator's notes, 2026-10); treat it as recommendation.
- 2026-10-13 · practice · branch `fix/agent-run-caps` makes the loop append session id, cost and outcome
  per run to `.agent/loop-runs.jsonl`, fixing session ids that were printed and lost.

## Contracts used

`task` (status, owner, agent log, working notes, `sessions`), `task-record` (YAML, attention),
`run-record` (JSONL per run).

## Anti-patterns

- Progress kept in a chat or a session's memory file.
- A task record that duplicates the plan instead of linking it.
- Counters and booleans ("review_round: 3", "ready_for_cleanup: true") instead of evidence.
- A driver that writes the task file while the agent is committing to it.

## Revisit when

Runtimes offer a durable, portable session log that teammates and CI can read, making the task
record redundant.
