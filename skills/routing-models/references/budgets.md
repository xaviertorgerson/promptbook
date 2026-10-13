# Budgets by size and risk

Starting points for a task's `budget` (common `budget`: `max_turns`, `max_usd`, `max_minutes`,
`max_tokens`). They assume the author on the frontier tier at medium effort with a warm cache. The
runtime enforces them per run; a breach stops the run with attention `needs-human`. The numbers are
this skill's starting recommendation, not a measurement: replace them with your own run records.

| size | max_turns | max_usd | max_minutes |
|---|---|---|---|
| XS | 40 | 1 | 20 |
| S | 80 | 2 | 40 |
| M | 150 | 5 | 90 |
| L | 200 | 10 | 180 |
| XL | split it first: a task larger than one focused session is split before it is ready | — | — |

Risk adjustments:

| risk | Change |
|---|---|
| low | as above |
| medium | +50% `max_usd` for the evaluator's re-runs; the evaluator is mandatory |
| high or irreversible | not run unattended; a human gate at the consequential step; budget as medium |

Pack and runtime defaults are 200 turns and $5 per run (the loop and CI agents); a task's `budget`
overrides them downward or upward, and a grant's `limits.budget` caps the sum across its tasks.

## Tightening from run records

1. Group run records with `outcome: advanced` by task size.
2. Set `max_usd` near the 90th percentile and `max_turns` near the 90th percentile of `num_turns`.
3. Runs that hit a ceiling (`subtype` naming max turns or max budget) are reviewed, not re-run
   bigger: split the task, add a guiding doc, or fix the plan.
4. Re-derive monthly and after each model or price change.

## Grant budgets

`limits.budget.max_usd` ≈ Σ(task budgets in scope) × 1.3 for evaluator re-runs and one retry each.
Spend is summed from run records carrying `grant: GRANT-n`; reaching it stops delegated work.
