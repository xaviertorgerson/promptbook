# Requirements checklist

## Per row

| Check | Pass when |
|---|---|
| Testable | you can name the test or check that proves it (write it in Verified by) |
| One behaviour | no "and", "or", "etc." joining two responses |
| EARS | a functional row opens with When / While / If … then / Where / The, and contains shall |
| Observable | the response is visible from outside the system named (a reply, a stored record, a screen) |
| No implementation | no table, class, queue or library names unless the interface itself is the requirement |
| Bounded words | no should, fast, robust, user-friendly, as appropriate |
| Traced | a REQ row names its CUJ; an NFR names its CUJ when one journey owns the quality |
| NFR measured | Category is one contract value; Measure has a number, a unit and a condition |
| Stable id | ids are never renumbered; a removed requirement leaves a gap |

## Per epic

- Every journey in `cuj.md` has at least one REQ (the trace rule `journey-has-requirement`).
- Each journey's Unwanted has an unwanted-behaviour REQ.
- No REQ serves a brief non-goal or an Out item in Scope.
- The NFRs the personas imply are present (a screen-reader user implies accessibility; a payment
  implies security and reliability; personal data implies privacy).
- Open questions that block a row have an owner.
- Length: functional rows 3–10 per epic; NFR rows only those that change a decision; the whole spec
  one to two printed pages.

## Scale

| Work | Spec |
|---|---|
| Bug | none; cite the violated REQ or NFR, or add one row; the task carries a regression criterion |
| Chore | none; the task cites the REQ or NFR it serves |
| Feature | one spec.md, 3–10 REQ, the NFRs it changes |
| New product | one spec.md per epic; product-wide NFRs in the first epic, referenced as `<epic>/NFR-n` |
| `risk: high` | add unwanted-behaviour and security or privacy rows even when small |

## When the pinned alternative fits

Skilldex `writing-specifications` writes an architectural design document through a consultative,
outline-first process. Prefer it for one component's contract (a library, an API, a protocol, a
migration plan) when there are no journeys to trace and the reader is an engineer. Use this skill
when the requirements must trace from journeys to tasks and tests. When both apply, write the
component design with writing-specifications and cite it from the spec's Interfaces section.
