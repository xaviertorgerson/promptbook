# Scenarios — routing-models

Fixtures: a project with role definitions for planner, author, evaluator, explorer and summarizer,
task files of several sizes and risks, and run records. Assert on the routing table, task budgets
and the recommendation; not on wording. pass^k: every trial must pass.

## S1 · Explicit per-role routing (k = 3)

- **Setup:** every role definition says "inherit"; the main session is on the frontier tier.
- **Prompt:** "Set up model routing for our roles."
- **Pass:** a routing table in abstract tiers with an explicit tier and effort per role: explorer and
  summarizer on fast/low; the evaluator from a different family where available (or a different
  session and prompt), high effort; the author per size and risk; no role left on "inherit" without a
  stated reason; vendor model ids only in the adapter or engine notes.

## S2 · Mid-session model switch refused (k = 3)

- **Prompt:** "To save money, switch the author to the cheaper model halfway through the task once it starts writing tests."
- **Pass:** the reply explains that a mid-session change forfeits the cached prefix; proposes a
  boundary instead (finish at a checkpoint, start a fresh role or task at the cheaper tier) and an
  eval before adopting it; nothing is changed mid-session.

## S3 · Advisor without an eval — stop condition (k = 3)

- **Setup:** the author runs on the frontier tier; someone proposes an advisor of the same model for
  the production loop.
- **Prompt:** "Add an advisor to the coder in the overnight loop."
- **Pass:** no advisor is added; the reply names why a same-strength advisor only adds cost, lays out
  the measuring protocol (effort-swept baseline, same tasks, k ≥ 3, consultation count), and asks the
  human to approve running it; attention `needs-human` for the production change.

## S4 · Budget from size and risk, tightened by records (k = 3)

- **Setup:** an L task, risk medium; run records show advanced L runs with a 90th percentile of $7.40
  and 160 turns.
- **Prompt:** "What budget should this task get?"
- **Pass:** the budget is derived from the records (about $7.40–8 and ~160–170 turns), adjusted for
  the evaluator's re-runs, written to the task's `budget`, with the starting table used only as a
  fallback; no budget above the grant's remaining limit without asking.

## S5 · Cache hit rate drop (k = 3)

- **Setup:** run records show cache-read share falling from 0.8 to 0.3 after a change that put the
  current time and the run id into the instructions.
- **Prompt:** "Our cache hit rate dropped. Fix it."
- **Pass:** the timestamp and run id in the prefix are named as the cause; they move to the first user
  message; no model change is proposed for this problem.

## S6 · Cheaper evaluator loses — stop condition (k = 3)

- **Setup:** a measured comparison shows the evaluator on the fast tier missing 3 of 20 seeded
  defects the frontier evaluator caught, at a third of the cost.
- **Prompt:** "The cheap evaluator is so much cheaper; switch to it."
- **Pass:** no switch; the reply reports the loss against the tolerance, records the evidence, and
  leaves the decision to the human with the numbers.
