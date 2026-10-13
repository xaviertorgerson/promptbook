# Authority rules (excerpt of the harness `authority` machine and `grant` contract 1.0.0)

## Default

Every decision is the human's (an owner or an engineer). Without a live grant naming the action and
covering the scope, the coordinator asks. A human's direct instruction to a worker is authority
within its stated scope; record it in the task record's `decisions` with its source. Unspecified
authority stays with the human; ambiguous authority is asked about, never inferred from a large
request and never renewed from a saved summary.

## Grantable actions

| Action | Means | Does not cover |
|---|---|---|
| `select-tasks` | choose, sequence and start tasks in scope without asking per task | adding work outside the scope or its requirements; optional follow-on projects |
| `approve-plan` | approve a worker's implementation plan within the agreed intent | changing acceptance criteria or scope (a respec, the human's) |
| `dispose-findings` + `policy` | decide which review findings are fixed now and which become follow-ups | dropping a material in-scope finding; skipping the re-review after fixes |
| `finalize` | mark a PR ready once the current head passed an independent review | merging |
| `publish-review` | publish a review on someone else's PR for the exact head reviewed | publishing for a changed head without re-review |
| `merge{repo, target, strategy, requires}` | land a PR through the forge in place of the human approval | any other repository, branch or strategy; a wildcard target; a direct push |

Merge rules: one repository, one exact target branch, one strategy; `requires` always includes
`independent-review` and `required-checks` (optionally `current-head`, `human-approval`); only a
coordinator (`orchestrator`) or the `merge` role may hold it; workers never do; the forge's branch
protection still applies, and a required human code-owner review cannot be satisfied by a grant. A
grant for `main` does not cover `release/*`. Merge is delegated last, if ever; prefer a per-epic
integration branch and leave integration → default branch to a human.

## Never grantable

| Id | Why |
|---|---|
| `spec-approval` | the plan is the human's; delegating it removes the human from the plan |
| `production-release` | customers see it; automating that gate is a human config change in the forge, not a delegation |
| `answer-permission-prompt` | approving a tool call the policy asks about is the checkpoint itself |
| `change-policy` | walls (deny rules, hooks, branch protection) change only by a reviewed human commit |
| `force-push-shared` | destroys others' history |
| `destructive-data` | dropping databases, deleting volumes, wiping backups |
| `widen-grant` | widening is a new grant from the human; a holder may only narrow its own |

Policy denies (the operator's policy, project walls) beat any grant.

## Lifecycle

The `grant` file has no status field; the state is read from where it lives and which fields are set.

| State | How to tell | Who moves it |
|---|---|---|
| draft | under `.orchestrator/grants/drafts/`; not loaded by any runtime | the agent drafting from the human's request |
| issued | under `.orchestrator/grants/`; `granted_at` ≤ now < `expires_at`; no `revoked_at` | the human's confirmation (recorded as `source`) |
| used | issued, and at least one task record `decisions[].source` or run record `grant` names it | each delegated action, recorded after the check passes |
| expired | now ≥ `expires_at` | time; the holder records needs-human with a renewal request |
| revoked | `revoked_at`, `revoked_by` and `revocation_reason` set | the human |

Narrowing (`narrowed[]` entries, current `actions`/`scope` edited down) keeps a grant issued or used.
Liveness is checked before every delegated action, not once per session.

## Stop conditions

The agreed outcome reached, the budget boundary, a revoked or expired grant, a consequential
ambiguity, or repeated non-progress end the delegation early. `max_workers` and `budget` are
enforced by the runtime; breaching either is a stop condition.

## Conflicts

If another instruction or role skill prevents a delegated action, surface the conflict to the human
rather than hiding it in a worker prompt.
