---
name: mapping-journeys
description: Use when a product or new feature needs its critical user journeys before requirements or screens — "map the user journeys", "write the CUJs", "add a feature so owners can…", "what must work end to end", "which journeys does this touch". Do not use for the next step (writing-requirements).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Optional - Node 22 and the harness validator to check journeys against their contract.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Mapping journeys

Write the few end-to-end paths that must work, as `CUJ-n` entries an epic's requirements, screens
and tasks cite. A journey is critical when a persona would notice it breaking and it costs an outcome
the brief promises. Its trigger, success and unwanted outcome become the epic's EARS requirements.

Typical asks: "map the user journeys", "write the CUJs", "what must a user be able to do end to
end", "add a feature so owners can …", "I want users to be able to …", "what are the critical paths
for this epic", "which journeys does this change break".

Hand off instead: deciding whether to build the product (framing-products); REQ/NFR rows or
acceptance criteria (writing-requirements); screens and states (designing-flows).

## Inputs

- The ask, and the brief's Outcomes and Non-goals (`docs/product/brief.md`, if it exists).
- Personas (`docs/product/personas.md` or `docs/product/personas/*.md`).
- Existing journeys: every `specs/*/cuj.md`; reuse or extend before writing a new one.
- Contract `journey`: `## CUJ-n · title` headings with `- **Field:** value` bullets: `Actor`,
  `Personas` (PER-n list), `User-facing` (yes|no), `Goal`, `Trigger`, `Steps` (numbered sub-items),
  `Success`, `Unwanted`; any other label is kept as an extra. Template: `references/cuj-template.cuj.md`.

## Procedure

1. **Size the work.**

   | Work | Do |
   |---|---|
   | Bug, chore | Write nothing. Name the existing CUJ the bug breaks; the fix task cites it (planning-work). If no journey covers it, ask whether one is missing. |
   | Feature in an existing product | One to three CUJs in the feature's epic, reusing the product's personas. |
   | New product | After personas: three to seven CUJs across personas, the riskiest one first. |

2. **Name the epic.** A short kebab-case slug for the folder `specs/<epic>/`. Reuse an epic when the
   journeys extend it; a new outcome gets a new epic.
3. **Find candidate journeys** per persona: each goal in a persona becomes a candidate path from a
   trigger to an outcome. Add the paths that the persona's "must never" items threaten, and any
   upstream system that acts like a user (an import, a scheduled run, a webhook).
4. **Keep only critical ones** (`references/journey-checklist.md`): it serves a brief outcome or a
   persona's must-never, and someone would notice within a day if it broke. Fold variants into one
   journey's failure paths rather than writing near-duplicates.
5. **Write each CUJ** from the template, about 12 lines:
   - title: the persona doing the thing, in their words ("An organiser settles the month");
   - **Actor** (free text) and **Personas** (PER-n ids; required once `docs/product/` exists);
   - **User-facing**: yes when a person sees screens on the path (it then needs a UX flow); no for a
     system-only path;
   - **Goal**; **Trigger**: one observable event;
   - **Steps**: three to seven, each an observable action or system response, no implementation;
   - **Success**: the observable end state, with a number when one exists;
   - **Unwanted**: what must never happen on this path (loss, leak, double charge);
   - **Failure paths**: expected failures and how the user recovers, separated by semicolons;
   - **Critical because**: the outcome or must-never it protects.
6. **Map to EARS, do not write requirements here.** Trigger → event-driven, Success → state-driven
   or ubiquitous, Unwanted and each failure path → unwanted-behaviour. writing-requirements writes
   the rows; stop at the journey.
7. **Check coverage**: every persona owns at least one journey (else drop the persona or add the
   journey); every brief outcome is served by at least one journey; nothing in a non-goal appears.
8. **Validate.** If `harness validate` is available, run it on `specs/<epic>/cuj.md` (in a harness
   checkout: `node tools/validate.mjs specs/<epic>/cuj.md`). The trace check (`--trace`) reports
   `persona-has-journey` and, until requirements and tasks exist, `journey-has-requirement` and
   `journey-has-task`; that is the to-do list for the next skills, not a failure here.

## Outputs

- `specs/<epic>/cuj.md` (contract `journey`), one `## CUJ-n · title` entry per journey. If the epic
  has no `spec.md` yet, writing-requirements creates it next.
- A hand-back listing each CUJ with its persona and whether it is user-facing, the journeys dropped
  as not critical, and any persona left without a journey.

## Gates and stop conditions

- **Stop (needs-human)** when a journey would need a persona the brief does not serve, or would do
  something the brief lists as a non-goal; when the success state needs a number only the owner
  knows; when two personas' journeys conflict (one must see what the other must never expose).
- Never invent a step the person has not described when it changes scope (a payment, a new role, an
  export): ask.
- No screens, no criteria, no tasks here; hand to designing-flows (user-facing) and
  writing-requirements.

## References

- `references/cuj-template.cuj.md` — `cuj.md`, ready to fill; validates against `journey`.
- `references/journey-checklist.md` — what "critical" means, the EARS mapping, failure-path
  wording, scale and target lengths.
