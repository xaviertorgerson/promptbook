# Critical User Journeys — Move the deploy implementation to ADR-0015 and ADR-0019

## CUJ-1 · A merge reaches dev, and the train carries it on, with no control plane
- **Actor:** the merge to `main` (app-ci), then the train (train.yml)
- **Goal:** the one image runs on every host of the stage, and a box created later starts the same image
- **Trigger:** a merge to `main`, or a scheduled train hop → an EARS *Event-driven* criterion.
- **Steps:**
  1. CI builds the image once and pushes it to GHCR by sha.
  2. `ops/deploy.sh <stage> <tag>` reads the stage's hosts from `ops/hosts.yaml`.
  3. For each host it writes `.env` from the workflow's secrets, pulls the tag, and restarts the role's stack with `--wait`.
  4. It publishes `releases/current.json` to R2 and records the GitHub deployment.
- **Success (observable):** every host of the stage answers `/health/ready` with the new tag, and `releases/current.json` names it.
- **Unwanted:** a deploy step that needs Coolify, a dashboard on a box, or wrangler.

## CUJ-2 · A bad release is rolled back by the same primitive
- **Actor:** an operator, or `canary-watch.yml` on an error-rate breach
- **Goal:** the previous image is serving within minutes, without a rebuild
- **Trigger:** `ops/rollback.sh <stage>`, or a canary breach.
- **Steps:**
  1. The previous release entry is read (GitHub deployment records, `releases.log` on the box).
  2. `ops/deploy.sh <stage> <previous tag>` runs.
- **Success:** the stage serves the previous tag; `releases/current.json` names it.
- **Unwanted:** a rollback that rebuilds, touches git history, or rolls the web app back separately from the api.

## CUJ-3 · A visitor gets the public site even when every box is down
- **Actor:** a visitor's browser, through Cloudflare
- **Goal:** prerendered pages load; `/api/*` reaches the api; there is one origin and one cookie
- **Trigger:** a request to `app.<domain>`.
- **Steps:**
  1. Cloudflare serves a cached prerendered page or hashed asset, or forwards to the tunnel.
  2. The tunnel ingress sends `/api/*` to `api:3000` and everything else to `web:4000`.
- **Success:** with the app stack stopped, marketing pages and the app shell still load from cache; only `/api/*` fails.
- **Unwanted:** a second origin (a Worker), CORS code, or HTML cached past its revalidation window.

## CUJ-4 · An agent reading the repo finds one story
- **Actor:** an agent (or a new operator) asked to change the deploy
- **Goal:** every file it reads describes the same deploy as `DECISIONS.md`
- **Trigger:** a session loads the contract, a rule, a skill, or a deploy doc.
- **Steps:**
  1. The always-loaded text states the ADR-0015 / ADR-0019 stack.
  2. `deploy-check`, `ci-config`, and the docs agree with it.
- **Success:** `node scripts/decision-drift.mjs` reports no warning and no failure, with every term failing repo-wide.
- **Unwanted:** a transition sentence that outlives the migration, or a retired term reappearing without the gate failing.

> Each CUJ is covered by at least one task's `cuj:` and criteria (see `spec.md` → Tasks).
