# Test anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| change-detector test (asserts the implementation's calls, private state or exact structure) | breaks on every refactor, proves nothing about behavior | assert the observable result |
| over-mocking until the test exercises only mocks | green while the real code is broken | fake only at the boundary |
| a test that passes before the fix | it is not a regression test | make it fail on the old code first |
| `sleep` to wait for async work | flaky and slow | await the observable state or a fake clock |
| order-dependent tests, shared mutable fixtures | pass alone, fail together (or the reverse) | fresh state per test |
| one test asserting many unrelated behaviors | a failure does not say which behavior broke | one behavior per test |
| skipping the failure path "because it won't happen" | it happens in production | test it at the boundary |
| `.skip`, `xfail`, or a loosened assertion to get green | hides a real failure | fix the code, or record a dated, accepted known-failure with its reason |
| the criterion id only in a comment or file name | the coverage check cannot see it | put `AC-n` in the test name string |
| snapshots of large outputs nobody reads | approve-all on change | assert the fields the criterion names |
| real network, real third-party sandbox, real secrets in CI | non-deterministic, leaks, costs | fakes; a separate opt-in contract test |
