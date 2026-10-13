# Flaky and intermittent failures

A test that fails sometimes is reporting a real defect: in the code, in the test, or in the
environment. Retrying it into green hides that defect from everyone after you.

## Measure first

Run the test (or the suite slice) many times in a loop, in the same order and in random order, alone
and with the rest of the suite. Record the failure rate. A fix is proven only when the rate drops to
zero over at least as many runs as it took to see the failure several times.

## Usual causes

| Cause | Tell | Fix at the cause |
|---|---|---|
| shared mutable state between tests | fails with other tests, passes alone | fresh state per test; no module-level fixtures that mutate |
| test order dependence | fails in random order | make each test set up what it needs |
| timing: sleeps, races, unawaited async work | fails under load or on slower machines | await the observable state; fake the clock |
| real time, dates, time zones | fails near midnight, month end, in another zone | inject the clock; fix the zone |
| randomness | fails for some seeds | seed or inject the random source; log the seed |
| external network or service | fails when the service is slow | fake at the boundary |
| resource limits | fails in CI with less memory or fewer cores | bound the work; release resources |
| leaked environment | fails after a test that set a variable or wrote a file | restore state in teardown |

## Fails only on CI

Compare the CI environment with yours (the difference method): runtime and dependency versions,
environment variables, parallelism, file system case sensitivity, locale and time zone, missing
services, resource limits. Reproduce with the CI image locally when possible.

## Never

- a retry decorator or rerun-on-failure setting as the fix;
- a skip, a quarantine without an owner and a date, or a loosened assertion;
- a longer timeout without knowing what it was waiting for.
