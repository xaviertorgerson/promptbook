---
name: reviewing-harness
description: Use when a new model was released or adopted, or the quarterly harness review is due — "a new model shipped, review the harness", "run the effort sweep", "which skills, rules or subagents can we drop now", "ablate the reviewer", "is this component still load-bearing", "re-tune model and effort per role", "bump the playbook as-of date". Do not use for writing or running one skill's evals (evaluating-skills), mining failed runs for small fixes (reflecting-on-runs), or retiring one skill a better one replaced (promoting-learnings).
license: MIT
compatibility: Any agent runtime that reads Agent Skills and can run an eval suite non-interactively with selectable model and effort. Needs run records with cost and turns.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Reviewing the harness

Every harness component encodes an assumption about what the model cannot do alone, and models
improve every few weeks. On each major model release, and quarterly otherwise, measure the new model
alone, remove one component at a time, and delete what is no longer load-bearing. Walls are never
candidates.

## Inputs

- The eval suite: every skill's `evals/` (routing, scenarios at pass^k), plus the project's
  real-failure tasks (at least 20, drawn from failures actually seen).
- The baseline: the last harness-review record and the current results with cost and wall time from
  run records (`run-record`: `model`, `num_turns`, `total_cost_usd`, `started_at`, `ended_at`).
- The component inventory ([components](references/components.md)): skills, instruction blocks,
  subagents, review rounds, loop shapes, advisory hooks, per-role model and effort defaults.
- `toolkit.lock` (the harness and pack versions under review) and the playbook's "as of" date and
  "Revisit when" triggers.

## Procedure

Copy the list into your working notes and tick it as you go.

1. **Declare the review.** Model (or quarter), suite version, trial counts, and a spend cap for the
   review itself. Write them at the top of the review record before running anything.
2. **Pin the baseline.** Re-run the current harness on the current model: routing totals, each
   scenario's `n/k`, real-failure task pass rate, median cost and wall time per task. If the suite has
   fewer than 20 real-failure tasks, say so; small effects then read as inconclusive (step 5).
3. **Effort sweep, model alone.** Run the real-failure tasks on the new model at each effort level
   with no optional components: instruction file trimmed to its invariants, no skills, no extra
   subagents or review rounds; walls stay on. This is the baseline any added structure must beat.
4. **Full harness on the new model** at the effort the sweep suggests, so the comparison is the new
   model with and without each component, never old model vs new model.
5. **Ablate, one component at a time** ([ablation](references/ablation.md)). For each candidate,
   disable it alone and re-run the affected cases and tasks with the same trial counts. A component
   is **not load-bearing** when, without it, every scenario that was `k/k` stays `k/k`, routing stays
   100%, the real-failure pass rate drops by no more than the noise you measured between two baseline
   runs, and cost or time does not rise. Otherwise it stays. Inconclusive means it stays.
6. **Never ablate walls**: deny hooks, permission deny rules, secret guards, branch protection,
   sandbox and egress rules, budget and turn caps, the human gates (spec, PR, release), required test
   gates. They protect against rare events an eval suite does not sample.
7. **Delete what isn't load-bearing**: one pull request per removal with its numbers. A removed
   skill follows the deprecation path (promoting-learnings): `metadata.deprecated`, rename entry,
   a routing case that fails if it triggers, deletion next minor release. A removed rule or subagent is
   deleted outright; git history is the archive.
8. **Re-route.** Update per-role model and effort defaults from the sweep (planner, coder, evaluator,
   explorer); record each change with its cost and pass-rate delta.
9. **Update the playbook and evidence.** Bump the playbook's "as of" date and next review date;
   re-check every page's "Revisit when" trigger and list which fired; add a `measured` evidence entry
   to each skill whose fate changed (kept with numbers, or removed); log the review in the changelog
   (removals are behavioral, or breaking if consumers referenced them).
10. **Write the review record** ([review-record](references/review-record.md)) and open it as a
    pull request with the removals and re-routing pull requests linked.

## Outputs

- `harness-reviews/YYYY-MM-DD-<model-or-quarter>.md` (in the reviewed repository):
  baseline, sweep table, ablation table, decisions, triggers fired, spend.
- One pull request per removal and one for re-routing; none merged by you.
- `measured` evidence entries (`Source` naming the suite commit and command; `Engine`, `Model`,
  `Skill version`) in affected skills; a changelog line; the playbook "as of" bump.
- `toolkit.lock` unchanged by the review itself; pack bumps that follow are their own pull requests.

## Gates and stop conditions

- A removal ships only through a pull request a human merges, with the numbers in its description.
- Set attention `needs-human` and stop when:
  - anyone proposes removing or loosening a wall, or a component exists because an ADR or an incident
    says so (a human supersedes the ADR first);
  - the suite cannot detect the effect: fewer than 20 real-failure tasks and the ablation delta sits
    inside baseline noise. Report "inconclusive, kept" and the cases needed;
  - the review's spend would pass its declared cap;
  - the new model fails a scenario the old model passed with the full harness (a regression, not a
    removal question): report it before any deletion.

## References

- [references/components.md](references/components.md): what is a candidate, what is a wall, how to
  disable each kind.
- [references/ablation.md](references/ablation.md): trial counts, noise, decision rule, ordering.
- [references/review-record.md](references/review-record.md): the harness-review record template.
- [references/engine-notes.md](references/engine-notes.md): selecting model and effort per engine
  (adapters own the mapping).
