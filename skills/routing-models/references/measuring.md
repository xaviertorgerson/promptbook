# Measuring a routing change

Use this before adopting an advisor, a cheaper author or evaluator tier, a per-prompt router, or an
effort change for a whole role.

## Protocol

1. **Pick the tasks.** 20–50 tasks drawn from the project's real work and real failures, each with
   an objective grader (tests named for its AC ids, a rubric, a script). Freeze the set.
2. **Baseline: effort sweep on the strong model alone.** Run the frontier tier at each effort level
   (and "low first, re-run failures at high"). k ≥ 3 trials per task, isolated (no shared history).
   Record per configuration: pass^k (all trials pass), mean cost per task, cost per passing task,
   p90 cost, wall time.
3. **Candidate.** Run the proposed route on the same tasks with the same k. For an advisor, prompt
   the executor to consult it a few times per task and log consultations; an advisor consulted zero
   times is a failed candidate.
4. **Compare** against the best baseline point, not the default effort:

| Outcome | Decision |
|---|---|
| pass^k within tolerance (default: no more than 2 points lower) and cost per passing task lower | adopt for that role; record evidence |
| pass^k higher and cost higher | the human decides; record the trade |
| pass^k lower beyond tolerance | reject; record evidence |
| advisor consulted on < 1 in 10 tasks | reject; it only adds cost |

5. **Record** an evidence entry: date, tasks and k, configurations, numbers, decision, revisit trigger.
6. **Re-run** on every model release and price change; a winning route can lose after either.

## Common traps

- Comparing a multi-model setup against the strong model at its default effort and calling the gap a win.
- One trial per task: 75% per trial is about 42% over three trials.
- Router savings measured on chat benchmarks, applied to agent runs.
- Counting tokens instead of dollars across tiers with different prices.
