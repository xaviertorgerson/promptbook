# Landing changes

## Problem

Merging is where an agent's mistake becomes everyone's. An agent that can merge its own work has no
gate. A rule that only humans merge stalls a large project at one person's review rate. "The
coordinator may merge" with no scope is authority nobody can audit or revoke.

## Practice

Treat merge authority as tiers, each granted explicitly and revocably:

| Tier | Who merges | Into | Conditions |
|---|---|---|---|
| 0 (default) | a human | the protected branch | human approval of the PR |
| 1 | the merge role, after human approval | the protected branch | mechanical conflicts only; CI re-run on the merged result |
| 2 | the coordinator, under a grant | a per-epic integration branch | current-head independent review passed; required checks green; within the grant's limits |
| 3 | a human | integration → protected branch | the epic's acceptance evidence |

- **Grants name scope.** A merge grant names the repository, the target branch, the strategy and the
  required evidence, plus limits (max workers, budget) and an expiry. It is revocable at any time and
  applies to one project. Workers never hold merge authority; only the coordinator exercises a grant.
- **The protected branch stays human.** No grant covers it. Branch protection, required reviews from
  code owners (agents are never code owners) and required checks enforce this, not prose.
- **A merge queue re-runs CI on the merged result**, landing one change at a time; a clean base and a
  clean PR can still merge red.
- **Conflicts split two ways.** Mechanical (lockfiles, generated files, one-sided hunks) may be
  resolved automatically, then CI re-runs. Any semantic conflict stops and goes to a human.
- **Nobody approves their own work**, and a review count, a green CI or a quiet agent is not approval.

## Evidence

- 2026-09-30 · practice · stagehand: merge authority must identify repositories, target branches,
  strategy and required evidence; only the coordinator exercises it, through PRs after current-head
  independent review ([project-delegation.md](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/references/project-delegation.md)).
- 2026-09-23 · practice · agentic-template: only the merge agent lands on the protected branch, after
  human approval, mechanical conflicts only, CI re-run on the merged result; agents are not in
  CODEOWNERS ([roles.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/roles.md);
  [concurrency.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/concurrency.md)).
- 2026-04-15 · vendor · Microsoft: every agent action should trace back to an authorizing human
  ([Microsoft](https://devblogs.microsoft.com/all-things-azure/agentic-devops-practices-principles-strategic-direction/)).
- 2026-02-11 · vendor · OpenAI auto-merged small refactor PRs with minimal gates and called that
  irresponsible in a low-throughput environment ([OpenAI](https://openai.com/index/harness-engineering/)).
- recommendation · the per-epic integration branch (tier 2) is this playbook's extension of
  stagehand's grant; no source measures it.

## Contracts used

`grant` (scope, actions incl. `merge{repo,target,strategy}`, limits, expiry, revocable),
`state-machines/authority.yaml`, `state-machines/workflow.yaml` (`human-review` → `merging` →
`merged` by `land`; with `lands_to: integration/<epic>`, `merging` → `integrated` by `integrate` at
tier 2, then `promote` → `merged` by the human at tier 3; the orchestrator lands only under a live
merge grant for that exact target), `task` (`lands_to`), `run-record` (who merged what, under which
grant).

## Anti-patterns

- Auto-merge enabled on the protected branch.
- A grant with no expiry, no branch, or "all repos".
- Resolving a semantic conflict by picking one side.
- Merging on the PR's own CI run instead of the merged result.
- Counting reviewer passes as approval.

## Revisit when

Evaluators catch semantic regressions reliably enough to measure, or the forge offers grant-scoped
merge identities natively.
