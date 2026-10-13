# Per-epic integration branch and the merge queue

## When to use an integration branch

A project that wants a coordinator to land several tasks of one epic without a human approving each
PR. The protected branch stays human (tier 3); the coordinator lands only into the epic's branch
(tier 2). This flow is the harness's extension of stagehand's merge grant; no source measures it.

## Flow

1. **Create** (a human, or the coordinator with the human's go-ahead): branch `integration/<epic>`
   from the protected branch at a recorded commit; push it; give it branch protection with the
   project's required checks and no direct pushes. Code-owner review is not required on it, or the
   grant cannot be exercised there.
2. **Grant** (a human): a `grant` whose merge action names `repo`, `target: integration/<epic>`,
   one `strategy`, and `requires` with at least `independent-review` and `required-checks`
   (example: integration-example.grant.yaml). With an expiry and limits.
3. **Tasks target it.** Each task sets `lands_to: integration/<epic>`; its worktree bases on the
   integration branch's recorded commit (managing-worktrees); its PR's base is `integration/<epic>`.
4. **Land task PRs** with the main procedure, tier 2: the grant check, the evaluator's pass on the
   current head, mechanical conflicts only, checks on the merged result, one at a time or through
   the queue. Each task goes `human-review` → `merging` (`approve-pr` under the grant) → `integrated`
   (`integrate`). It is not `merged` until the integration branch reaches the protected branch;
   a dependent in the same epic may start once its dependency is `integrated`.
5. **Keep it current.** Merge the protected branch into the integration branch regularly (never
   rebase a shared integration branch). A semantic conflict there goes to a human like any other.
6. **Close the epic.** When every task is `integrated` and the epic's acceptance holds on the
   integration branch, open one PR `integration/<epic>` → protected branch with: the tasks, the
   acceptance evidence (verdicts, the preview of the integrated build), the grant id, and anything
   the coordinator decided under `dispose-findings`. A human reviews and merges it (tier 3) and records
   `promote` (`integrated` → `merged`) for each task it carried. Then the epic's `finish`
   transition, by the owner or planner.
7. **Afterwards.** The coordinator records the grant's end (expired, revoked, or the `stop_when`
   outcome reached). The integration branch is deleted only by a human.

## The merge queue

- **What it does:** each queued PR is tested on top of the latest target plus the PRs ahead of it;
  a PR whose checks fail is removed and the rest are rebuilt without it (one forge's documentation
  is cited in evals/evidence.md). This is "re-run checks on the merged result", automated and
  serialized.
- **CI must run on the queue's own event** (engine-notes.md names it per forge), or the required
  check never reports and nothing merges.
- **Enqueueing is the merge act.** Only the actor allowed to land at this tier enqueues: a human at
  tier 0, the merge role after human approval at tier 1, the coordinator under the grant at tier 2.
- **Removed from the queue:** treat as red merged checks: `return-to-human` with the failing check.
- **No queue available:** the merge role serializes by hand: one land at a time, fetch the new
  target after each, re-run the checks on the next PR's merged result.
