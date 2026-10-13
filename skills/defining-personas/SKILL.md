---
name: defining-personas
description: Use when the users of an approved product brief need to be pinned down before journeys are written — "write the personas", "who are our users", "define PER-1 and PER-2", "which user types do we design for", "is this persona backed by research", "do we need a new persona for this feature". Writes PER-n entries (role, jobs, context, constraints, what they must never experience), marks every claim as evidence or assumption, and keeps only the personas that change a decision. Do not use for framing the product or deciding whether to build it (framing-products), or for writing the journeys a persona takes (mapping-journeys).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Optional - Node 22 and the harness validator to check personas against their contract.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Defining personas

Name the few kinds of user whose differences change what gets built, as stable `PER-n` ids that
journeys cite. A persona is a role with a job, a context and constraints, not a biography. Each
claim says whether it rests on evidence or is an assumption still to test.

## Inputs

- `docs/product/brief.md` (contract `brief`): its Users section, `links`, and `status`.
- Research the person can point to: interviews, support tickets, analytics, sales notes.
- Existing personas: `docs/product/personas.md` (entries) or `docs/product/personas/*.md`.
- Contract `persona`: `id` PER-n, `name`, `role`, `goals` (at least one), optional `pains`,
  `context`, `quote`, `evidence` (paths or URLs). Template: `references/personas-template.persona.md`.

## Procedure

1. **Size the work.**

   | Work | Do |
   |---|---|
   | Bug, chore, small task | Skip; cite the existing persona in the task's journey if needed. |
   | Feature in an existing product | Read the personas. Add one only if the feature brings a new kind of user (a new role, permission level, device or environment, or an upstream system that acts like a user). Otherwise change nothing. |
   | New product | Write the set after the brief's go decision. |

2. **Check the brief.** For a new product the brief must be `approved`. If it is still `draft`,
   stop: the go decision comes first (framing-products).
3. **List candidates** from the brief's Users and the research: every role that touches the
   product, including people who never log in (a customer who arrives by a link) and upstream
   systems that act like users.
4. **Apply the decision test** to each candidate (`references/persona-checklist.md`): name at least
   one decision it changes, such as a requirement, an NFR threshold, a permission boundary, a screen
   state, a device or accessibility need, or a price. A candidate that changes nothing is merged into
   another persona or dropped, with one line saying so in the hand-back. Most products need one to
   four; a fifth needs a stated reason.
5. **Write each persona** from the template, in one `docs/product/personas.md` (or one file per
   persona under `docs/product/personas/` when a team prefers). At most about 15 lines each:
   - `## PER-n · <role name>`: ids are stable and never reused; the name is a role, never a
     fictional person.
   - **Role**: one line on what they do in relation to the product.
   - **Goals**: the jobs they hire the product for, phrased "when <situation>, <what they want>, so
     <outcome>".
   - **Context**: device, frequency, expertise, environment, and access needs that constrain design.
   - **Pains**: what goes wrong for them today.
   - **Must never**: what they must never experience (data loss, a blocked payment, an inaccessible
     screen). Journeys turn these into unwanted outcomes.
   - **Evidence**: the paths or URLs the evidence tags cite (no spaces in an entry).
   - **Quote**: only a verbatim line from a cited source. Never write an invented quote.
6. **Tag every claim.** End each goal, pain, context and must-never item with
   `[evidence: <ref>]` or `[assumption: <test>]`. A persona whose every claim is an assumption is a
   hypothesis: say so in the hand-back and name the cheapest test.
7. **Link the brief.** Add the ids to the brief's `personas:` list. A persona the brief's Users
   section does not mention is a scope change: stop and ask (Gates).
8. **Validate.** If `harness validate` is available, run it on the personas file (from a harness
   checkout: `node tools/validate.mjs docs/product/personas.md`). Once journeys exist, the trace check
   warns `persona-has-journey` for any persona no journey cites; such a persona is deleted or given a
   journey before readiness.

## Outputs

- `docs/product/personas.md` (contract `persona`, one `## PER-n · name` entry each) or
  `docs/product/personas/<slug>.md` files.
- The brief's `personas:` list updated.
- A hand-back listing each persona, the decision it changes, any candidates merged or dropped, and
  the assumptions that most need testing.

## Gates and stop conditions

- **Stop (needs-human)** when the brief is not approved; when a persona would add a user group the
  brief does not serve (the owner decides whether the brief changes); when a high-cost decision
  (accessibility level, compliance regime, a new market) rests only on assumptions.
- Never invent demographics, quotes, research findings or numbers. Unknown is written as an
  assumption with a test.
- Do not write journeys here; hand to mapping-journeys.

## References

- `references/personas-template.persona.md` — the personas file, ready to fill; validates against `persona`.
- `references/persona-checklist.md` — the decision test, evidence and assumption rules, job wording,
  the one-file-per-persona form, and scale.
