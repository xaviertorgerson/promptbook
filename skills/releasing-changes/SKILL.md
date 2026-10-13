---
name: releasing-changes
description: Use when merged work has to reach an environment, or the user says "promote the build to QA", "ship this to production", "set up a preview environment per PR", "put this behind a feature flag", "dark launch it", "add a kill switch", "roll back the release", "why didn't the train promote", "make deploys roll back automatically", or "plan this migration so the release can roll back". Builds one immutable artifact per merge and promotes it by digest through the stages, gives each PR a preview the evaluator can run, launches risky behavior dark behind flags, watches each rollout with probes that roll back automatically, keeps migrations expand-then-contract, and writes a release record. Agents prepare and run pre-production stages; production is a human-approved gate. Do not use for merging to the default branch (landing-changes), for the credentials a deploy uses (handling-credentials), or for judging a change against its criteria (verifying-work).
license: MIT
compatibility: Any agent runtime with access to CI logs and the forge's deployment records; a registry that addresses artifacts by digest. No harness tool required.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Releasing changes

What testing passed must be exactly what customers get. Build once, promote the same digest, let the
running product (not a description of it) be judged, ship risk dark behind flags, and let probes,
not a person at 3 a.m., roll back a bad rollout. The production hop is always a human's decision.

## Inputs

- The release machine of the workflow contract: stages `built` → `staged` → `released`, side state
  `held`, terminal `rolled-back`; transitions `stage` (by train), `release` (by owner, gate
  `production-release`), `roll-back` (train, owner, engineer), `hold`/`unhold`.
- The artifact: its immutable digest, the commit it was built from, the CI run that built it.
- The pack's stage list and per-hop gates (checks green on the digest, probe green over the dwell,
  error rate under threshold, smoke suite on the target, no hold), and the forge's deployment
  records (where each digest is and since when).
- Flags in use, their owners and their default per environment.
- Pending migrations and their phase (expand, migrate, contract).

## Procedure

1. **Build once.** CI builds one immutable artifact per merge to the default branch and records its
   digest. No stage rebuilds; a tag is a pointer to a digest, never a rebuild trigger. Nothing is
   built or patched by hand on a box; a box is rebuilt from code.
2. **Preview per PR.** Each PR gets an ephemeral, isolated deployment of its own build with its own
   data (cloned or seeded, never production data), at a stable URL the evaluator and the human can
   open. Its migrations run against that copy. Closing the PR removes the preview and its data.
   Agents may deploy previews.
3. **Promote by digest.** Each hop deploys the same digest the previous stage ran. Before each hop
   the train checks, each as its own step, and stops on the first red (references/promotion-gates.md):
   no hold; checks green on the digest; probe green over the source stage's dwell; error rate under
   the threshold; after deploy, the smoke suite on the target. A red hop opens an issue and stops;
   it never retries silently. Agents may run and diagnose pre-production hops.
4. **Dark launch risky behavior.** New risky behavior ships behind a flag that is off everywhere,
   then on for the team, then for a percentage, then for all. Outbound and money-moving side effects
   default off outside production. Every flag has an owner, a kill switch, and a removal date
   (references/flags.md).
5. **Migrations expand, then contract.** A schema change that must roll back with the code is split:
   expand (additive, both versions work), migrate (backfill, idempotent, batched), switch reads, then
   contract (the drop) in a later release, after the previous digest can no longer return. A
   destructive step needs a recorded decision and a verified backup (references/migrations.md).
6. **Production is a human gate.** Prepare the release request (references/release-record.md): the
   digest, the commits and tasks it carries, the evidence from each hop, the flags and migrations,
   the rollback target. A human with the owner role approves the `release` transition in the
   forge's protected environment. No agent approves, triggers past, or holds the credential for it.
7. **Watch the rollout.** During and after the production rollout an off-box probe and an error-rate
   check compare the new digest against the previous one over a fixed window. A breach rolls back
   automatically to the previous digest (`roll-back`, by the train) and places a hold. Rollback is
   "deploy the previous digest", rehearsed, never a rebuild from an old commit.
8. **Record the release.** Write the release record and keep it with the forge's deployment record:
   digest, stages and times, gate results, approver, flags, migrations, rollback target, outcome.
9. **On a stop or a rollback,** report what failed with the evidence (the failing gate's output,
   the probe or error-rate graph link), hold promotion, and hand the decision to a human:
   fix forward through a normal PR, or unhold after the cause is understood.

## Outputs

- A digest promoted through the stages, its deployment records, and a release record per
  production release (references/release-record.md).
- A preview URL per PR, recorded in the task's `evaluator` refs or the PR for verifying-work.
- Flag entries with owner, default, kill switch and removal date; a migration plan per phase.

## Gates and stop conditions

- Never: deploy to production; approve the production environment; rebuild an artifact for a later
  stage; retry a red hop silently; fix a box by hand; ship a contract migration in the same release
  as the code that stops using the column; turn on an outbound or money-moving side effect outside
  production; hold or reuse a production credential.
- Hand to a human (attention `needs-human`, `next_action` naming the decision): any red promotion
  gate; an automatic rollback; a hold placed by a drill or an issue; a production release request
  ready for approval; a migration with a destructive step; a flag whose removal date passed; a
  preview that cannot be created for the evaluator (verifying-work cannot judge a change it cannot run).

## References

- references/promotion-gates.md — the stage table, per-hop gates, the rollback trigger and drill.
- references/flags.md — dark launch steps, kill switch, flag registry fields, cleanup.
- references/migrations.md — expand/contract phases and the release they belong to.
- references/release-record.md — the release request and record template.
- references/engine-notes.md — forge and platform specifics.
