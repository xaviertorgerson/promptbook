# Fitness functions

A fitness function is an automated check that keeps a decision true after the people who made it
have moved on. Prose in an ADR is advisory; the check is the wall. Every ADR names one, and building
it is an acceptance criterion of the task that first depends on the decision.

## Kinds

| Kind | Keeps true | Example check |
|---|---|---|
| Dependency rule | module boundaries and dependency direction | the domain never imports adapters; packages never import apps; no import cycles (a dependency-graph linter in CI) |
| Schema-drift check | the data model matches its migrations | the schema in code and the latest migration produce the same database; a change without a migration fails |
| Contract test | a public API or event schema | the published schema is compatible with the last release (no removed field, no narrowed type) |
| Performance budget | a latency or size NFR | the load test's p95 is under the budget; the page bundle is under N kB |
| Permission matrix | the authorization model | every route × role pair is tested, including the negative path |
| Tenancy probe | isolation | a test with two tenants finds 0 cross-tenant rows on every list endpoint |
| Cost guard | a cost NFR | a monthly report or a CI estimate fails above the budget |
| Decision-drift gate | instructions agree with the decisions | always-loaded instruction files (the agent's map, always-on rules, skill descriptions) must not name a choice that an accepted ADR retired, unless the line cites that ADR |

## The decision-drift gate pattern

When an ADR supersedes a choice, the old choice lingers in the text agents read on every turn, and
agents keep building it. The gate:

1. Keep the retired terms as data: `{ term pattern, retired_by: ADR-nnnn }`.
2. Scan the always-loaded text: the project's instruction map, rules without a path filter, and every
   skill and subagent description.
3. Fail when a line names a retired term without citing the ADR that retired it; warn elsewhere, as
   the migration backlog.
4. Exempt the decision register and the changelog.

Add the term to the data in the same change that supersedes the ADR.

## From ADR to task

- The ADR's `**Fitness function:**` line names the check.
- planning-work puts "the check exists and runs in CI" as an acceptance criterion on the first task
  that depends on the decision, usually the walking skeleton:
  `- AC-4 — The dependency check shall fail any import from the domain into an adapter. (NFR-5)`
- A lint error message says how to fix it, so an agent can act on it.

## Scale

A two-way door rarely needs more than the tests the task writes anyway. A one-way door always has a
fitness function; if none can be automated, record why in the ADR and name the human review that
stands in for it.
