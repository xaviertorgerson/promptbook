---
name: landing-changes
description: Use when PRs must be merged or an epic needs an integration branch — "the PR is approved, merge it", "land BILL-7", the merge queue, mechanical merge conflicts, a coordinator merging task PRs into the integration branch under a grant. Do not use for writing grants (delegating-authority).
license: MIT
compatibility: Any agent runtime with git and a forge that enforces branch protection and required checks. Optional harness tools/validate.mjs (Node 22) to check grant files.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Landing changes

Merge is where one agent's mistake becomes everyone's. Land only what a human approved, or what a
live, scoped grant lets a coordinator stand in for, and only after an independent review of the
exact head and green checks on the merged result. Overlapping logic is never resolved by an agent.

Typical asks: "the PR is approved, land it", "merge BILL-7", "resolve these merge conflicts",
"rebase and land", "run the merge queue", "can the coordinator merge into the epic branch", "set up
an integration branch for this epic", "merge the integration branch into main".

Hand off instead: writing or finalizing PR text (preparing-pull-requests); judging whether the
change meets its criteria (verifying-work); issuing or revoking a grant (delegating-authority);
deploying a merged build (releasing-changes).

## Inputs

- The PR: repository, base (target) branch, head commit, approvals with their head, check results,
  mergeability, the forge's branch protection and merge-queue settings for the target.
- The task file (`task` contract): `status` (expected `human-review` or `merging`), `branch`,
  `lands_to` (the epic's integration branch, when it lands there), the agent log.
- The grant, if a coordinator acts under one (`grant` contract): `granted_to`, `scope`, `actions`
  with `merge{repo, target, strategy, requires}`, `limits`, `expires_at`, `revoked_at`, `narrowed`.
- The verdict of the independent evaluation bound to the head (verifying-work), and the task
  record's `reviews[]` (`pr`, `head`, `outcome`, `role`, `by`; the evaluator's verdict is `role:
  evaluator` with `outcome` pass or fail).
- Your own identity, to check you authored nothing in the PR.

## Procedure

1. **Name the tier** (references/authority-tiers.md). Default tier 0: a human approves and merges.
   Tier 1: a human approved in the forge; the merge role lands. Tier 2: a coordinator stands in for
   the approval under a merge grant, into a per-epic integration branch. Tier 3: a human merges the
   integration branch into the protected branch. Anything unclear is tier 0: ask.
2. **Never land your own work.** If your identity authored any commit in `<base>...<head>` (other
   than a conflict-resolution commit you make in step 7), stop and hand to someone else.
3. **Check the approval.** Tier 0 and 1: a human code owner approved the current head (an approval
   of an older head does not count), and the task is at `human-review` or `merging`. A review
   count, a green CI, a passing evaluator, a quiet agent or a worker saying "the human approved" is
   not approval. Tier 2: run the grant check (step 4) instead.
4. **Check the grant** (tier 2) with references/grant-check.md, at this moment, not as remembered
   from the start of the run: it is live (`granted_at` ≤ now < `expires_at`, no `revoked_at`); you
   hold it (`granted_to` role, and agent or runtime if named); the repository is in
   `scope.repositories` and the task or epic in scope; one `merge` action names this exact `repo`,
   this exact `target` branch and the strategy you will use; `requires` is satisfied (always
   `independent-review` and `required-checks`, plus `current-head` and `human-approval` when
   listed); `limits` and `stop_when` are not breached; branch protection on the target does not
   require a human code-owner approval (if it does, the grant cannot satisfy it: ask). Any miss is
   tier 0.
5. **Record the approval transition.** `approve-pr` (`human-review` → `merging`): by the owner or
   engineer who approved (cite the approval and its head in the agent-log line), or by the
   coordinator under the grant (cite the grant id and the verdict). One commit on the task branch.
