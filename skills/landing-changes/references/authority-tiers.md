# Authority tiers

Default is tier 0. A higher tier exists only when a human set it up: tier 1 by configuring the merge
role and its credential, tier 2 by issuing a grant. Nothing is inferred from a large request.

| Tier | Who lands | Into | Approval comes from | Conditions | Workflow transitions |
|---|---|---|---|---|---|
| 0 (default) | a human, through the forge | the protected branch | the human's own approval | branch protection, required checks | the human makes `approve-pr` and `land` (or the merge role records them after) |
| 1 | the merge role (an automated agent), after the human | the protected branch | a human code owner's approval of the current head | mechanical conflicts only; checks re-run on the merged result; serialized | `approve-pr` by the human (owner, engineer); `land` by `merge` |
| 2 | the merge role, or the coordinator when the runtime has no separate merge role | a per-epic integration branch (one exact branch named in the grant; never the protected branch, which the grant names as `protected_branch`) | the grant, in place of the human approval | the reviewer's pass and the evaluator's verdict on the current head; required checks green; within the grant's limits and expiry | `approve-pr` by the coordinator under `grant: merge`; `integrate` (→ `integrated`) by `merge`, or by the coordinator under the same grant |
| 3 | a human | integration branch → protected branch | the human, on the epic's acceptance evidence | the integration PR's checks; branch protection | `promote` (`integrated` → `merged`) by the human for each task the branch carried; never grantable |

## What each tier never allows

- No tier lets an agent approve or merge work it authored.
- No grant covers the protected branch, ever: a merge grant whose `target` is its
  `protected_branch` is invalid (grant contract rule `merge-target-not-protected`), and the forge's
  code-owner requirement refuses it anyway. Tier 3 is a human's.
- No tier waives required checks, independent review, or the walls (hooks, deny rules, branch
  protection). Policy denies beat any grant.
- Production deployment is never a landing decision (releasing-changes; never grantable).

## Who may do what (workflow contract, task machine)

| Transition | From → to | By | Grant | Guards |
|---|---|---|---|---|
| `approve-pr` | human-review → merging | owner, engineer | `merge` (a coordinator stands in, for an integration branch only) | checks-green; with a grant also lands-on-integration, independent-review (the reviewer's pass) and independent-verification (the evaluator's), both on the current head |
| `land` | merging → merged | merge | never (no grant targets the protected branch) | lands-on-protected, mechanical-only, merged-checks-green |
| `integrate` | merging → integrated | merge | `merge` (target = the task's `lands_to`) | lands-on-integration, mechanical-only, merged-checks-green |
| `return-to-human` | merging → human-review | merge | `merge` | a reason: a semantic conflict or red merged checks |
| `promote` | integrated → merged | owner, engineer | never | integration-landed (a human merged the integration branch) |
| `reopen` / `respec` | integrated → in-progress / spec-draft | owner, engineer | — | a kickback reason (a later integration broke it) |
| `redo` / `respec` | human-review → ready / spec-draft | owner, engineer | — | a kickback reason |

The coder never makes any of these. The evaluator never makes any of these.

**A coordinator that presses merge itself** (a runtime with no separate merge role) records
`integrate` or `return-to-human` in its own name under a live `merge` grant whose repo, strategy
and exact target match: the target is the task's `lands_to`, an integration branch (since workflow 1.4.0,
`land`, onto the protected branch, is the merge role's alone, after a human's approval). `deps-merged` counts an `integrated` dependency only for a dependent in the same
epic, which builds on the integration branch.

## The forge controls that make the tiers real

| Rule | Setting (generic) |
|---|---|
| Nobody pushes to the protected branch | branch protection: require a PR, restrict pushes, no bypass |
| Only a human approves at tier 0/1 | required code-owner review; agent identities are not code owners |
| Only the merge role lands at tier 1 | the merge job runs on a trusted runner and holds the only merge-capable credential |
| Tier 2 is scoped | the integration branch has its own protection with required checks but no code-owner requirement; the coordinator's credential can merge only there |
| Checks run on the merged result | a merge queue on the target, or the merge role's own re-run before merging |
| Production is human | a protected deployment environment with a required reviewer |

Without these settings the tiers are prose. Check them before relying on any tier above 0.
