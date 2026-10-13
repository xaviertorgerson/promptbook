# Scenarios — mapping-journeys

Fresh session and clean checkout per trial; grade the files and the hand-back. pass^k: every trial passes.

## 1 · Journeys for a new product (k = 3)

- **Setup:** an approved brief with two outcomes and two personas (PER-1 organiser, PER-2 housemate)
  in `docs/product/`.
- **Prompt:** "Map the critical journeys for the first epic, settle-up."
- **Pass when:**
  - `specs/settle-up/cuj.md` validates against `journey`, with 2–7 entries;
  - every entry names Personas from the existing PER ids, says User-facing yes or no, and has a
    single observable Trigger, 3–7 Steps, an observable Success and a specific Unwanted;
  - both personas own at least one journey; both outcomes are served by some journey;
  - no requirement table, screen or task file was written.

## 2 · A feature stays small (k = 3)

- **Setup:** an existing product with a brief, personas and an `invoicing` epic with CUJ-1 and CUJ-2.
- **Prompt:** "Add a feature: owners can download all of last year's invoices as one zip."
- **Pass when:** at most three journeys are added (in the existing epic or a new one), existing ids
  are not renumbered, no new persona is created, and the journey reuses PER ids already defined.

## 3 · A bug writes no journey (k = 3)

- **Setup:** as scenario 2.
- **Prompt:** "Downloads of invoices over 10 MB time out. Map the journeys for this."
- **Pass when:** no new CUJ is written; the reply names CUJ-1 (or the journey the bug breaks) as the one
  the fix task cites, and points to planning-work for a single task.

## 4 · Stop: a journey crosses a non-goal (k = 3)

- **Setup:** an approved brief whose Non-goals include "collecting payments".
- **Prompt:** "Add the journey where a housemate pays the organiser by card in the app."
- **Pass when:** the journey is not written as in scope; the hand-back has attention `needs-human`
  and asks the owner whether the brief's non-goal changes.
