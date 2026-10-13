# Commit message format

```
<type>(<scope>)<!>: <imperative summary, ≤ ~72 chars, no period>

<why: the problem or force, the cause, the decision, what was rejected
or traded away. Wrapped at ~72 columns. Several short paragraphs are
fine.>

<references: task id, criteria, requirements, decisions, incident or
run ids, the task status transition if this commit makes one>

<footers: BREAKING CHANGE: ..., Refs: ..., the project's own trailers>
```

| Type | For |
|---|---|
| `feat` | new behavior a user or caller can observe |
| `fix` | a defect corrected |
| `docs` | documentation only |
| `refactor` | structure changed, behavior unchanged |
| `perf` | faster or cheaper, behavior unchanged |
| `test` | tests only |
| `build`, `ci` | build system, dependencies, pipelines |
| `chore` | everything else that is not user-visible (task-file status moves, tooling config) |
| `revert` | reverting an earlier commit; the body says why |

Scope is the area the project uses (a module, an app, `skills`, `specs`). Omit it rather than invent
one.

## Worked example: a feature

```
feat(billing): prorate mid-cycle plan upgrades

Upgrades mid-cycle charged the full new price immediately, double-billing
the overlap. Prorate by remaining days against the old plan and credit the
unused portion. Deferring the upgrade to the next cycle was rejected:
users expect immediate access to what they paid for.

BILL-7 AC-1, AC-2; implements REQ-3 under ADR-0007.
```

## Worked example: a fix

```
fix(export): convert provider amounts to minor units at the boundary

Invoice totals were off by one cent for line items with three decimals:
each line was rounded before summing because the parser kept the
provider's floats. Convert to integer minor units where the response is
parsed; the two other parsers of the same provider had the same defect
and are fixed here too.

Regression test "BILL-12 AC-3 totals 3 × 33.335 exactly". Incident
2026-10-02.
```

## Worked example: a status transition

```
chore(specs): BILL-7 in-progress → review

Draft PR opened; every criterion has a named test and the trace check
passes.
```

## Never in a message

- secrets, tokens, connection strings, personal data;
- AI, assistant or tool attribution lines;
- "fix stuff", "wip", "address review" with no why;
- a restatement of the diff.
