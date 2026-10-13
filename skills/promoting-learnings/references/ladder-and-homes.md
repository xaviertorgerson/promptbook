# The escalation ladder, and where each form lives

## The ladder (escalate by recurrence)

| Signal | Becomes | Why |
|---|---|---|
| an instruction a human repeats | a **rule**: one line in the right instruction file | a repeated correction is a missing rule |
| a procedure pasted or re-explained twice | a **skill** | a procedure needs steps, a trigger and evals |
| something that must happen every time, or must never happen | a **hook, permission deny rule, type, test or CI gate** | prose is advisory; a wall is not |
| a vendor's behavior, price or limit verified in code or docs | a **knowledge entry** with source and date | facts decay; they need a "verified on" line |
| a choice between options with a reason | an **ADR** | the why outlives the code |

Go up the ladder only as far as the signal requires. A rule that never recurs is noise; a hook for
something that happened once is cost. Every step down the ladder (a hook back to a rule, a rule
deleted) is also legitimate when evidence shows it no longer pays (reviewing-harness).

## Homes by form and scope

| Form | Project only (L2) | Every project (pack: L3 or L4) | Every machine of one person (L1) |
|---|---|---|---|
| rule, invariant for everyone | project instruction file (`AGENTS.md`) | L3 `standards/engineering.md` (rendered into L1 and L2) | rendered from L3, never hand-copied |
| rule, stack-specific | nested instruction file under the stack's directory | L4 stack pack | — |
| rule, taste | — | — | the personal instruction template |
| skill, engine- and stack-neutral | `.agents/skills/<name>/` | L3 harness `skills/<gerund-name>/` | fanned out from the pin to the user skills directory |
| skill, stack- or vendor-specific | `.agents/skills/<name>/` | L4 pack's skills, published through its manifest | fanned out from the pack's pin |
| wall (deny hook, permission deny) | the project's hooks and deny rules | L4 core pack, installed into every L2 | personal deny rules in the operator policy (added on top, never removing the project's) |
| CI gate | the project's workflows | L4 pack workflows | — |
| knowledge entry | `knowledge/<topic>.md` | an L4 pack's `knowledge/` when cross-project | — |
| ADR | `DECISIONS.md` | the pack's own `DECISIONS.md` | — |
| deferred idea | the project's trigger table, with the condition that promotes it | the pack's trigger table | — |

A skill's `metadata.layer` names the layer it lives in now; change it in the promotion commit.

## What never goes up

- product names, customer quotes, real prices, personal data;
- a claim verified nowhere ("I remember the API does X");
- a workaround for a bug in one version of one tool, unless it carries the version and the trigger
  that removes it.
