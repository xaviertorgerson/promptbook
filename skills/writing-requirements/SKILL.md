---
name: writing-requirements
description: Use when an epic's journeys need checkable requirements before design or tasks — "write the requirements", "turn the CUJs into EARS", "write the spec for this epic", "our NFRs say 'fast', make them measurable", "what are the acceptance criteria patterns", "add a security / privacy / accessibility / cost requirement". Writes specs/<epic>/spec.md - REQ-n as EARS sentences (ubiquitous, event-driven, state-driven, unwanted-behaviour, optional-feature), NFR-n with a category and a measure, each traced to a CUJ - and the AC-n patterns tasks restate them in. Do not use for deciding whether to build (framing-products), for writing the journeys (mapping-journeys), for splitting the epic into tasks (planning-work), or for choosing an architecture (choosing-architecture). For a single change to one component's contract with no journey to trace, the pinned Skilldex writing-specifications skill may fit better.
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Optional - Node 22 and the harness validator to check spec.md against the epic and requirement contracts.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Writing requirements

Turn an epic's journeys into requirements an agent can stop on: each functional requirement one
EARS sentence, each quality one measurable NFR, each traced to the journey it serves. If you cannot
name the test that would prove a requirement, it is not a requirement yet.

## Inputs

- `specs/<epic>/cuj.md` (contract `journey`): trigger, success, unwanted, failure paths.
- The brief's Outcomes, Non-goals and Constraints; the personas' context and "must never".
- An existing `specs/<epic>/spec.md`, if any: amend it; never renumber an id.
- Contracts: `epic` (spec.md frontmatter `epic`, `status`, `priority`, `size`, `business_value`,
  `initiative`, `owner`; sections Problem, Scope, Requirements, Tasks, Acceptance) and
  `requirement` (table rows under `## Requirements`: ID, Requirement, Module, Verified by, CUJ, ADR;
  an NFR row adds Category and Measure). Template: `references/spec-template.md`.

## Procedure

1. **Size the work.**

   | Work | Do |
   |---|---|
   | Bug, chore | No new spec. Find the REQ or NFR the bug violates; if none exists, add one row to the epic it belongs to. The fix task adds a regression criterion (planning-work). |
   | Feature | One spec.md: 3–10 REQ rows and only the NFRs the feature changes. |
   | New product | One spec.md per epic. Add the product-wide NFRs (security, privacy, accessibility, availability, cost) to the first epic, and reference them from later epics as `<epic>/NFR-n`. |
   | `risk: high` (money, personal data, irreversible actions) | Add the unwanted-behaviour and the security or privacy NFRs even for a small change. |

2. **Prefer the pinned alternative when it fits.** Use Skilldex `writing-specifications` instead
   when the deliverable is one design document for one component's contract (an internal library,
   an API or protocol, a migration) with no persona or journey to trace, or when the project does not
   use these contracts. Use this skill whenever requirements must trace to journeys and tasks.
3. **Write or open spec.md** from the template. A new spec starts at `status: scoping`, which the
   owner's request authorises; keep Problem, Scope In/Out and Interfaces short and in plain words.
4. **Functional requirements: transcribe each journey** (`references/ears.md`):
   - the Trigger → an event-driven REQ ("When <trigger>, the <system> shall <response>.");
   - the Success → a state-driven or ubiquitous REQ;
   - the Unwanted and each failure path → an unwanted-behaviour REQ ("If <condition>, then the
     <system> shall <response>.");
   - behaviour that exists only with a setting or plan → optional-feature ("Where <feature>, …").
   One behaviour per row: no "and", no "or", no "etc.". The system named is the component under
   test, and the response is observable from outside it.
5. **Non-functional requirements: one category and one measure per row.** Ask which qualities the
   journeys and personas make non-negotiable, and write only those: performance, availability,
   security, privacy, accessibility, cost and operability first; the full category list and
   example measures are in `references/nfr-catalog.md`. A measure has a number, a unit, a condition
   and a way to check it ("p95 < 300 ms at 20 rps, measured by the load test in CI"). "Fast",
   "secure" and "scalable" are not NFRs.
6. **Trace every row.** Fill the CUJ column (REQ rows always; NFR rows when one journey owns the
   quality, otherwise leave it empty). Fill Module (where it is verified) and Verified by (the kind
   of test or check). Leave ADR empty unless a decision already exists; choosing-architecture adds
   ADRs for NFRs that shape structure.
7. **Check each row** against `references/requirements-checklist.md`: a test can be named, one
   behaviour, no implementation, no unbounded words. Every journey has at least one REQ; no REQ
   serves a non-goal.
8. **Write the Acceptance line** (the epic's definition of done): every REQ and NFR verified,
   every task merged, the docs updated.
9. **Fix the criteria patterns tasks will use.** Tasks restate the requirements they implement as
   `AC-n`, numbered per task, one EARS sentence each ending with the id:
   `- AC-1 — When …, the <system> shall … (REQ-2)`; an NFR keeps its measure:
   `- AC-3 — The balances API shall answer within 300 ms at p95 under 20 rps (NFR-1)`. Every AC id
   appears in the name of the test that proves it (`references/ears.md`). Placing criteria in
   tasks is planning-work's job; make sure each row can be restated this way.
10. **Validate.** If `harness validate` is available, run it on `specs/<epic>/spec.md` (in a harness
    checkout: `node tools/validate.mjs specs/<epic>/spec.md`), then the trace (`--trace <root>`):
    fix `journey-has-requirement` and `journey-exists` before handing on. `requirement-has-task`
    stays open until planning-work runs.

## Outputs

- `specs/<epic>/spec.md`, which holds both the `epic` frontmatter and the `requirement` rows.
- A hand-back listing the REQ and NFR ids, any journey without a requirement, and the NFRs that
  need an architecture decision (for choosing-architecture).

## Gates and stop conditions

- **Stop (needs-human)** when a measure needs a number only the owner can set (a latency target, an
  uptime level, a budget); when a requirement would contradict a non-goal or another epic's REQ;
  when a legal or compliance requirement is suspected but not confirmed. Write the question in the
  spec's Open questions with an owner and leave the row out rather than guess.
- Never weaken an existing requirement to make it fit; changing a requirement in an approved epic
  is the owner's call (it moves the epic back to `scoping`).
- Do not decompose into tasks here (planning-work), and never set `status: approved`: that is the
  owner's spec gate.

## References

- `references/spec-template.md` — spec.md, ready to fill; validates against `epic` and `requirement`.
- `references/ears.md` — the five patterns, the complex form, journey mapping, AC-n patterns,
  rewrites of bad requirements.
- `references/nfr-catalog.md` — categories with example measures and how each is verified.
- `references/requirements-checklist.md` — the per-row rubric and the scale table.
