---
name: routing-models
description: Use when choosing which model tier and effort each agent role runs at, or sizing a run's budget — "which model should the explorer use", "set the subagent models", "this is too expensive, what can run cheaper", "should we add an advisor model", "what budget for an L task", "is a smaller model good enough for review", "our cache hit rate dropped" — routing by role at task and subagent boundaries (planner/orchestrator, author, evaluator, explorer/reader, summarizer) to abstract tiers (frontier, standard, fast), effort before model, cache-aware, explicit per subagent, and measured with an eval before adopting an advisor or a cheaper tier. Do not use for looking up an engine's current model names or settings keys (the adapters; references/engine-notes.md here is only a dated pointer), for dispatching or capping the runs themselves (orchestrating-work), or for the operator's permission tiers (adopting-harness).
license: MIT
compatibility: Any agent runtime that lets you set a model and effort per role or subagent. Optional - run records (run-record contract) for measurement.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Routing models

Pick a model tier and effort per role, at the boundary where a task or subagent starts, and write it
down explicitly. The order of levers is: don't load it → keep the cache warm → batch → tune effort →
only then change models. Every routing change is a hypothesis until an eval on your own tasks beats
the strong model at its best effort.

## Inputs

- The task file (`task` contract): `size` (XS..XL), `risk` (low, medium, high, or `{level,
  irreversible}`), `mode`, `budget`, `evaluator`.
- The role being started: planner/orchestrator, author, evaluator, explorer/reader, summarizer.
- The grant's `limits.budget` when work runs under one; the operator policy's `budgets` per tier.
- Run records (`run-record`): `model`, `num_turns`, `total_cost_usd`, `outcome`, `subtype`; cache
  tokens where the runtime exports them.
- The project's eval suite (scenarios with pass^k) for the comparison.

## Procedure

### 1. Route by role, to abstract tiers

| Role | Tier | Effort | Why |
|---|---|---|---|
| planner / orchestrator | frontier | medium; high for risk high or an XL decomposition | errors here compound across every task |
| author (the single writer) | frontier for M and up or risk ≥ medium; standard for XS–S, risk low | medium; high when the last run failed | sequential coding degrades fastest with a weaker model |
| evaluator | frontier or standard from a **different model family** than the author where available; else a different session and prompt | high | independence and an objective artifact matter more than size |
| explorer / reader (search, read, summarize code) | fast | low | read-heavy, narrow, high volume |
| summarizer (compress logs, condense a return) | fast | low | mechanical; never the one deciding |

Tiers are abstract: **frontier** = the strongest generally available model you route to;
**standard** = the mid tier; **fast** = the cheapest tier meant for subagents. The current vendor
mapping is in `references/engine-notes.md`, dated, marked "verify on use"; adapters own it.

### 2. Effort before model

1. Before adding any tier, run the strong model alone across effort levels on 20–50 of your own
   tasks (`references/measuring.md`). That curve is the baseline every multi-model setup must beat.
2. A useful default: run at a lower effort first and re-run only the failures at high.
3. Raise effort before raising tier; lower effort before lowering tier.

### 3. Route only at boundaries

- Choose model, effort and tool list when a task or subagent starts. Never change them mid-session:
  a different tool list, model or effort forfeits the cached prefix.
- Keep the prefix stable: instructions first, then tools in a fixed order, no timestamps or run ids
  in it; append, never edit, earlier turns.
- When a role needs a different model, end the session at a checkpoint (commit, handoff, return)
  and start the next role fresh.

### 4. Set every subagent's model explicitly

Engines default subagents to the parent's model, so a frontier main session pays frontier rates for
every search. Write the model and effort into each role's definition (per engine, by the adapter or
the L4 pack). "Inherit" is a cost decision; make it on purpose and record why.

### 5. Size the budget from size and risk

Start from `references/budgets.md` and record the result in the task's `budget`; the runtime enforces
it per run. Tighten with your own run records: set `max_usd` near the 90th percentile of advanced
runs for that size, and raise it only with evidence. A breach stops the run (`needs-human`); never
retry with a silently bigger budget.

### 6. Advisors and cheaper tiers only after an eval

- An advisor helps only when it is **stronger** than a **competent** executor that is **prompted to
  consult it** (a few times per task). Same-strength advisors, or advisors nobody consults, only add
  cost. Cap the advisor's output.
- Before adopting an advisor, a cheaper author or evaluator tier, or a per-prompt router, run
  `references/measuring.md`: same tasks, k ≥ 3 trials each, compare pass^k and cost per passing task
  against the effort-swept baseline. Adopt only if quality holds within the stated tolerance and cost
  falls, or quality rises at a cost the human accepts. Record the result in the project's evidence.

### 7. Watch and revisit

Watch cost per task to `merged`, cache hit rate (cache-read ÷ input tokens) and evaluator first-pass
rate. A cache-hit drop names a cause: a changed prefix, a mid-session switch, a reordered tool list.
Revisit routing on each model release, when tier price ratios or cache multipliers change, or when
run records show a role burning budget without moving tasks.

## Outputs

- A routing table for the project (role → tier, effort, model family, rationale), kept with the L4
  pack's role definitions; per-engine model ids are filled in by the adapter, not here.
- Each task's `budget` set from size and risk.
- Evidence entries for every routing change, with the eval that justified it.

## Gates and stop conditions

Ask the human (`needs-human`) before: moving the author or evaluator to a cheaper tier; adding an
advisor or router to a production loop; raising a budget above the grant's or the policy's ceiling;
routing work to a vendor or region not already approved. Stop and report when an eval shows the
cheaper route losing quality, when a budget breach repeats on one task, or when the cache hit rate
stays low after the prefix is fixed.

## References

- `references/tiers.md` — the role table with rationale and what each role must never be routed to.
- `references/budgets.md` — starting budgets by size and risk, and how to tighten them from run records.
- `references/caching.md` — cache economics and the prefix rules.
- `references/measuring.md` — the comparison protocol for an advisor or a cheaper tier.
- `references/engine-notes.md` — the current vendor mapping (dated 2026-10, verify on use).
