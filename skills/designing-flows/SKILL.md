---
name: designing-flows
description: Use when user-facing journeys need their screens designed before tasks are cut — "design the flow for CUJ-1", "what screens does this need", "write the UX for this epic", "what do the empty, loading and error states look like", "make a clickable prototype", "walk the prototype through the journeys", "is this flow accessible". Writes UX-n flows in docs/ux/<epic>.md - steps in plain-Markdown flow notation, the four states (empty, loading, error, success) per screen, an accessibility checklist, a prototype link - and records the result of walking the prototype against every CUJ. Do not use for the visual design system, brand, colours or type (the project's design pack), for writing requirements (writing-requirements), or for building the real screens (implementing-task).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Optional - Node 22 and the harness validator; a browser or a design tool to walk the prototype.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Designing flows

Design every user-facing journey screen by screen before code, including the states the happy path
hides, then prove the design by walking a prototype through each journey and writing down what
failed. A flow is done when every screen has its four states and every walk is recorded.

## Inputs

- `specs/<epic>/cuj.md`: journeys with `User-facing: yes`, their steps, success, unwanted and
  failure paths.
- `specs/<epic>/spec.md`: the REQ rows the flow realises and the accessibility, performance and
  privacy NFRs.
- Personas' context (device, expertise, access needs) and the project's design system, if one
  exists (tokens, components, the accessibility bar). This skill does not choose colours or type.
- Contract `ux-flow`: `## UX-n · title` entries with `CUJs`, `Requirements`, `Steps` (sub-items),
  `States` (sub-fields `Empty`, `Loading`, `Error`, `Success`), `Accessibility`; `prototype` in the
  file's frontmatter (or per flow). Template: `references/ux-template.ux.md`.

## Procedure

1. **Size the work.**

   | Work | Do |
   |---|---|
   | No user-facing journey (an API, a job, an import) | Skip. Mark the journeys `User-facing: no`. |
   | Bug in an existing screen | No new flow. Name the state that is wrong; the fix task gets a criterion for it. |
   | Change to one screen | Amend the existing flow's step and states; re-walk only the journeys that pass through it. |
   | New feature or product | One UX-n per user-facing CUJ (one flow may serve several), a prototype, a walk per CUJ. |

2. **Map the information architecture** for the epic in a few lines: the screens, where each is
   reached from, and what each is for. Reuse existing screens before adding one.
3. **Write each flow** as numbered steps in the notation of `references/flow-notation.md`:
   `Screen → action → Screen`, decisions as `?` branches, exits as `⏹`. Add a Mermaid flowchart
   only when the flow branches more than twice; the numbered steps stay the source of truth.
4. **Design the four states for every screen that shows data**: what the user sees and what they
   can do next.
   - **Empty**: the first visit, and a filter with no matches; explain and offer the next action.
   - **Loading**: what stays usable; skeleton or progress; what happens after about 10 seconds.
   - **Error**: what failed in the user's words, what is kept, how to retry; never a raw code.
   - **Success**: the populated screen and the confirmation of the action.
   Add a `Partial` or `Offline` state when the journey's failure paths need one.
5. **Accessibility.** Run the checklist in `references/flow-checklist.md` for each flow and write
   the decisions that are specific to it (focus after an action, labels, announcements, keyboard
   path) in the `Accessibility` field. The bar comes from the project's accessibility NFR, or
   WCAG 2.2 AA when none is set.
6. **Make the cheapest prototype that can be walked**, in a design tool or as a clickable HTML
   prototype (static pages linked together, states switchable by a link or toggle). It shows every
   step and all four states; it does not need real data or real styling. Put its link (a URL or a
   repository path) in the file's `prototype` frontmatter. A prototype is a planning artifact: it is
   not merged as the implementation unless a task says so.
7. **Walk the prototype against every CUJ it serves.** A human, or a separate evaluator with a
   browser, follows each journey's trigger and steps through the prototype, then its unwanted
   outcome and each failure path, keyboard only for at least one walk. Record one row per walk in
   the Walkthroughs table: date, CUJ, who walked, result (pass or fail), what failed, what changed.
   Fix the flow, not only the prototype, and walk again until every CUJ passes.
8. **Carry states into criteria.** List, per flow, the states that become acceptance criteria on the
   task that builds the screen; a browser check later screenshots all four (planning-work places them).
9. **Validate.** If `harness validate` is available, run it on `docs/ux/<epic>.md` (in a harness
   checkout: `node tools/validate.mjs docs/ux/<epic>.md`), then `--trace <root>`: every user-facing
   CUJ must reach a flow (`user-facing-journey-has-ux`).

## Outputs

- `docs/ux/<epic>.md` (contract `ux-flow`): one `## UX-n · title` per flow and a Walkthroughs
  table with a passing row for every CUJ the flows serve.
- The prototype, wherever it lives; only its link is in git.
- A hand-back listing the flows, the walk results, and the states each task must prove.

## Gates and stop conditions

- **Stop (needs-human)** when a walk fails and the fix would change a journey or a requirement
  (send it back to mapping-journeys or writing-requirements with the finding); when the design needs
  a decision about brand, tone or the design system; when no one can walk the prototype (record the
  walk as not done; never mark it passed).
- A walk by the agent that drew the prototype is a self-check, not the walk of record; the walk of
  record is by a human or a separate evaluator.
- No production code here.

## References

- `references/ux-template.ux.md` — `docs/ux/<epic>.md`, ready to fill; validates against `ux-flow`.
- `references/flow-notation.md` — the plain-Markdown notation, an optional Mermaid form, the
  information-architecture list, and prototype handoff.
- `references/flow-checklist.md` — the four-state rubric, the accessibility checklist, the
  walkthrough protocol and scale.
