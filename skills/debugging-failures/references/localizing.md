# Localizing a failure

## Where to look first

1. **What changed** near when it started: `git log --since=<date> --oneline`, the release notes of
   the deploy, dependency lockfile diffs, configuration and environment changes.
2. **The boundaries**: external API responses, configuration values actually in effect at runtime
   (not the ones in the file), environment variables, queue and job state, clock and time zone.
3. **The audit trail**: structured logs joined by request or correlation id; the sequence of events
   for the failing case.
4. **Resource state**: memory, connection pools, rate-limit counters, locks, stuck or partially
   written rows, disk.

## Bisection in time

```sh
git bisect start <bad-commit> <good-commit>
git bisect run <command that exits non-zero when the bug reproduces>
git bisect reset
```

Use `git log -S '<string>'` to find when a line appeared or disappeared and `git log -- <path>` for
one file's history. Read the commit message of the culprit before guessing its intent.

## Bisection in space

- Halve the input until the smallest failing input remains.
- Comment out or stub half of the path (in a scratch branch) to see which half holds the defect.
- Replace a dependency with a known-good fake; if the failure disappears, the boundary is involved.

## The difference method

List everything that differs between a passing and a failing run and eliminate one difference at a
time: machine, operating system, runtime version, dependency versions, configuration, data, time and
time zone, locale, parallelism, test order, network. The last difference standing is the lead.

## Root cause, worked

- Symptom: invoice total off by one cent for some customers.
- Reproduction: a fixture with three line items of 33.335 fails every time.
- Localize: `git log -S 'toFixed'` shows a change that rounds each line instead of the total.
- Why: line items were rounded before summing; why: the amount type is a float, not integer minor
  units; why: the boundary that parses the provider's response never converted to minor units.
- Cause: the missing conversion at the boundary. Fix there; the regression test asserts the total for
  the 33.335 fixture; siblings: two other parsers of the same provider.
