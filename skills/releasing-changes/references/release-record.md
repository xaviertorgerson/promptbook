# Release request and release record

An agent prepares the request; a human approves the production hop; the train or the agent fills
in the outcome. Keep it with the forge's deployment record (or as the annotated tag's notes).

```yaml
release: v1.8.0
digest: registry.example/acme/billing-app@sha256:8f3c…e21a
commit: 7d1e0c4
built_by: ci run 9182 (2026-10-13T11:20:00Z)
carries:
  - { task: BILL-6, pr: 244 }
  - { task: BILL-7, pr: 240 }
stages:
  - { stage: dev, at: "2026-10-13T11:31:00Z", smoke: pass }
  - { stage: qa, at: "2026-10-14T07:02:00Z", dwell: 3d, probe: green, error_rate: 0.002, smoke: pass }
  - { stage: uat, at: "2026-10-17T09:01:00Z", dwell: 2d, probe: green, error_rate: 0.001, smoke: pass }
flags:
  - { key: rating.rerate_v2, production: off, plan: "team after release, then 10% for a day" }
migrations:
  - { id: 0042_add_rate_version, phase: expand, rollback: "safe" }
rollback_target: registry.example/acme/billing-app@sha256:51aa…90c3 (v1.7.2)
requested_by: release-agent
approved_by: maria                  # a human, in the protected production environment
approved_at: "2026-10-19T10:04:00Z"
rollout: { steps: [10%, 50%, 100%], watch: 15m for 24h, tolerance: 1.5 }
outcome: released                   # released | rolled-back | held
notes: ""
```

The agent fills everything except `approved_by` and `approved_at`, and writes `outcome` only from
the deployment record and the watch's result.

## What the request says to the approver (short)

> v1.8.0 (digest 8f3c…e21a) carries BILL-6 and BILL-7. Dwell: QA 3 days, UAT 2 days, probes green,
> error rate 0.1–0.2%. One expand migration (safe to roll back). rating.rerate_v2 ships off.
> Rollback target v1.7.2. Approve in the production environment to release.
