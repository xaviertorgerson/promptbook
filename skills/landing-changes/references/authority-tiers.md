# Authority tiers

Default is tier 0. A higher tier exists only when a human set it up: tier 1 by configuring the merge
role and its credential, tier 2 by issuing a grant. Nothing is inferred from a large request.

| Tier | Who lands | Into | Approval comes from | Conditions | Workflow transitions |
|---|---|---|---|---|---|
| 0 (default) | a human, through the forge | the protected branch | the human's own approval | branch protection, required checks | the human makes `approve-pr` and `land` (or the merge role records them after) |
| 1 | the merge role (an automated agent), after the human | the protected branch | a human code owner's approval of the current head | mechanical conflicts only; checks re-run on the merged result; serialized | `approve-pr` by the human (owner, engineer); `land` by `merge` |
| 2 | the merge role, or the coordinator when the runtime has no separate merge role | a per-epic integration branch (one exact branch named in the grant) | the grant, in place of the human approval | independent review of the current head passed; required checks green; within the grant's limits and expiry | `approve-pr` by the coordinator under `grant: merge`; `land` by `merge` (see the contract gap below) |
| 3 | a human | integration branch → protected branch | the human, on the epic's acceptance evidence | the integration PR's checks; branch protection | outside the task machine (the epic's `finish` follows) |

## What each tier never allows

- No tier lets an agent approve or merge work it authored.
- No grant covers the protected branch when its branch protection requires a human code-owner
  approval: the forge refuses, and the coordinator must not look for a way around it.
- No tier waives required checks, independent review, or the walls (hooks, deny rules, branch
  protection). Policy denies beat any grant.
- Production deployment is never a landing decision (releasing-changes; never grantable).

## Who may do what (workflow contract, task machine)

| Transition | From → to | By | Grant | Guards |
|---|---|---|---|---|
| `approve-pr` | human-review → merging | owner, engineer | `merge` (a coordinator stands in) | checks-green; with a grant also independent-review |
| `land` | merging → merged | merge | — | mechanical-only, merged-checks-green |
| `return-to-human` | merging → human-review | merge | — | a reason: a semantic conflict or red merged checks |
| `redo` / `respec` | human-review → ready / spec-draft | owner, engineer | — | a kickback reason |

The coder never makes any of these. The evaluator never makes any of these.

**Contract gap (as of workflow contract 1.0.0).** `land` lists only `merge` and carries no `grant`
key, and the rule that lets a grant holder act names only the orchestrator, while the grant
contract lets `granted_to.role` be `orchestrator` or `merge`. So a coordinator that presses merge
itself (stagehand's model) has no listed right to the `land` commit, and a merge role holding a
grant has no listed right to `approve-pr`. Until the contract settles it: the coordinator records
`approve-pr` under the grant; the `land` commit is made in the merge role's name and cites the
grant id. Report any other reading to the harness rather than inventing one.

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
