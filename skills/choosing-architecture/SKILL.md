---
name: choosing-architecture
description: Use when the requirements constrain structure and a decision needs recording before tasks — "choose the architecture", "which datastore / queue / auth model should we use", "write an ADR", "is this a one-way door", "which stack for this product", "we want to deviate from the stack pack", "draw the context and container view", "sketch the data model", "how do we keep this decision enforced". Turns ranked quality-attribute scenarios into options, classifies each decision as a one-way or two-way door, writes ADR-nnnn entries (options considered, door, reversal trigger, the NFRs they satisfy), picks an L4 stack pack or records a deviation with its trigger, sketches the context/container view and the data model, and names fitness functions that keep each decision true. Do not use for design choices inside an already-approved architecture while building a task (implementing-task), for writing the NFRs themselves (writing-requirements), or for cutting tasks (planning-work).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Optional - Node 22 and the harness validator to check ADRs against the decision contract.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Choosing architecture

Decide structure from the qualities the product must have, not from tool features. Record each
decision once, in the decision contract, with the options it beat, whether it is cheap to reverse,
what would reopen it and which requirements it exists for, then make the decision enforce itself.

## Inputs

- `specs/<epic>/spec.md`: the NFR rows (category, measure) and the REQs that imply structure.
- The brief's Constraints; `DECISIONS.md` (or `docs/adr/*.md`) for decisions already made.
- `toolkit.lock`: the L4 stack pack the project pins, if any, and that pack's own decisions.
- Contract `decision`: `## ADR-NNNN: title` with `**Status:**`, `**Date:**`, `**Decision:**`,
  `**Why:**`, `**Options considered:**` (bullets), `**Door:**` one-way|two-way, `**Reversed when:**`,
  `**Satisfies:**` (`<epic>/NFR-n`, `<epic>/REQ-n`), `**Consequences:**`; other labels are kept as
  extras. Templates: `references/adr-template.md`, `references/architecture-template.md`.

## Procedure

1. **Size the work.**

   | Work | Do |
   |---|---|
   | Bug, chore, task inside the architecture | Nothing here. A design choice local to one task is the implementer's (implementing-task). |
   | Feature in an existing product | Only if it crosses a one-way door (a new datastore, public API, auth model, data shape others depend on, deploy shape) or breaks an existing ADR. Otherwise none. |
   | New product or system | All steps: pack or deviation, views, data model, one ADR per one-way door, fitness functions. |
   | `risk: high` | Treat every structural choice as one-way until shown otherwise. |

2. **Rank the quality attributes.** From the NFRs, write two to five quality-attribute scenarios in
   the six-part form (source, stimulus, environment, artifact, response, measure; see
   `references/decision-checklist.md`) and rank them for this product. The ranking is the decision
   criterion; a tool's feature list is not.
3. **Stack: pick a pack first.** If the project pins an L4 stack pack, its choices are the default
   and cost no ADR. Departing from the pack is a **deviation**: an ADR naming what differs, the
   NFR that forces it, and the trigger that ends it. A deviation without a trigger is a defect. If
   no pack fits, the stack itself is a one-way-door ADR whose reversal trigger names when to adopt
   or write a pack.
4. **List the decisions with real alternatives**, and for each write an options table of two or three
   options, always including the pack's default (or "do nothing"), scored against the ranked
   attributes, with cost and reversal cost.
5. **Classify the door.**
   - **Two-way** (cheap to undo: a library behind an interface, a config value, an internal
     module split): decide fast. Write a five-line ADR only when it satisfies an NFR; otherwise one
     line in the spec's Interfaces section.
   - **One-way** (expensive to undo: a datastore, a public API, the auth or tenancy model, the data
     model others depend on, the deploy shape): write a full ADR with `Status: Proposed`, and have a
     human accept it before tasks depend on it. The walking skeleton exercises it first.
6. **Write each ADR** from the template, about 15–30 lines. Every ADR has `Satisfies` (qualified
   ids) and `Reversed when` (a measurable condition, even for a one-way door). Add the ADR id to
   each satisfied row's ADR column and to the spec header's `**ADRs:**` line. Never edit an
   accepted ADR: a change is a new ADR whose `Supersedes:` names the old one, and the old one's
   Status becomes `Superseded by ADR-nnnn`.
7. **Draw the views** in `ARCHITECTURE.md` (or `docs/architecture.md`) from
   `references/architecture-template.md`: a context view and a container view as Mermaid
   flowcharts in C4 style (people, the system, external systems; then deployable units, datastores
   and the arrows between them, labelled with protocol and data), each under one screen. Keep them
   to the boxes a decision depends on.
8. **Sketch the data model**: entities, keys, relationships, who owns each, tenancy, personal data,
   retention, as a Mermaid ER diagram or a table. Mark which parts are one-way doors.
9. **Name a fitness function for each ADR**: an automated check that fails when the code drifts from
   the decision, in the same change that introduces it. Examples (`references/fitness-functions.md`): a
   dependency rule (the domain never imports adapters), a schema-drift check, a performance budget in
   CI, a permission matrix test, and the decision-drift gate (always-loaded instructions must not name a
   choice an ADR retired). Write it in the ADR's `**Fitness function:**` line; its creation becomes a
   task criterion (planning-work).
10. **Validate.** If `harness validate` is available, run it on `DECISIONS.md` (in a harness
    checkout: `node tools/validate.mjs DECISIONS.md`), then `--trace <root>`: fix
    `requirement-exists` and `decision-link-agrees`; each NFR should have a decision
    (`nfr-has-decision` warns).

## Outputs

- `DECISIONS.md` entries (contract `decision`), one-way doors at `Proposed` until a human accepts.
- `ARCHITECTURE.md` or `docs/architecture.md`: quality-attribute scenarios, context and container
  views, data model sketch, fitness-function list.
- The ADR column of the spec's NFR/REQ rows and the spec header's `**ADRs:**` line.
- A hand-back: each ADR, its door, the decisions awaiting acceptance, and the fitness functions to build.

## Gates and stop conditions

- **A one-way door is a human decision.** Set `Accepted` only when the owner or an engineer accepts
  it; until then the hand-back has attention `needs-human` with the decision, options and your
  recommendation.
- **Stop (needs-human)** for any deviation from the pinned pack; any decision that changes cost,
  data residency, a vendor contract or a public API; any NFR that cannot be met by any option (send it
  back to writing-requirements with the trade-off).
- Do not choose by feature comparison. If the only argument is "X is better", there is no decision
  yet: name the attribute it serves or drop it.

## References

- `references/adr-template.md` — ADR entries (one-way and two-way), ready to fill; validates against `decision`.
- `references/architecture-template.md` — scenarios, options table, context and container views,
  data model sketch, fitness functions.
- `references/decision-checklist.md` — quality-attribute scenarios, door test, options scoring,
  pack-or-deviation rules, scale.
- `references/fitness-functions.md` — kinds of fitness function, the decision-drift gate pattern, and
  how each becomes a task criterion.
