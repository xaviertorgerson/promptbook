# The harness-review record

Path: `harness-reviews/YYYY-MM-DD-<model-or-quarter>.md` in the repository whose harness was
reviewed (the project, a pack, or the harness itself).

```markdown
# Harness review — YYYY-MM-DD — <model release or quarter>

- **Trigger:** <model> released <date> | quarterly
- **Reviewed:** harness <version> @ <commit>; packs <name version, ...> (from toolkit.lock)
- **Suite:** <commit>; <n> routing cases, <n> scenarios, <n> real-failure tasks
- **Trials:** routing ×3; scenarios at their k; tasks ×<n>
- **Spend cap / spent:** $<cap> / $<spent>
- **Noise (baseline vs baseline):** pass rate ±<x> points; median cost ±$<y>

## Baseline (current harness, current model)
| Part | Result | Median cost | Median time |
|---|---|---|---|

## Effort sweep (new model alone, walls on)
| Effort | Task pass rate | Median cost | Median time |
|---|---|---|---|

## Full harness on the new model
| Part | Result | Median cost | Median time |
|---|---|---|---|

## Ablations (one component removed per row)
| Component | Kind | Cases run | Pass with / without | Scenarios n/k with / without | Cost with / without | Decision |
|---|---|---|---|---|---|---|

## Decisions
- Removed: <component> — PR <link> — numbers in the row above
- Kept (load-bearing): <component> — why
- Kept (inconclusive): <component> — cases needed to decide
- Re-routed: <role> <old model/effort> → <new> — PR <link>

## Playbook
- As of: <old> → <new>; next review: <date>
- "Revisit when" triggers that fired: <page: trigger>, or none

## Questions for a human
- <anything needing needs-human: a wall that looks redundant, a trade-off, an ADR to supersede>
```

Keep the record factual: numbers measured in this review, each with its command. Estimates are
labelled as estimates; no invented token counts.
