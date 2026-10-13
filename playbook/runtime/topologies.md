# Topologies

## Problem

Multi-agent setups are easy to start and expensive to run. They buy more tokens in parallel, which
helps some work and hurts other work, and most of their failures are design and verification gaps.
Choosing a topology by enthusiasm rather than task shape wastes money and degrades sequential work.

## Practice

Start with one agent. Add structure only when the task shape calls for it:

| Shape of the work | Topology | Notes |
|---|---|---|
| Sequential, coupled writes (most coding) | single writer, plus read-only helpers | helpers search or advise; one agent edits |
| Independent, read-heavy subtasks (search, research, multi-lens review) | fan-out to parallel readers, fan-in by a coordinator | a barrier before synthesis; a central verifier |
| Clear evaluation criteria | generator + separate evaluator | see [verification](../execution/verification.md) |
| Many independent tasks with disjoint `touches` | parallel single-writer tasks scheduled by code | the task graph is the schedule |
| A mappable workflow | a deterministic graph with model nodes only where judgement is needed | code owns routing |

Rules that hold for every topology:

- **Code owns the graph.** Scheduling, fan-out width, barriers and retries are code, not a model's
  turn-by-turn choice, wherever the workflow can be written down.
- **Always pair parallelism with a central verifier.** Independent agents with no verifier amplify
  errors.
- **Cap width and depth.** Width defaults to 3–5; depth defaults to 1 (helpers do not spawn helpers).
- **Measure before scaling.** A topology must beat the single agent at its best effort level on the
  project's own evals before it becomes the default.

## Evidence

- 2026-01-28 · controlled · Google Research, 180 configurations, 3 model families: centralized
  coordination +80.9% on a parallelizable benchmark; every multi-agent variant −39 to −70% on
  sequential planning; error amplification 17.2× independent vs 4.4× centralized
  ([Google Research](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)).
  The expanded paper (260 configurations) adds capability saturation ([arXiv 2512.08296](https://arxiv.org/abs/2512.08296)).
- 2025-10-26 · controlled · MAST: 1,642 traces, failure rates 41–86.7%; about 44% system design,
  32% inter-agent misalignment, 23.5% verification ([arXiv 2503.13657](https://arxiv.org/html/2503.13657v3)).
- 2026-06 · controlled · auto-generated multi-agent systems underperformed self-consistency at up to
  10× the cost ([arXiv 2606.13003](https://arxiv.org/abs/2606.13003)).
- 2025-06-13 · vendor · Anthropic's research system: +90.2% over a single agent at about 15× chat
  tokens; token usage explained 80% of variance; "most coding tasks" a poor fit
  ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)).
- 2026-04-22 · vendor · Cognition: writes stay single-threaded ([Cognition](https://cognition.com/blog/multi-agents-working)).
- 2026-07-01 · vendor · moving routing into a graph cut an illustrative flow from 5,152 to 2,265
  tokens ([Google](https://developers.googleblog.com/why-we-built-adk-20/)).
- 2026-10 · vendor · default limits differ: depth 3 and 20 concurrent (Claude Code), 3 concurrent
  (OpenAI Responses), no nesting (Gemini CLI); agent teams cost about 7× a standard session
  ([subagents](https://code.claude.com/docs/en/sub-agents); [OpenAI](https://developers.openai.com/api/docs/guides/responses-multi-agent);
  [Gemini CLI](https://geminicli.com/docs/core/subagents/); [costs](https://code.claude.com/docs/en/costs)).
- 2026-02-05 · vendor · a 16-agent swarm with no orchestrator, only lock files in git, built a
  100K-line compiler for about $20,000; its first lesson was the verifier
  ([Anthropic](https://www.anthropic.com/engineering/building-c-compiler)).

## Contracts used

`task` (`touches`, `size`), `return`, `grant` (`limits.max-workers`), `run-record` (cost per
topology for comparison).

## Anti-patterns

- A panel of reviewers on a one-file change.
- Model-chosen fan-out with no width cap.
- Recursive delegation "to be safe".
- Comparing a swarm to a single agent at default effort and calling the gap a win.

## Revisit when

A new controlled study covers coding work, a model release changes the single-agent baseline
(capability saturation), or the project's own run records show a topology beating its baseline.
