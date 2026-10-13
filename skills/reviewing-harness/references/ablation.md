# Ablation: how to decide a component is not load-bearing

## Order of runs

1. **Baseline, twice**: current harness, current model, same trial counts. The difference between
   the two runs is your **noise** (pass rate and median cost).
2. **Effort sweep**: new model alone (walls on, no optional components) at each effort level on the
   real-failure tasks.
3. **Full harness** on the new model at the chosen effort.
4. **One ablation per run**: the full harness minus one candidate, on the cases the candidate could
   affect (its routing cases, its scenarios, and every real-failure task). Never remove two at once:
   interactions hide which one mattered.

Isolate every trial (fresh checkout or sandbox, no access to previous trials' history).

## Trial counts

| Suite part | Trials |
|---|---|
| routing | 3 runs of every case |
| scenarios | the scenario's own k (3, 5 or 10 by risk) |
| real-failure tasks | at least 3 per task; 5 when the suite has fewer than 20 tasks |

For economy, screen candidates on the ~20-case smoke suite, then confirm any proposed removal on the
full suite before opening its pull request.

## Decision rule

A component is **not load-bearing** only if, with it removed:

- every scenario that passed `k/k` with it still passes `k/k`;
- routing stays at 100%, including neighbours' near-misses;
- the real-failure pass rate drops by no more than the measured noise;
- median cost and wall time per task do not rise.

Otherwise it is **load-bearing** and stays. **Inconclusive** (the effect is within noise and the
suite is small) means it stays, and the report names the cases that would decide it.

A component that helps on cost but not on quality (or the reverse) is a trade-off for a human to
decide; record both numbers.

## Recording

One row per ablation in the report: component, cases run, pass rate with and without, scenarios
`n/k` with and without, median cost and time with and without, decision. Each removal's numbers also
go into a `measured` evidence entry in the affected skill (or the playbook page for a rule).
