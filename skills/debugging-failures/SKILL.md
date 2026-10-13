---
name: debugging-failures
description: Use when something is broken and the cause is unknown — a failing or flaky test, "fails only on CI", an error, a 500, a wrong total, a regression after a deploy; reproduce, find the root cause, fix it. Do not use for writing new tests (writing-tests).
license: MIT
compatibility: Any agent runtime that reads Agent Skills; any language. Uses git for history and bisection.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Debugging failures

Resist patching the symptom. Reproduce the failure, find the true cause, fix it there, and leave a
regression test so it cannot come back unnoticed.

Typical asks: "why is X failing", "this is broken", a bug report, an incident, a failing or flaky
test, a test that fails only on CI, an error in the logs, a wrong number in production, a regression
after a deploy.

Hand off instead: a scheduled health sweep with no specific symptom (an L4 runtime audit); who
introduced code or why it changed (writing-commit-history); adding tests to working code
(writing-tests); mining many past runs for lessons (reflecting-on-runs).

## Inputs

- The symptom: the report, the failing test, the log line, the request id, the incident timeline.
- The task or incident it belongs to (`task` contract: `id`, `## Acceptance criteria`), if any.
- The history: `git log`, the commits and releases around when it started.
- Run records (`run-record`) when the failure is an agent run's: `outcome`, `reason`, `subtype`.

## Procedure

Copy the list into your working notes and tick it as you go.

1. **Reproduce deterministically.** Capture the exact inputs, state, environment and version. Turn it
   into the smallest command or test that fails every time. A bug you cannot reproduce you cannot
   claim to have fixed. For intermittent failures, run it many times and record the rate
   ([flaky](references/flaky.md)).
2. **Localize.** Narrow to the smallest failing unit ([localizing](references/localizing.md)):
   - in time: `git log -- <path>`, `git log -S '<string>'`, `git bisect run <repro>` between a good and
     a bad commit;
   - in space: follow the data from the boundary inward; halve the input; disable halves of the path;
   - by difference: what differs between where it passes and where it fails (environment, config in
     effect, data, versions, time zone, concurrency).
   Add temporary instrumentation if needed, and remove it before the fix lands.
3. **Find the root cause, not the proximate cause.** Ask why until you reach a defect you can change:
   "it threw on null" is a symptom; "we never validated the upstream response" is the cause. Write
   the causal chain in one or two sentences, with the evidence for each link.
4. **Write the regression test first** (writing-tests): it reproduces the bug and fails on the current
   code. Name it with the criterion id when the bug breaks a criterion (`AC-2 …`), else with the
   symptom.
5. **Fix at the cause.** The smallest change that removes the cause, not a defensive wrapper, retry or
   wider catch that hides it. The regression test turns green; the full suite stays green.
6. **Look for siblings.** Search for the same defect class elsewhere (same pattern, same misuse, same
   missing validation) and fix or file each.
7. **Record it.** The commit body states symptom, cause and fix (writing-commit-history). If the cause
   is a recurring class, add it to the project's failure catalog, an ADR, or the owning skill's
   `evidence.md` as an `incident` entry.

## Outputs

- A failing-then-passing regression test, and the fix, as one logical change.
- A short diagnosis in the hand-back: symptom, reproduction, causal chain with evidence, fix,
  siblings found. Include both test runs (red before, green after).
- Filed follow-ups for siblings not fixed here; an evidence or catalog entry for a recurring class.

## Gates and stop conditions

- **Don't:** fix by retrying, sleeping, widening a catch or swallowing an error; delete, skip or weaken
  the failing test; declare it fixed without a reproduction that now passes.
- **Flaky tests are bugs:** never retried into green, quarantined silently or marked skip; find the
  shared state, timing or ordering cause.
- Set attention `needs-human` and stop when:
  - it cannot be reproduced from the available evidence: say so, list what is needed (logs, inputs,
    access), and do not ship a speculative fix as a fix;
  - reproducing needs production access, real customer data or a real secret;
  - the fix needs a destructive data action (repairing or deleting rows, dropping a table, wiping a
    volume): propose it, never run it;
  - the cause is in a security boundary (auth, secrets, injection): hand to reviewing-security as
    well;
  - the root cause is a requirement that contradicts another: the owner decides.

## References

- [references/localizing.md](references/localizing.md): bisection, where to look first, the
  difference method.
- [references/flaky.md](references/flaky.md): intermittent failures, their usual causes, how to prove
  a fix.
