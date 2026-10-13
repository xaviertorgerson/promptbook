# Harness review

## Problem

Every harness component encodes an assumption about what the model cannot do alone. Models improve
every few weeks, so yesterday's scaffolding (context resets, sprint splits, extra reviewers, long
instruction files) becomes cost without benefit. Nobody deletes a component that still "works".

## Practice

On each major model release from a lab the toolkit routes to, and quarterly otherwise:

1. **Pin the baseline.** Record the current suite results (routing, scenarios at pass^k, the
   project's real-failure tasks) with cost and wall time from run records.
2. **Effort sweep.** Run the suite on the new model at each effort level, alone, with no extra
   components. This is the baseline any added structure must beat.
3. **Ablate.** For each component (a subagent, a review round, a loop shape, a rule block, a skill, a
   hook that only advises), run the suite with it removed. A component whose removal costs nothing
   measurable is not load-bearing.
4. **Delete what isn't load-bearing.** Open one PR per removal with the numbers. Walls (deny hooks,
   branch protection, secret guards) are not candidates: they protect against rare events an eval
   suite does not sample.
5. **Re-route.** Update per-role model and effort defaults from the sweep.
6. **Update the playbook.** Bump "as of", re-check every "Revisit when" trigger, and record the
   review in `CHANGELOG.md`.

## Evidence

- 2026-03-24 · vendor · Anthropic: treat each component as an assumption; re-examine with each new
  model and remove components "no longer load-bearing"; it dropped sprints and resets for Opus 4.6
  ([Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
- 2026-10 · vendor · Anthropic: run an effort sweep on the strong model alone first; it is the
  baseline any multi-model setup must beat
  ([optimizing](https://platform.claude.com/docs/about-claude/models/optimizing-for-cost-and-intelligence)).
- 2026-04-08 · controlled · the scaling study reports "capability saturation": coordination returns
  diminish once the single-agent baseline is strong ([arXiv 2512.08296](https://arxiv.org/abs/2512.08296)).
- 2026-10 · vendor · OpenAI's guidance for its newest model: prune prompts one instruction group or
  tool at a time against evals ([OpenAI](https://developers.openai.com/api/docs/guides/latest-model)).
- 2026-09 / 2026-10 · vendor · release dates that would have triggered a review: Opus 5.5 on Sep 22,
  Sonnet 5.5 on Sep 28, Haiku 5.5 on Oct 7 ([Anthropic news](https://www.anthropic.com/news)).
- 2026-10-12 · recommendation · the research report's action list makes "effort sweep and harness
  review on each model release" a standing item.

## Contracts used

`run-record` (baseline and sweep costs), `evidence`, `toolkit-lock` (the model and pack versions
reviewed), `skill` (`metadata.deprecated` for removals).

## Anti-patterns

- Upgrading the model and keeping every component "to be safe".
- Comparing the new model with all components against the old model with all components, so no
  single component is ever tested.
- Deleting a deny hook because the eval suite never exercised it.
- A review with no numbers recorded.

## Revisit when

Model releases become frequent enough that a per-release review is impractical (move to a fixed
monthly cadence with the sweep automated), or the suite is too small to detect the effects being
ablated.