6. **Update and classify.** Fetch the target, merge it into the PR's head in a clean checkout
   (never your primary checkout), and classify any conflicts with references/conflict-classes.md.
   **Any semantic conflict:** abort the merge, label the PR for a human merge, comment naming the
   files and the reason, record `return-to-human` (`merging` → `human-review`) with the reason, and
   stop. Never pick a side of overlapping logic.
7. **Resolve mechanical conflicts only.** Lockfiles: regenerate from the manifest. Generated files:
   regenerate. Identical hunks: take either. Commit the resolution to the PR's branch and push it
   plainly. A history rewrite of the PR branch (rebase strategy) is allowed only when authorized
   for that branch, with `--force-with-lease=<branch>:<expected-sha>`; never on the target, never on
   a shared branch without the human. A pushed resolution changes the head: the independent review
   must cover it (a mechanical-only commit is listed in the land record; anything more needs
   re-evaluation).
8. **Land through the queue.** With a merge queue on the target, enqueue the PR: it re-tests the PR
   on top of the latest target plus the PRs ahead of it and removes it on red. Without one, land
   one change at a time: re-run the full required checks on the merged result and merge only on
   green, with the approved strategy, through the forge's PR merge (never a direct push, never
   auto-merge on the protected branch). A clean base plus a clean PR can still merge red.
9. **Record the land**, only on a green merged result: one commit naming the merge commit, the
   target, the strategy, the tier and the grant id if any. Into the protected branch: `land`
   (`merging` → `merged`). Into the epic's integration branch (the task's `lands_to`): `integrate`
   (`merging` → `integrated`); the task becomes `merged` only through `promote`, a human's, after the
   human merges the integration branch (step 10). Both belong to the merge role, or to the
   coordinator under a live merge grant whose repo, strategy and exact target match (a runtime with
   no separate merge role). On red merged checks: `return-to-human` with the
   failure, and the author gets it back through the human. Append the land record
   (references/land-record.md); the runner writes the run-record line with `grant`.
10. **Epic integration flow** (references/integration-branch.md): the coordinator lands task PRs into
    `integration/<epic>` under the grant; keeps the integration branch current by merging the
    protected branch into it; when the epic's acceptance holds, opens one PR from the integration
    branch to the protected branch with the acceptance evidence. A human reviews and merges that
    PR (tier 3) and records `promote` (`integrated` → `merged`) for each task it carried. No grant
    covers it. A task a later integration breaks goes back with a reason (`reopen` → `in-progress`,
    or `respec`).

## Outputs

- A merged PR (or a PR returned to a human with the reason), the task at `merged` (protected
  branch), `integrated` (integration branch) or back at `human-review`, a land record, and the grant's limits updated in the coordinator's notes.
- Grant files validate against the `grant` contract: references/integration-example.grant.yaml.
  If `harness validate` is available, run `node tools/validate.mjs --contract grant <file>`.

## Gates and stop conditions

- Never: approve or merge your own work; push to the protected or integration branch directly;
  force-push a shared branch; enable auto-merge on the protected branch; resolve a semantic
  conflict; land on a red merged result; treat a grant as covering the protected branch when its
  protection requires a human code owner; widen a grant (only a human issues a wider one).
- Stop and hand to a human (attention `needs-human`, `next_action` naming the decision): any
  semantic conflict; red checks on the merged result; a grant that is expired, revoked, out of
  scope, at its limits or ambiguous; an approval on a stale head; branch protection that blocks
  the merge; a required check that was skipped (a skip is not a pass); the head changed after the
  evaluation by more than a mechanical resolution.

## References

- references/authority-tiers.md — the four tiers, who acts, which workflow transitions, forge settings.
- references/grant-check.md — the grant check, field by field, with the failure for each.
- references/integration-example.grant.yaml — a tier-2 merge grant into an integration branch.
- references/conflict-classes.md — the mechanical vs semantic table, ported from the template's
  classifier with one measured correction.
- references/integration-branch.md — the per-epic integration branch flow and the merge queue.
- references/land-record.md — the land record and the agent-log lines.
- references/engine-notes.md — forge-specific notes (merge queue events, protection settings).
