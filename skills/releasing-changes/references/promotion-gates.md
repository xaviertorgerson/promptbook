# Stages, promotion gates, rollback

## Stages (names are the pack's; this is the shape)

| Stage | Gets the digest when | Data | Who may deploy |
|---|---|---|---|
| preview (per PR) | every push to the PR | cloned or seeded, isolated per PR | CI, agents |
| dev | every merge to the default branch | synthetic, reset regularly | CI |
| QA | the newest digest that passed the full suite on dev | scrubbed copy, never real personal data | the train |
| UAT (optional) | the QA digest after its dwell, no open blocker | scrubbed copy plus tester accounts | the train |
| production | the last pre-production digest after its dwell | real | the train, after a human approves |

The workflow contract's release machine tracks one digest: `built` (CI) → `staged` (each
pre-production hop, by the train) → `released` (production, by the owner at the
`production-release` gate) → `rolled-back` (train, owner or engineer); `held` stops it.

## Per-hop gates (each its own step; stop on the first red)

| # | Gate | Passes when | Red means |
|---|---|---|---|
| 1 | No hold | no open hold issue or label, no red restore drill | a human holds the train |
| 2 | Built and tested | the required checks and the artifact build passed for this commit | the digest is not the tested one |
| 3 | Same digest | the digest about to deploy equals the one the source stage ran | a rebuild crept in |
| 4 | Probe over the dwell | the off-box probe of the source stage has had no failure since the digest arrived there, and the dwell time has passed | instability under real traffic |
| 5 | Error rate | the source stage's error rate over the last day is under the threshold (the template's default 0.01) | regressions users would see |
| 6 | Smoke on the target | after deploying, the smoke suite against the target stage passes | the deployment itself is broken |

A red gate: stop, open an issue titled `train: stopped at <hop>` with the failing step's output,
leave the digest where it was. Never retry on its own. A skipped gate (for example, no analytics key
for the error rate) is reported as skipped, not as passed.

## Automatic rollback

- **Watch:** during a production rollout, compare the new digest's error rate and probe results to
  the previous digest's, every few minutes, for a fixed window (the template: every 15 minutes, for
  a day, with traffic steps of 10%, 50%, 100%).
- **Trigger:** error rate above the previous digest's by more than the tolerance (the template's
  default ratio 1.5), or a failed probe.
- **Action:** deploy the previous digest (the deployment record names it), place a hold, open an
  issue with the evidence. The release machine moves `released` → `rolled-back` by the train.
- **Never:** check out an old commit and rebuild; "fix" on the box; roll back the database schema
  (expand/contract keeps the previous digest compatible).

## Rollback drill

Rehearse at least once before the first production release and after any change to the deploy
shape: deploy digest N, then N−1 by the same command, and confirm the smoke suite passes on both.
A restore drill for data (base backup plus log replay into a scratch instance, then the smoke
suite) runs on its own schedule; a red drill places a hold.

## Hotfix

Branch from the production tag, land through a normal PR (landing-changes), build once, and
dispatch the digest straight to the last pre-production stage and then production with the same
human approval. The calendar is skipped; the gates are not.
