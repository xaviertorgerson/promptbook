# EARS — requirements and criteria with one reading

EARS (Easy Approach to Requirements Syntax) limits each requirement to one of five sentence shapes,
so it has exactly one reading and a test can be named for it. The validator classifies each row and
each acceptance criterion by its opening word and the word **shall**.

## The five patterns

| Pattern | Shape | Use for |
|---|---|---|
| Ubiquitous | `The <system> shall <response>.` | an always-true property, no precondition |
| Event-driven | `When <trigger>, the <system> shall <response>.` | a response to a discrete event |
| State-driven | `While <state>, the <system> shall <response>.` | behaviour that holds during a state |
| Unwanted-behaviour | `If <condition>, then the <system> shall <response>.` | errors and things that must not happen |
| Optional-feature | `Where <feature is present>, the <system> shall <response>.` | behaviour only with a feature, plan or setting |

**Complex** combines a state and a trigger: `While <state>, when <trigger>, the <system> shall
<response>.` It classifies as state-driven.

The opening keyword is load-bearing: When = event, While = state, If … then = unwanted, Where =
optional, a bare The … shall = ubiquitous. `<system>` is the component under test ("the balances
API", "the settle-up screen"). The response is observable from outside it.

## From a journey

| Journey field | Pattern |
|---|---|
| Trigger | event-driven |
| Success | state-driven or ubiquitous |
| Unwanted, each failure path | unwanted-behaviour |
| A variant behind a setting or plan | optional-feature |

## Examples

- The ledger shall record every bill with its payer, amount in minor units and date. *(ubiquitous)*
- When an organiser saves a bill, the app shall show each housemate's new share within 1 second. *(event)*
- While a month is settled, the app shall reject edits to that month's bills. *(state)*
- If the same bill is submitted twice within 10 seconds, then the API shall store one bill. *(unwanted)*
- Where reminders are enabled, the app shall email a housemate whose balance is owed for 7 days. *(optional)*
- While a settlement is in progress, when a new bill arrives, the app shall add it to the next month. *(complex)*

## Rewrites

| Not a requirement | Why | EARS |
|---|---|---|
| The system should be fast. | no shall, no measure | an NFR: performance, "p95 < 300 ms at 20 rps" |
| Handle bad input gracefully. | no condition, no response | If an amount is not a positive number, then the API shall reject it with a field error. |
| Support CSV export. | a feature name | When an owner requests an export, the API shall return a CSV of the month's bills. |
| Save the bill and notify housemates and update balances. | three behaviours | three rows |
| The app shall use a queue for emails. | implementation | When a bill is saved, the app shall send each housemate one email within 5 minutes. |

Banned words in a statement: should, may, etc., and/or, as appropriate, user-friendly, fast,
robust, seamless, intuitive, minimal, sufficient. Each hides a decision; make the decision.

## Acceptance criteria (AC-n) in tasks

A task restates only the requirements it implements, as criteria numbered from AC-1 inside that
task, one EARS sentence each, ending with the requirement id:

```markdown
## Acceptance criteria (EARS)
- AC-1 — When an organiser saves a bill, the balances API shall return each housemate's share. (REQ-1)
- AC-2 — If the same bill is submitted twice within 10 seconds, then the API shall store one bill. (REQ-3)
- AC-3 — The balances API shall answer within 300 ms at p95 under 20 rps. (NFR-1)
```

- The id is `AC-<n>` with a hyphen; `AC1` is a legacy form and warns.
- Each AC id appears in the name of the test that proves it, best as `<TASK-ID> AC-<n> <what>` so the
  same AC number in two tasks is never ambiguous: `it('SPLIT-2 AC-1 returns each share', …)`.
- A UI criterion names the state it proves (empty, loading, error, success) so the browser check can
  screenshot each one.
- A regression criterion for a bug is an unwanted-behaviour sentence describing the bug's trigger.
