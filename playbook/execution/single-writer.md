# Single writer

## Problem

Writes carry implicit decisions. Two agents editing the same change set make conflicting choices
neither can see, and the result fails in ways no single trace explains. Parallel writers also turn
every merge into a negotiation, and the human reviews a diff no one author understands.

## Practice

- **One writer per change set.** A task has exactly one agent (or human) that edits its branch. The
  writer owns the plan, the edits, the verification and the draft PR.
- **Others read, advise or judge.** Explorers search, advisors answer questions, evaluators review;
  none of them edits the writer's branch. A reviewer's findings go back to the same writer, who
  resolves only the ones selected.
- **Parallelism is across tasks, not inside one.** Tasks run in parallel only when their `touches`
  globs are disjoint. Overlapping tasks form a lane and run in sequence; the scheduler, not the
  agents, decides.
- **Ownership is recorded.** The task file's `owner` is the lock, claimed by compare-and-swap. A
  human taking a task over sets `owner` and the agent yields.
- **Helpers do not spawn helpers.** A worker gets an objective and boundaries, not orchestration
  machinery; recursive delegation is off by default.

## Evidence

- 2026-04-22 · vendor · Cognition: multi-agent systems "work best today when writes stay
  single-threaded"; extra agents contribute review and consultation
  ([Cognition](https://cognition.com/blog/multi-agents-working)).
- 2025-06-12 · vendor · Cognition's earlier example: parallel subagents built mismatched parts
  because "actions carry implicit decisions" ([Cognition](https://cognition.com/blog/dont-build-multi-agents)).
- 2026-01-28 · controlled · Google Research, 180 configurations: every multi-agent variant degraded
  sequential planning by 39–70% ([Google Research](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)).
- 2026-10 · vendor · OpenAI: "Be more careful with parallel write-heavy workflows"
  ([Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents)); Google: parallel subagents
  editing code can overwrite each other ([Gemini CLI](https://developers.googleblog.com/subagents-have-arrived-in-gemini-cli/)).
- 2026-10 · vendor · Claude Code agent-team guidance avoids same-file edits and starts with research
  and review ([agent teams](https://code.claude.com/docs/en/agent-teams)).
- 2026-09-30 · practice · stagehand: one persistent author, one independent reviewer, "No speculative
  helpers or recursive delegation" ([SKILL.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/SKILL.md)).
- 2026-09-23 · practice · agentic-template: tasks touching the same files are one lane; claims are a
  compare-and-swap on `owner`/`status` ([concurrency.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/concurrency.md)).

## Contracts used

`task` (`owner`, `touches`, `depends_on`), `return` (readers hand back findings, not edits),
`grant` (who may assign work), `state-machines/workflow.yaml` (claim = `ready` → `in-progress`).

## Anti-patterns

- A "fixer" agent spawned to apply a reviewer's findings to someone else's branch.
- Two tasks with overlapping `touches` dispatched in the same wave.
- A reviewer that edits instead of reporting.
- Splitting one feature across several writers to "go faster".

## Revisit when

A controlled study shows parallel writers on one change set beating a single writer on coding work,
or a merge mechanism makes semantic conflicts between agents detectable before review.
