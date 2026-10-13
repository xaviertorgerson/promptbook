# Scenarios — writing-requirements

Fresh session and clean checkout per trial; grade the files and the hand-back. pass^k: every trial passes.

## 1 · Journeys become traced EARS requirements (k = 3)

- **Setup:** `specs/settle-up/cuj.md` with CUJ-1 (organiser logs a bill, user-facing) and CUJ-2
  (organiser settles the month), each with a trigger, success, unwanted and one failure path; an
  approved brief and personas.
- **Prompt:** "Write the requirements for settle-up."
- **Pass when:**
  - `specs/settle-up/spec.md` validates against `epic` and `requirement`, `status: scoping` or `draft`;
  - every REQ classifies as an EARS pattern (the parser's `ears` is not null) and names a CUJ;
  - each journey's trigger has an event-driven REQ and its unwanted outcome an unwanted-behaviour REQ;
  - no row joins two behaviours with "and";
  - the trace check reports no `journey-has-requirement` or `journey-exists` gap.

## 2 · Vague NFRs become measurable (k = 3)

- **Setup:** a spec.md with `| NFR-1 | performance | The app is fast. | fast | — |` and
  `| NFR-2 | security | The app is secure. | secure | — |`.
- **Prompt:** "Make these NFRs measurable."
- **Pass when:** each NFR row has one contract category and a measure with a number, a unit and a
  condition, and a Verified by entry; where a number cannot be derived from the brief or personas, the
  row is left as an Open question with an owner instead of an invented threshold.

## 3 · A bug gets one row at most (k = 3)

- **Setup:** an existing epic with REQ-1..REQ-6; the bug report says a double-tap saves a bill twice.
- **Prompt:** "Write the requirements for this bug."
- **Pass when:** no new spec.md is created; either an existing REQ is cited as violated or exactly one
  unwanted-behaviour row is added; existing ids are unchanged; the reply points to planning-work for
  one task with a regression criterion.

## 4 · Stop: a threshold only the owner can set (k = 3)

- **Setup:** a brief with an outcome "settle in one sitting" and no uptime or latency target anywhere.
- **Prompt:** "Add availability and latency NFRs with the right numbers and approve the spec."
- **Pass when:** no uptime or latency number is invented; the questions are in Open questions with the
  owner named; the hand-back has attention `needs-human`; `status` is not `approved`.

## 5 · Routes a single component contract to the pinned alternative (k = 3)

- **Setup:** a repository with no `specs/` and no product docs.
- **Prompt:** "Write a design spec for our internal rate-limiter library's API, for the engineers who
  will use it."
- **Pass when:** the reply recommends Skilldex `writing-specifications` (or proceeds with it if
  installed) and does not create a spec.md with REQ rows.
