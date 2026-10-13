---
name: writing-tests
description: Use when new or changed behavior has no tests, or a criterion has no test that proves it — "add tests", "write a test for", "cover AC-3", "which criteria are untested", "this bug fix needs a regression test", "what should I fake here" — or a done check finds a coverage gap. Covers what to test, how to structure it, what to fake, and naming tests by criterion id. Do not use for diagnosing why a test fails or is flaky (debugging-failures), or for independently judging whether a change meets its criteria (verifying-work).
license: MIT
compatibility: Any agent runtime that reads Agent Skills; any language and test runner. The criterion-coverage check needs Node 22 when the harness tools are present.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Writing tests

Tests are the verification gate that makes shipping and unattended loops safe, and the evidence a
reviewer reads. Each acceptance criterion is proven by a test whose name carries its id. Tests are
never deleted, skipped or weakened to get a green build.

## Inputs

- The task file (`task` contract): its `## Acceptance criteria` bullets, each starting `AC-n`, and its
  `id` (for example `BILL-7`). Its `evaluator` list, if set, says what decides "met".
- The requirements the task cites (`REQ-n`, `NFR-n` in the epic's spec) when a criterion is unclear.
- The code under test and its existing tests: the runner, the file naming pattern, the fakes already
  in use. Match them.
- For a bug: the reproduction (inputs, state, the failing observation).

## Procedure

1. **List the criteria.** One line per `AC-n` with the behavior it promises. A criterion that cannot
   be observed from outside the code is a question for the task's author, not a test.
2. **Name tests by criterion id** ([naming](references/naming.md)). The id appears literally as
   `AC-n` in the test's name string, at the start: `"AC-2 rejects orders past the cutoff"`. When
   another task in the repository has the same `AC-n`, qualify it: `"BILL-7 AC-2 rejects …"`. One
   criterion may have several tests; every criterion has at least one.
3. **Decide what to cover**, in priority order:
   1. the behavior each criterion promises, as assertions on observable results;
   2. boundaries: empty, null, zero, one, many, minimum and maximum, first and last, off-by-one;
   3. failure paths: bad input rejected at the boundary; an external failure (timeout, 5xx, partial
      response) handled; a retried side effect applied once (idempotency);
   4. every permission refused for every role that must not have it (one negative test per row);
   5. **a regression test for every bug fixed**: it fails on the code before the fix and passes after.
4. **Pick the level.** Unit for logic, integration for wiring and contracts at boundaries, one
   end-to-end path for each critical journey. Prefer the lowest level that can observe the criterion.
5. **Fake at the boundary, run the core real** ([faking](references/faking.md)). Fake time,
   randomness, network, external services, mail, payments and storage through seams the code already
   has; never mock the module under test. No real network or shared database in unit tests.
6. **Write each test** Arrange–Act–Assert, one behavior per test, deterministic: no sleeps (await the
   observable state), no order dependence, no shared mutable state. Property or fuzz tests for pure
   functions with invariants.
7. **Prove the test can fail.** Run it against the code without the change (or break the line it
   guards) and see it go red, then green with the change. A test that passes either way proves
   nothing; rewrite it.
8. **Check coverage of criteria.** If the harness tools are present, run
   `node tools/validate.mjs --trace <project-root> --tests "<glob>"`; the project may also have its own
   criterion-coverage script. Every `AC-n` of the task must appear in a test name before the task
   moves to `review`.
9. **Report** the coverage line: `AC-1 ✓ (2 tests) · AC-2 ✓ · AC-3 ✗ <why>`.

## Outputs

- Test files beside the project's existing tests, following its naming and runner.
- A coverage line per task, in the hand-back (`return` contract: `criteria.met` and `criteria.unmet`
  with reasons) and in the task's agent log.
- For a bug: the regression test, plus both runs (red before, green after) in the hand-back.

## Gates and stop conditions

- **Never weaken a test to pass:** no deleting, skipping, loosening an assertion, raising a timeout to
  hide a race, or marking a known failure as expected without a recorded reason. A red test that is
  an accepted gap carries a dated note saying why and who accepted it.
- A task does not move to `review` while any `AC-n` lacks a test name containing it.
- Set attention `needs-human` and stop when:
  - a criterion is ambiguous or unobservable (put the question under the task's "Open questions");
  - proving a criterion needs a real secret, production data, or a paid or outbound side effect;
  - the only way to make a test pass is to change an existing test's expectation (the expectation
    may be the spec; a human decides).

## References

- [references/naming.md](references/naming.md): the id-in-name rule, per-language forms, what the
  coverage check reads.
- [references/faking.md](references/faking.md): what to fake, what to run real, seams.
- [references/anti-patterns.md](references/anti-patterns.md): change-detector tests, over-mocking,
  flaky constructs.
