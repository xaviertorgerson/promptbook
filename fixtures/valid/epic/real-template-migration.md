---
epic: template-migration
status: draft
priority: P1
size: L
business_value: high
initiative: null
owner: null
---

<!-- The template's own epic, not an illustrative one: it moves the template's implementation to the
     ADRs it already accepted. A child that copies the template deletes this folder with the
     rating-engine example. -->

# Epic: Move the deploy implementation to ADR-0015 and ADR-0019

- **Owner / date:** unassigned (needs a product owner to approve) · 2026-10-13
- **CUJs:** [`cuj.md`](cuj.md)  ·  **ADRs:** [ADR-0014](../../DECISIONS.md), ADR-0015, ADR-0018, ADR-0019 (the ones this epic implements); ADR-0013 and ADR-0016 where a task touches their files
- **Rationale (value vs effort):** high value: every child that syncs today receives a Coolify +
  wrangler pipeline that contradicts its own `DECISIONS.md`, and an agent asked to "fix the deploy"
  has two incompatible specs to choose from. L effort, but it is mostly removal and every task is
  testable without a box. P1, after nothing.

## Problem / motivation
ADR-0015 (2026-09-23) moved the web app off Cloudflare Workers into a `web` container from the one
image, and ADR-0019 replaced Coolify with `ops/deploy.sh <stage> <tag>` over an `ops/hosts.yaml`
inventory publishing `releases/current.json` to R2. The contract now says so, but the workflows,
`ops/`, `scripts/deploy-check.mjs`, `scripts/ci-config.mjs`, `ops/ci.example.json`, the mandate,
the deploy docs, and the `deploy-readiness` skill still implement ADR-0009.
`node scripts/decision-drift.mjs` counts 228 mentions across 25 files on the day this was written.

