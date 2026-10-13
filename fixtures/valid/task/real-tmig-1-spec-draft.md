---
id: TMIG-1
epic: template-migration
parent: null
status: spec-draft
priority: P1
size: M
cuj: CUJ-1
guiding_docs:
  - specs/template-migration/spec.md
  - DECISIONS.md#ADR-0019
  - DECISIONS.md#ADR-0014
  - DECISIONS.md#ADR-0018
  - template-update/MANDATE.md
  - template-update/SETUP.md
branch: feat/tmig-1-script-deploy
depends_on: []
owner: null
---

# TMIG-1 · Inventory, deploy and rollback scripts, and releases/current.json

## Context
ADR-0019 replaces Coolify's API with forty lines of shell over an inventory. This task writes the
primitive every later task calls: `ops/hosts.example.yaml`, `ops/deploy.sh <stage> <tag>`,
`ops/rollback.sh <stage>`, and `ops/cloud-init.yaml`, all runnable with `--dry-run` so they are
tested without a box. It changes no workflow (TMIG-3 does). `template-update/MANDATE.md` §"Boxes,
hardening, and scaling" and `template-update/SETUP.md` §"Your own Linux servers" are the target
state; ADR numbers in `template-update/` are off by two, `DECISIONS.md` wins.

## Acceptance criteria (EARS)
- AC-1 — When `ops/deploy.sh` runs for a stage and tag, the deploy script shall act on exactly the hosts that `ops/hosts.yaml` lists for that stage, in file order.
- AC-2 — When the deploy script deploys a host, it shall write that host's `.env` from the stage's environment variables, pull the tag, and restart only the compose stack of the host's role with `--wait`.
- AC-3 — When every host of the stage is ready, the deploy script shall publish `releases/current.json` to the R2 releases bucket naming the stage, the tag, and the image digests.
- AC-4 — If any host fails its restart or readiness check, then the deploy script shall exit non-zero, name the host, and leave `releases/current.json` unchanged.
- AC-5 — When `ops/rollback.sh` runs for a stage, the rollback script shall call `ops/deploy.sh` for that stage with the tag of the previous release entry.
- AC-6 — Where `--dry-run` is given, the deploy and rollback scripts shall print every remote command and R2 write without running them.
- AC-7 — The deploy and rollback scripts shall contain no reference to Coolify, its API, or a webhook.
- AC-8 — The `ops/cloud-init.yaml` file shall configure key-only SSH, no root login, unattended upgrades, Docker, and a start of the role's stack from the image named in `releases/current.json`.

## Open questions
- [ ] How does a GitHub runner reach a box with zero inbound rules: `cloudflared access ssh` through Access for Infrastructure (ADR-0014), or the setup-only allow-listed IP? Blocks AC-2's test shape.
- [ ] Exact `releases/current.json` shape: one object per stage at `releases/<stage>/current.json`, or one file keyed by stage? ADR-0019 says `releases/current.json`; burst boxes need the production entry.
- [ ] Does `ops/hosts.yaml` stay project-owned like `ops/ci.json` (the template ships `ops/hosts.example.yaml`)? Proposed yes.
- [ ] Is a POSIX-shell test harness acceptable for AC-1..AC-6 (a `--dry-run` transcript compared in a `.test.mjs`), given the repo has no test runner yet?

## Agent log (append-only, newest last)
- 2026-10-13 planner — drafted from ADR-0019 and the epic spec; status spec-draft until the open questions are answered and the epic is approved.
