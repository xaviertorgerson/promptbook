# Land record and agent-log lines

## Agent-log lines on the task (one per transition, on the branch where the status lives)

The approval is a forge review, not a commit: nothing is written to the task branch after it. The
landing actor writes both lines into the task file on the merge result, so the merge commit on the
target carries them with the status flip:

```markdown
- 2026-10-13 maria — approved PR #240 at 9e3b1a7 (forge review); status → merging.
- 2026-10-13 merge-agent — landed PR #240 into main by squash as 7d1e0c4 (tier 1); merged checks green; status → merged.
```

Under a grant (the approval recorded in the task record's `reviews` and `decisions`, source GRANT-4):

```markdown
- 2026-10-14 orchestrator — approve-pr under GRANT-4 at 3a9f2b1 (forge review; reviewer pass, PR #244 review 3; evaluator verdict pass, .agent/verdicts/BILL-6-3a9f2b1.md); status → merging.
- 2026-10-14 orchestrator — integrated PR #244 into integration/rating-engine by squash as 5c2d8e0 (tier 2, GRANT-4); merged checks green; status → integrated.
```

Returned to a human (a commit on the task branch, which voids the approval):

```markdown
- 2026-10-14 merge-agent — return-to-human: semantic conflict in apps/api/src/core/rating/rerate.ts (overlapping hunks at 80-96); status → human-review.
```

## The land record (append to the coordinator's notes or the PR comment)

```yaml
pr: https://github.com/acme/billing/pull/244
task: BILL-6
tier: 2
grant: GRANT-4
target: integration/rating-engine
strategy: squash
base_before: 1b7c3d9            # target head when the land started
head_landed: 3a9f2b1            # PR head that was evaluated and landed
merge_commit: 5c2d8e0
conflicts: [{ file: pnpm-lock.yaml, row: 1, resolution: regenerated }]
resolution_commit: 8e4f1a2      # listed because it changed the head after evaluation (mechanical only)
evidence:
  independent_review: https://github.com/acme/billing/pull/244#pullrequestreview-3   # the reviewer role's pass on 3a9f2b1
  independent_verification: .agent/verdicts/BILL-6-3a9f2b1.md                       # the evaluator's verdict on 3a9f2b1
  required_checks: green on the merged result (queue run 4471)
  grant_check: all 12 rows passed at 2026-10-14T11:02:00Z
landed_by: orchestrator
landed_at: 2026-10-14T11:04:00Z
```

The runner's run-record line for the landing run carries `grant: GRANT-4`, so cost and outcome stay
attributable to the grant.
