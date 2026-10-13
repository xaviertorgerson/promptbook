# Roles and tiers

## Tiers (abstract)

| Tier | Meaning | Typical price position |
|---|---|---|
| frontier | the strongest generally available model you route to for agentic coding | highest |
| standard | the mid tier: strong everyday coding, faster, cheaper | middle |
| fast | the cheapest tier documented for subagents and high-volume narrow work | an order of magnitude cheaper on input |

A "top" tier above frontier (multi-hour sessions, deep research) exists at some vendors; route to
it only when evals at the frontier tier's highest effort still fall short.

## Roles

| Role | Default | Escalate when | Never |
|---|---|---|---|
| planner / orchestrator | frontier, medium effort | risk high, XL decomposition, repeated plan rejections → high | fast tier; a mid-session switch |
| author | frontier, medium (M+ or risk ≥ medium); standard, medium (XS–S, risk low) | the last run failed on the same criteria → high effort, then frontier | a weaker tier for a retry of a failed run |
| evaluator | a different family from the author, high effort; frontier where the author is frontier | false passes found later → stronger tier | the author's own session; the author's transcript as input |
| explorer / reader | fast, low | answers come back wrong or incomplete twice → standard | writing files other than its findings |
| summarizer | fast, low | — | deciding anything; rewriting a finding the parent forwards |

## Why role-based, not per-prompt

Per-prompt routers were measured on chat benchmarks where an early mistake does not compound. In an
agent run a weak model's early error carries through every later step, and switching per turn
forfeits the cache. So route once per role, at the boundary, and measure.

## Independence for evaluators

A different model family is the strongest form of independence available; a different session with
a different prompt is the minimum. Same-family, same-context self-review is not an evaluation.
