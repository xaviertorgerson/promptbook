---
epic: my-epic   # the folder name under specs/; the path wins when they differ
---

# Critical user journeys — <epic name>

<!-- Copy to specs/<epic>/cuj.md. Only journeys someone would notice breaking within a day; about 12
     lines each; 3-7 steps. Delete entries you do not use. Ids are stable and never reused.
     Trigger -> event-driven requirement; Success -> state-driven or ubiquitous; Unwanted and each
     failure path -> unwanted-behaviour (writing-requirements writes them).
     Check: harness validate specs/<epic>/cuj.md (or --contract journey <file> elsewhere). -->

## CUJ-1 · A <persona role> <does the thing>
- **Actor:** the <role> (PER-1)
- **Personas:** PER-1
- **User-facing:** yes
- **Goal:** <what they are trying to achieve, in their words>
- **Trigger:** <the one observable event that starts it>
- **Steps:**
  1. <observable action or system response>
  2. <observable action or system response>
  3. <observable action or system response>
- **Success:** <the observable end state; a number when one exists>
- **Unwanted:** <what must never happen on this path>
- **Failure paths:** <what goes wrong> → <how the user recovers>; <what goes wrong> → <recovery>
- **Critical because:** <the brief outcome or persona must-never it protects>

## CUJ-2 · The <upstream system> <does the thing>
- **Actor:** the <system or job>
- **Personas:** PER-1
- **User-facing:** no
- **Goal:** <what the system must achieve for the persona>
- **Trigger:** <the event or schedule that starts it>
- **Steps:**
  1. <observable system step>
  2. <observable system step>
- **Success:** <the observable end state>
- **Unwanted:** <what must never happen>
- **Critical because:** <the outcome it protects>
