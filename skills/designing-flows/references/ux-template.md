---
epic: my-epic
prototype: docs/ux/prototypes/my-epic/index.html   # a URL to a design tool, or a repository path to a clickable HTML prototype
---

# UX — <epic name>

<!-- Copy to docs/ux/<epic>.md. One UX-n per user-facing journey (one flow may serve several CUJs);
     about 20 lines each. Every screen that shows data names all four states. Keep each field value
     on one line; only Steps and States take sub-items. Flow notation: references/flow-notation.md.
     Check: harness validate docs/ux/<epic>.md (or --contract ux-flow <file> elsewhere). -->

## Screens
- **<Screen>** — reached from <where>; for <what the user does here>
- **<Screen>** — reached from <where>; for <what the user does here>

## UX-1 · <the journey, as the user would name it>
- **CUJs:** CUJ-1
- **Requirements:** REQ-1, REQ-3, NFR-4
- **Steps:**
  1. **<Screen>** → <user action> → **<Screen>**
  2. **<Screen>** ? <decision> → yes: **<Screen>** · no: **<Screen>**
  3. **<Screen>** → <user action> → ⏹ <exit: the journey's success>
- **States:**
  - **Empty:** <what a first-time user sees, and the one action offered>
  - **Loading:** <what stays usable; skeleton or progress; what happens after about 10 seconds>
  - **Error:** <the message in the user's words, what is kept, how to retry>
  - **Success:** <the populated screen and the confirmation of the action>
- **Accessibility:** <focus after each action; labels; what is announced; the keyboard path; contrast exceptions>
- **Criteria for the building task:** <the states and decisions a task must prove, e.g. empty, error-retry, keyboard path>

## Walkthroughs

| Date | CUJ | Walked by | Prototype | Result | What failed | Changed |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | CUJ-1 | <person or evaluator> | <link or version> | pass / fail | <finding, or none> | <what changed in the flow, or none> |
