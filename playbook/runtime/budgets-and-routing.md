# Budgets and routing

## Problem

Agents read far more than they write, so cost is dominated by input and by cache misses. Every
coding agent defaults its subagents to the parent's model, so a flagship main session pays flagship
rates for every search. Runs without caps spin: one stuck task can spend a day's budget overnight.

## Practice

**Order of levers**, largest first: don't load it (skills, deferred tools, hooks, returns) → keep the
cache warm → batch where latency allows → tune effort → only then change models.

- **Effort first.** Before adding a model tier, sweep effort on the strong model alone; that is the
  baseline any multi-model setup must beat. A useful default: run at low effort, re-run failures at
  high.
- **Route at boundaries, by role.** Pick model and effort per task (from `size` and `risk`) and per
  subagent role, never per turn: changing model, effort or the tool list mid-session forfeits the
  cache. Set every subagent's model explicitly; "inherit" is a cost decision.
- **Cache economics.** Keep a stable prefix (instructions, tool list) and append; no timestamps or
  reordered tools in the prefix. Watch the hit rate; a drop names a cause.
- **Advisors only when they pay.** A stronger advisor over a competent executor that is prompted to
  consult it can help; an advisor of the same strength, or one never consulted, only adds cost.
- **Caps on every run**, recorded in the task and enforced by the runtime:

| Cap | Default | On breach |
|---|---|---|
| max turns per run | 200 | stop; attention `needs-human` |
| max spend per run | set per `size`; pack default $5 | stop; attention `needs-human` |
| max concurrent workers | 3–5, from the grant | queue |
| delegation depth | 1 | refuse to spawn |
| no-progress runs | 1 (status unchanged after a run) | stop the loop |

## Evidence

- 2025-07-18 · vendor · Manus: input:output about 100:1; KV-cache hit rate "the single most important
  metric" ([Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)).
- 2026-10 · vendor · Anthropic: cache reads 0.05× base input on Opus/Sonnet 5.5; a tool-list change
  invalidates the cache; changing effort invalidates messages
  ([prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
- 2026-10 · vendor · Anthropic measurements: caching cut agent-loop cost 2.7–5.3×; low effort then
  re-run failures at high reached 97.0% at $0.17/task vs 95.3% at $0.29; Haiku and Sonnet executors
  given an Opus advisor consulted it on 0 of 198 questions; an Opus executor with a stronger advisor
  gained 1.7 points at about 2.1× cost, about what more effort buys
  ([optimizing](https://platform.claude.com/docs/about-claude/models/optimizing-for-cost-and-intelligence)).
- 2026-04-09 · vendor · Sonnet executor with an Opus advisor: +2.7 points at 11.9% lower cost on one
  benchmark ([Claude blog](https://claude.com/blog/the-advisor-strategy)).
- 2026-10 · vendor · Claude Code, Codex and Gemini CLI default subagents to the parent's model
  ([subagents](https://code.claude.com/docs/en/sub-agents); [Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents);
  [Gemini CLI](https://geminicli.com/docs/core/subagents/)).
- 2026-10 · vendor · headless runs accept max turns and max budget; the budget counts subagents and
  is called "a good default for production agents" ([agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop)).
- 2024-07-01 · controlled (chat) · RouteLLM cut cost over 85% on MT Bench, where early errors do not
  compound as in agent runs ([LMSYS](https://lmsys.org/blog/2024-07-01-routellm)).
- 2026-10-13 · practice · branch `fix/agent-run-caps` adds per-run turn and budget caps (200, $5) and a
  no-progress stop to the user's loop and CI agents.

## Contracts used

`task` (`size`, `risk`, `budget`), `grant` (`limits.max-workers`, `limits.budget`), `policy`
(`budgets` per tier), `run-record` (turns, cost, cache tokens, outcome).

## Anti-patterns

- An advisor of the same model as the executor.
- Switching models mid-conversation "to save money".
- A loop with an iteration cap and no turn or spend cap.
- A cost line read from an output file that a bug left empty.

## Revisit when

A model release changes the price ratio between tiers or the cache multipliers, or the effort sweep
in [agent-setup review](../learning/agent-setup-review.md) moves the baseline.
