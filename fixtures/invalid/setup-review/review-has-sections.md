# Setup review — 2026-10-13 — model-5.5

- **Trigger:** model-5.5 released 2026-10-08
- **Reviewed:** promptbook 0.2.0 @ 9dfd497; packs core-pack 1.0.0, cli-runtime 1.0.0 (from toolkit.lock)
- **Suite:** a17a854; 336 routing cases, 84 scenarios, 22 real-failure tasks
- **Trials:** routing ×3; scenarios at their k; tasks ×3
- **Spend cap / spent:** $60 / $41.20
- **Noise (baseline vs baseline):** pass rate ±3 points; median cost ±$0.04

## Baseline (current setup, current model)
| Part | Result | Median cost | Median time |
|---|---|---|---|
| tasks | 17/22 | $0.88 | 14 min |

## Full setup on the new model
| Part | Result | Median cost | Median time |
|---|---|---|---|
| tasks | 19/22 | $0.71 | 11 min |

## Decisions
- Removed: explorer subagent — PR #301 — no pass-rate change, 13% cheaper
- Kept (load-bearing): reviewer round 2 — three tasks regress without it

## Playbook
- As of: 2026-07-14 → 2026-10-13; next review: 2027-01-13
- "Revisit when" triggers that fired: none

## Questions for a human
- None.
