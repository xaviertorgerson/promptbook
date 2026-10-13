# Forge and platform notes

The procedure says "the forge", "the registry", "the train". These notes map one implementation;
the harness `adapters/ci` and the stack pack own the mapping.

## agentic-template (agentic-saas pack), as of commit bbfad58

- One image per merge to `main`, pushed to the forge's container registry as `sha-<12>` and by
  digest; the web build uploaded once as an artifact. Boxes pull by digest; nothing is built on a box.
- `train.yml` promotes dev → QA (weekdays) → UAT (Mondays, 3 days in QA) → production (Wednesdays,
  2 days in UAT), checking, each as its own step: no `train:hold` issue, CI green on the sha, the
  off-box probe over the dwell, the analytics error rate under `TRAIN_ERROR_RATE_MAX` (0.01), and
  the smoke suite after deploy. A red hop opens `train: stopped at <hop>` and exits; it never retries.
- Production goes through the `production` GitHub Environment's required reviewer; with
  `TRAIN_AUTO_PROD=true` the train uses `production-auto`, which has none. That switch is a human's
  config change, never a grant (the workflow contract's `production-release` gate is not grantable).
- `canary-watch.yml` compares the new version's error rate with the previous one every 15 minutes,
  steps traffic 10% → 50% → 100% over eight hours, and on a breach rolls back on its own and opens a
  `train:hold` issue. `ops/rollback.sh <stage> [image@digest]` redeploys the previous image.
- `preview.yml`: a preview URL for the web app and an API preview with a database cloned from the
  QA data stack per PR; closing the PR deletes the preview app.
- `scripts/release.mjs` cuts an annotated tag with notes from Conventional Commits (no changelog file).
- Risky API behavior ships behind analytics-platform flags; `ENABLE_*` toggles default off outside
  production.

## Forgejo

No environment approvals: the production hop stays `workflow_dispatch`-only, run by a human.

## Agents in this pack

Every agent role is forbidden to deploy to production in the roles matrix; no agent workflow holds
the production deploy credential.
