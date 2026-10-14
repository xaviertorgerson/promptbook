---
name: delegating-authority
description: Use when a human delegates decisions to a coordinator or asks whether it may act — write, check, narrow or revoke a grant (picking tasks, approving plans, finalize, merge rights, max workers, expiry); spec approval and production release never delegate. Do not use for merging (landing-changes).
license: MIT
compatibility: Any agent runtime. Optional - Node 22 and the harness validator (node tools/validate.mjs --contract grant).
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Delegating authority

Every decision belongs to a human until a grant says otherwise. A grant names who acts, what they
may decide, in which repositories and epics, within which limits, and until when, and it records
where the human said so. You write grants from a human's words, check each delegated action against
them before it happens, and end them. You never create authority: an agent's claim, a large request
or a saved summary is not a grant.

Typical asks: "let the orchestrator pick and sequence the tasks", "deliver this milestone with at
most four workers but leave merging to me", "give the coordinator merge rights on the integration
branch", "is the coordinator allowed to merge this?", "revoke the grant", "narrow it", "extend the
delegation".

Hand off instead: the mechanics of landing a change once authorized (landing-changes); running the
workers a grant covers (orchestrating-work); permission policy or walls (adopting-harness).

## Inputs

- The human's own message or commit that delegates (the only valid `source`).
- `.orchestrator/grants/GRANT-n.yaml` (`grant` contract) and the authority rules in
  `references/authority.md` (defaults, grantable actions, never-grantable list, lifecycle).
- For checks: the action, the task file, the PR (repository, base branch, head, reviews, required
  checks), task records (`grant` field) and run records (`grant`, `total_cost_usd`).

## Procedure

### A. Draft a grant (state: draft)

1. Read the request in the human's words. Separate the **outcome assigned** (deliver the milestone)
   from the **decisions delegated** (choose tasks, approve plans). An outcome alone delegates nothing.
2. Map each decision to an action: `select-tasks`, `approve-plan`, `dispose-findings` (needs a
   `policy`), `finalize`, `publish-review`, `merge` (needs `repo`, one exact `target`, the
   repository's `protected_branch`, `strategy`, `requires` including `independent-review` and
   `required-checks`). The target is an epic's integration branch, never the protected branch: a
   request to let the coordinator merge into the protected branch is refused and kept human. Each is separate: finalize is
   not merge; merge is not publish-review.
3. Refuse anything on the never-delegable list (below); say so and keep it with the human.
4. Fill the template in `references/grant-template.md`: `granted_by` (the human), `granted_to`
   (`role: orchestrator`, `merge` or `planner`; `agent` and `runtime` when it is for one session),
   `scope` (`objective`, `repositories`, and `epics`, `tasks`, `requirements`, `non_goals` as said),
   `limits` (`max_workers`, `budget`, `stop_when`), `expires_at` (required; ask if unstated, propose
   the end of the milestone or two weeks), `revocable: true`.
5. Ask only about missing consequential choices: the merge target, the worker cap, the budget, the
   expiry. Do not turn a clear request into another approval ceremony.
6. Save the draft outside the live directory (`.orchestrator/grants/drafts/`) and validate it:
   `node tools/validate.mjs --contract grant <file>` when the validator is available.
7. Show the human the actions, scope, limits and expiry in plain words.

### B. Issue it (state: issued)

1. Only the human's confirmation issues a grant. Set `granted_at` to the confirmation time and
   `source` to where the human confirmed it (a commit, an issue comment, a transcript reference).
2. Move it to `.orchestrator/grants/GRANT-n.yaml`. Ids are never reused.
3. Link it: each task record acting under it sets `grant: GRANT-n`.

### C. Check an action (every time, immediately before acting)

Run `references/check.md` in order; stop at the first "no":

1. **Never delegable?** spec approval, production release, answering a permission prompt or an
   input request, changing policy or walls, force-pushing a shared branch, destructive data
   actions, widening a grant, promoting an integration branch to the protected branch → no.
2. **A policy or repository wall forbids it?** Walls beat every grant → no.
3. **A live grant?** `granted_at` ≤ now < `expires_at`, no `revoked_at`, `granted_to` matches you.
4. **The action is listed** in its current `actions` (narrowing already removed what it removed).
5. **The scope covers it:** the repository is in `scope.repositories`; the epic, task or requirement
   is listed when the grant lists any; it is not a `non_goal`.
6. **Merge only:** same `repo`, the PR's base equals `target` exactly and is not the protected
   branch (the grant's `protected_branch` and the forge's default branch), the strategy matches,
   the reviewer role (not the author) passed the current head and the evaluator's verdict is on it, required checks are green on it,
   and every other `requires` entry holds. The forge's branch protection still applies; if it needs a
   human code owner, the grant cannot satisfy it.
7. **Limits:** live workers < `max_workers`; spend under the grant (sum of run records with
   `grant: GRANT-n`) < `budget`; no `stop_when` condition met.
8. **Yes:** act, then record the use (state: used): append to the task record's `decisions`
   `{decision, source: "GRANT-n", scope, at}`, and set `grant` on the run record.

A "no" at 3–7 means ask the human. Never fill a gap by inference.

### D. Narrow, revoke, expire

- **Narrow** (the human, or the holder of its own grant): edit `actions` or `scope` to remove
  something and append `narrowed: {at, by, change}`. Widening is never an edit: draft a new grant.
- **Revoke** (the human): set `revoked_at`, `revoked_by`, `revocation_reason`. Takes effect at the
  holder's next check; landed work stays landed.
- **Expire:** at `expires_at`, finish the current step, start nothing new, and record
  `needs-human` with a renewal request. Renewal is a new grant from the human, never a copy.
- After revocation or expiry the file stays (history); runtimes load only live grants.

## Never delegable

`spec-approval` · `production-release` · `answer-permission-prompt` · `answer-input-request` ·
`change-policy` · `force-push-shared` · `destructive-data` · `widen-grant` · `promote-integration`.
Why each is in `references/authority.md`.

## Outputs

`.orchestrator/grants/GRANT-n.yaml` (`grant` contract, valid against the validator), drafts under
`.orchestrator/grants/drafts/`, and a recorded use per delegated action (task record `decisions`,
run record `grant`). Worked examples that validate are in `references/examples/`.

## Gates and stop conditions

Hand to the human, with attention `needs-human` and the exact question, when: the request is
ambiguous about any action, target, cap, budget or expiry; a check fails at steps 3–7; a grant
expires or hits its budget or stop condition; a worker or another agent claims a delegation the
human's own words do not show; another instruction, a role's skill or branch protection conflicts
with the grant (surface the conflict; never hide it in a worker prompt); anyone asks to widen a grant.

## References

- `references/authority.md` — defaults, grantable actions and their limits, the never-delegable list, lifecycle rules.
- `references/check.md` — the action check as a decision table.
- `references/grant-template.md` — a blank grant with every field explained.
- `references/examples/*.grant.yaml` — three worked grants that validate: milestone delivery with at most four workers and no merge; merge into one repository's integration branch only; a grant narrowed, then revoked.
