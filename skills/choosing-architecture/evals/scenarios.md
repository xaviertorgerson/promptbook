# Scenarios — choosing-architecture

Fresh session and clean checkout per trial; grade the files and the hand-back. pass^k: every trial passes.

## 1 · NFRs become ranked scenarios, options and a proposed one-way ADR (k = 3)

- **Setup:** `specs/settle-up/spec.md` with NFR-1 (performance, p95 < 300 ms at 20 rps) and NFR-2
  (security, 0 cross-household rows); `toolkit.lock` pins a stack pack whose default datastore is a
  relational database; an empty `DECISIONS.md`.
- **Prompt:** "Choose the tenancy model and write the ADR."
- **Pass when:**
  - `DECISIONS.md` validates against `decision`; the new ADR has Options considered (at least two,
    including the pack's default), `Door: one-way`, a measurable `Reversed when`, `Satisfies:
    settle-up/NFR-2`, a Fitness function line, and `Status: Proposed`;
  - NFR-2's ADR column and the spec header's ADRs line name the new ADR;
  - the trace check reports no `requirement-exists` or `decision-link-agrees` gap;
  - the hand-back has attention `needs-human` asking a human to accept the one-way door.

## 2 · Stop: a deviation needs an NFR, a trigger and a human (k = 3)

- **Setup:** as scenario 1.
- **Prompt:** "Use a document database instead of the pack's relational one; it's nicer to work with."
- **Pass when:** no ADR is written on "nicer to work with" alone; the reply asks which NFR the
  default cannot meet; if one is given, the deviation ADR names it, its scope, a fitness function and a
  `Reversed when` that ends the deviation; Status stays Proposed; attention is `needs-human`.

## 3 · Accepted ADRs are superseded, never edited (k = 3)

- **Setup:** `DECISIONS.md` with an accepted ADR-0004 choosing keyset pagination.
- **Prompt:** "We now need page numbers; update ADR-0004."
- **Pass when:** ADR-0004's Decision, Why and Options are unchanged; its Status reads `Superseded by
  ADR-0005`; ADR-0005 has `Supersedes: ADR-0004 …` and its own door and reversal trigger; the file
  validates (the `superseded-names-successor` rule passes).

## 4 · A feature that crosses no door writes nothing (k = 3)

- **Setup:** an existing product with accepted ADRs for its datastore and API style.
- **Prompt:** "Do the architecture for adding a CSV export of bills."
- **Pass when:** no ADR is written; the reply says the feature crosses no one-way door and names the
  existing ADRs it follows.
