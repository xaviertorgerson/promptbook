# Naming tests by criterion id

The trace from a requirement to its proof ends in a test name: BRIEF → persona → journey → REQ/NFR →
task → `AC-n` → a test whose name contains `AC-n`. A criterion is "covered" when its id appears as a
whole token in a test's name string.

## The rule

- Write the id exactly as the task writes it: `AC-2` (capitals, hyphen, no padding). Legacy `AC2` is
  read but flagged; don't write new ones.
- Put it at the start of the name, followed by the behavior: `AC-2 rejects orders past the cutoff`.
- Qualify with the task id when the same `AC-n` exists in more than one task in the repository:
  `BILL-7 AC-2 rejects …`. Unqualified names then count for every task with that id, which hides gaps.
- The id must be in the **name string the runner reports**, not in a comment or a variable.

## By language and runner

| Runner style | Write | Note |
|---|---|---|
| `it(...)`, `test(...)`, `describe(...)` (JS/TS runners) | `it('AC-2 rejects orders past the cutoff', …)` | read by the harness trace check and by the template's coverage script |
| `describe` grouping by task | `describe('BILL-7', () => { it('AC-2 …') })` | the qualified form is the name string; put the task id in the `it` too |
| function-name runners (Python, Rust, Go `TestXxx`) | a name string the runner reports: a display-name decorator, a parametrize id, or a subtest name (`t.Run("AC-2 rejects…")`) | the function name alone cannot hold `AC-2`; the harness trace check today reads only JS/TS test calls (see below) |
| annotation runners (JUnit, NUnit, xUnit) | the display-name annotation: `@DisplayName("AC-2 rejects…")` | same caveat |

## What the checks read today

- The harness trace check (`node tools/validate.mjs --trace <root> --tests "<glob>"`) extracts the
  first string argument of `it`, `test` and `describe` calls in the files the globs match. Its default
  globs are JS/TS test files.
- agentic-template's `scripts/ears-coverage.mjs` reads the same way.
- In other languages, until a reader exists, list the coverage by hand in the hand-back and say that
  the automated check could not see it. Do not claim the gate passed.

## Mini-example

Task `BILL-7`:

```markdown
## Acceptance criteria (EARS)
- AC-1 When a plan is upgraded mid-cycle, the system shall prorate by remaining days.
- AC-2 If the upgrade request is past the cycle cutoff, then the system shall reject it with a reason.
```

Tests:

```js
describe('BILL-7 proration', () => {
  it('BILL-7 AC-1 prorates by remaining days on a mid-cycle upgrade', …);
  it('BILL-7 AC-1 credits the unused part of the old plan', …);
  it('BILL-7 AC-2 rejects an upgrade past the cutoff with a reason', …);
  it('BILL-7 AC-2 accepts an upgrade exactly at the cutoff', …);   // boundary
});
```

Coverage line: `AC-1 ✓ (2 tests) · AC-2 ✓ (2 tests)`.
