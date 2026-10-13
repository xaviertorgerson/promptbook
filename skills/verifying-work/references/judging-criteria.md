# Judging criteria

## Objective artifact per criterion kind

| Criterion shape (EARS) | Primary artifact | How to judge | Also check |
|---|---|---|---|
| Event: "When <trigger>, the <system> shall <response>" | the test carrying the id; the running app | fire the trigger (test, or drive the preview), observe the response | the response is asserted, not just "no error" |
| State: "While <state>, … shall …" | a test that sets up the state | enter the state, act, observe; leave the state, observe the difference | the state is really entered (not mocked away) |
| Unwanted: "If <condition>, then … shall <handling>" | a test that forces the condition | force the failure, observe the handling | no partial side effects remain (rows, events, files) |
| Optional: "Where <feature>, … shall …" | tests with the feature on and off | both settings | the default matches the spec |
| Ubiquitous: "The <system> shall …" | a property or invariant test; a scan | across representative inputs | not proven by one example |
| Non-functional (NFR with a measure) | a measurement in the preview or a bench | run it, compare with the measure | the environment is stated |
| UI behaviour | the preview, driven through the journey | a scripted or manual walk, screenshot or trace saved | the four states (empty, loading, error, success) where the flow names them |
| Nothing runnable exists | a rubric scored per criterion | 0 or 1 per criterion with the evidence quoted | record "rubric only" as a limitation |

## Is the test real?

For every criterion's test:

1. It exists and its name contains the id (`AC-2`), as the criteria-in-test-names check requires.
2. It asserts the criterion's observable response. A test that only calls the code is not evidence.
3. It would fail without the change. Cheap check: run it against `<base>` (the test file applied
   on the base) or read the assertion against the base behavior. Skip when it is expensive, and say so.
4. The diff did not delete, skip, mark pending, or loosen an assertion, snapshot or threshold
   elsewhere to make the suite green (`git diff <base>...<head> -- <test globs>`).
5. It does not depend on the order of other tests or on wall-clock luck (k repetitions show it).

Any "no" is a `blocks AC-n` finding for that criterion.

## k by risk (pass^k)

| `risk` | k | Rationale |
|---|---|---|
| low | 1 | the default evaluation |
| medium | 2 | mandatory evaluation; one repeat exposes flakiness |
| high | 3 | 75% per trial is about 42% over three trials: a flaky pass shows up |

A criterion passes only when all k trials pass. Report the trials, not the best one. k applies to
the judgement: re-run the tests k times, and take k independent trials of an app walk or rubric
score (fresh page load, fresh data).

## What earns a finding

A finding names a location, the consequence, and the evidence (command and output, screenshot,
trace). It is one of:

| Class | Meaning | Blocks the verdict? |
|---|---|---|
| `blocks AC-n` | that criterion is unmet, or its evidence is not real | yes |
| `defect` | a material, evidence-backed problem outside the criteria (a regression, a broken neighbour, data loss on an error path) | yes when a human or a `dispose-findings` policy selects it; reported either way |
| `follow-up` | tangential, pre-existing, or an improvement | no; listed separately |

Not findings: style, naming, preferred patterns (the pinned reviewing-code skill's territory), and
anything the evaluator only suspects without evidence (list under limitations instead).
