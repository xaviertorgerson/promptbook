# Journey checklist

## What "critical" means

A journey is critical when **both** hold:

1. **It protects something the plan promised**: a brief outcome, a persona's "must never", a legal
   or contractual duty, or money.
2. **Breaking it would be noticed within a day** by the persona, support, or finance.

A path nobody would notice breaking is not a CUJ; it may still be a requirement or a task. Variants
of one path (a different payment method, an empty input) are failure paths of one journey, not new
journeys.

## Per-journey rubric

| Field | Pass when |
|---|---|
| Title | the persona doing the thing, readable by the owner |
| Actor / Personas | the actor is a role or system; Personas cites existing PER ids |
| User-facing | stated; yes means a UX flow is required before readiness |
| Trigger | one observable event, not a feature ("opens Settle up", not "uses the app") |
| Steps | 3–7, observable, no implementation (no tables, endpoints, components) |
| Success | observable end state, with a number when one exists |
| Unwanted | the outcome that must never happen, specific enough to test |
| Failure paths | expected failures, each with how the user recovers |
| Critical because | names the outcome or must-never it protects |

## From journey to EARS (for writing-requirements)

| Journey field | EARS pattern | Example |
|---|---|---|
| Trigger | event-driven | When an organiser opens Settle up, the app shall show each housemate's balance. |
| Success | state-driven or ubiquitous | While a month is settled, the app shall show every balance as zero. |
| Unwanted | unwanted-behaviour | If a bill is saved twice, then the app shall keep one copy. |
| Failure path | unwanted-behaviour | If the network drops while saving, then the app shall keep the draft and retry. |
| Optional variant | optional-feature | Where reminders are on, the app shall notify a housemate who owes money. |

## Coverage checks before handing on

- Every persona owns at least one journey; a persona that owns none is dropped or gets a journey.
- Every brief outcome is served by at least one journey.
- No journey does something listed under the brief's non-goals.
- Each user-facing journey will get a UX flow (designing-flows).

## Scale and length

| Work | Journeys | Length |
|---|---|---|
| Bug, chore | none new; cite the journey it breaks | — |
| Feature | 1–3 in the feature's epic | about 12 lines each |
| New product | 3–7 across personas, riskiest first | the file fits on two printed pages |

A journey over 7 steps is usually two journeys; split at the point where a different persona or a
different trigger takes over.

## Fields the parser reads

`Actor`, `Personas`, `User-facing`, `Goal`, `Trigger`, `Steps`, `Success` (a parenthetical such as
`Success (observable)` is fine), `Unwanted`. Other labels (`Failure paths`, `Critical because`) are kept
as extras and never fail validation. Keep each value on one line; only `Steps` takes sub-items.