## Scope
**In:** the inventory, `deploy.sh` / `rollback.sh` rewritten for it, `releases/current.json`;
`ops/cloud-init.yaml` (ADR-0019 names it as the box's only shape); the `web` service, its cache
headers, and the tunnel ingress in `ops/app-stack.yaml` (ADR-0014, ADR-0015); every workflow that
deploys calling `ops/deploy.sh` with no `COOLIFY_*` secret and no wrangler step; `deploy-check`,
`ci-config`, `ops/ci.example.json`, `ops/env.stage.example`; `docs/mandate.md`, `docs/ci-cd.md`,
`docs/operating-guide.md`, the runbook and deploy-readiness templates, the `deploy-readiness` skill,
`PORTFOLIO.md`, `TEMPLATE-USAGE.md`, `FUTURE.md`, `knowledge/hosting-a-small-product-cheaply.md`;
removing the transition sentences and making `decision-drift` fail repo-wide.
**Out:** landing `template-update/` wholesale (its ADR numbers are 0009–0018; `DECISIONS.md` is
authoritative). The other accepted-but-unimplemented ADRs below, unless a task here touches their
file. Migrating any child (Heirloom, Handshake, weather markets): each child runs its own epic
after the template release.

### Other ADRs among 0011–0020 accepted but not yet implemented (inventory, not scope)
Verified against the tree on 2026-10-13. Each becomes its own epic; none blocks this one.

| ADR | What is missing |
|---|---|
| ADR-0011 (database dial) | `FUTURE.md` and `docs/mandate.md` still carry the Neon-at-first-paying-customer trigger; no `/db-dial` skill; no pgvector in `ops/postgres/Dockerfile`; `PORTFOLIO.md` has no dial column |
| ADR-0012 (pg-boss; Valkey only as overlay) | no `.claude/rules/queue.md`; `deploy-check` does not warn on an overlay Valkey without `noeviction` + `appendonly` |
| ADR-0013 (layered compose) | no `compose.project.yml` or `ops/*.project.yaml` overlays; no `ops/services.json`; the sync does not exclude `*.project.*` by rule; no `PG_BASE` build arg |
| ADR-0014 (tunnel is the ingress) | `api` still has `expose`; the ingress is not in `ops/app-stack.yaml`; no `compose.prod.yaml --profile local` (partly in scope: TMIG-2) |
| ADR-0016 (elastic workers) | no `scripts/scale-workers.mjs`, `scale-workers.yml`, or `ops/cloud-init.yaml` burst role; no `.claude/rules/queue.md` (heartbeat file exists) |
| ADR-0017 (Better Auth asserted) | `docs/_RBAC-TEMPLATE.md` keeps its own session language; no `.claude/rules/security.md`; `bootstrap` does not assert `packages/policy` |
| ADR-0018 (the train, restated) | the train and canary run (`train.yml`, `canary-watch.yml`), but deploy through Coolify and split web traffic with wrangler; preview is per-PR Coolify app, not a compose project on the dev box (in scope: TMIG-3, TMIG-4) |
| ADR-0020 (manifest + template-check) | no `template-manifest.json`; `TEMPLATE-SYNC.md` is hand-written; `template-check.yml` checks neither version distance, hashes, nor `ops/ruleset.json` |

## Requirements

| # | Requirement (one behavior) | Module it touches | Verified by |
|---|---|---|---|
| R1 | A stage deploy reads hosts from `ops/hosts.yaml`, writes each host's `.env` from the workflow's secrets, pulls the tag, restarts the host's role stack with `--wait`, and publishes `releases/current.json` to R2. | `ops/deploy.sh`, `ops/hosts.yaml` | a dry-run test over a fixture inventory |
| R2 | Rollback is the previous release entry deployed by the same script. | `ops/rollback.sh` | a dry-run test |
| R3 | A box from `ops/cloud-init.yaml` starts the image named in `releases/current.json` for its role. | `ops/cloud-init.yaml` | a lint test on the file; a rehearsal on a scratch box (manual) |
| R4 | The app stack runs `web` from the app image behind the tunnel; `/api/*` reaches `api`, all else reaches `web`; `migrate` gates `web`. | `ops/app-stack.yaml` | `deploy-check` rows |
| R5 | No workflow references a `COOLIFY_*` secret or runs wrangler; every deploy goes through `ops/deploy.sh`. | `.github/workflows/*` | a grep test over the workflow files |
| R6 | `deploy-check` asserts the ADR-0019 shape (`deploy.tool: script`, an inventory, cloud-init) and the `web` service; `ci-config` has no wrangler path. | `scripts/deploy-check.mjs`, `scripts/ci-config.mjs`, `ops/ci.example.json` | fixture tests |
| R7 | The deploy docs, runbook and readiness templates, and the `deploy-readiness` skill describe the script deploy and the `web` container. | `docs/`, `.claude/skills/deploy-readiness/` | `decision-drift` warn count reaches 0 for those files |
| R8 | The transition sentences are gone and `decision-drift` fails any retired term repo-wide. | `AGENTS.md`, `.claude/rules/stack.md`, `scripts/lib/retired-terms.json` | `node scripts/check.mjs` |

## Interfaces / contracts
- **Breaking for children:** `ops/ci.json` `deploy.tool` changes from `coolify` to `script`;
  `deploy.web.wrangler` is removed. GitHub secrets `COOLIFY_URL`, `COOLIFY_TOKEN`,
  `COOLIFY_APP_UUID_*`, `COOLIFY_PROJECT_UUID`, `COOLIFY_PREVIEW_SERVER_UUID` are removed;
  `DEPLOY_SSH_KEY` and the R2 release-bucket credentials are added. Each breaking change gets a
  `TEMPLATE-CHANGELOG.md` **breaking** line with its verify step, in the task that makes it.
- New files: `ops/hosts.yaml` (example inventory), `ops/cloud-init.yaml`. New R2 object:
  `releases/current.json` `{ "stage", "tag", "app_image", "db_image", "deployed_at" }` — exact
  shape is an open question on TMIG-1.
- `ops/deploy.sh <stage> <tag>` (two arguments) replaces `APP_IMAGE=… ops/deploy.sh <stage>`.

## Config
- `ops/hosts.yaml` — per host: name, address, role (`app` · `worker` · `data`), stages. Project-owned
  once copied (like `ops/ci.json`); the template ships `ops/hosts.example.yaml`.
- `DEPLOY_SSH_KEY` (secret), `RELEASES_BUCKET` (variable) — the deploy's only new switches.

## Risks & edge cases
- A child mid-flight on Coolify: the release is **breaking**; `ops/ci.json` `deviation` already lets
  a child declare "on Coolify until <trigger>" so its `deploy-check` warns instead of failing.
- SSH from GitHub runners into boxes with zero inbound rules: ADR-0014 says SSH goes through Access
  for Infrastructure; the deploy job needs `cloudflared access ssh` or the allow-listed setup IP.
  Open question on TMIG-1.
- Canary without wrangler: ADR-0015 makes canary PostHog flags plus image rollback; traffic
  splitting goes away. Behavior change for any child that relied on the 10% split.
- Security surface: SSH keys in workflow secrets, `.env` written on the box from secrets, R2 write
  credentials. Run `security-review` on TMIG-1 and TMIG-3.

## Tasks

| Task | Title | CUJ | Priority | Depends on |
|---|---|---|---|---|
| [`TMIG-1`](tasks/TMIG-1.md) | Inventory, deploy and rollback scripts, and releases/current.json | CUJ-1, CUJ-2 | P1 | — |
| [`TMIG-2`](tasks/TMIG-2.md) | The `web` service, its cache headers, and tunnel routing | CUJ-3 | P1 | — |
| [`TMIG-3`](tasks/TMIG-3.md) | Workflows deploy only through ops/deploy.sh | CUJ-1, CUJ-2 | P1 | `TMIG-1`, `TMIG-2` |
| [`TMIG-4`](tasks/TMIG-4.md) | deploy-check, ci-config, and the CI and stage env examples | CUJ-4 | P1 | `TMIG-1`, `TMIG-2` |
| [`TMIG-5`](tasks/TMIG-5.md) | Docs, the deploy-readiness skill, and the runbook and readiness templates | CUJ-4 | P2 | `TMIG-3`, `TMIG-4` |
| [`TMIG-6`](tasks/TMIG-6.md) | Remove the transition sentences; decision-drift fails repo-wide | CUJ-4 | P2 | `TMIG-5` |

## Acceptance (epic Definition of Done)
All R1–R8 verified · every task `merged` · `node scripts/decision-drift.mjs` reports 0 warnings
with every term at `elsewhere: "fail"` · `TEMPLATE-CHANGELOG.md` has the release's breaking lines ·
a template release is tagged. **Harvest:** the decision-drift gate itself is the generic learning
(an accepted ADR with no check on its consequences drifts within days); record whether any child
adopted `retired-terms.json`, or write "none" with why.
