# What to fake

Fake what is slow, non-deterministic, external or costly; run your own logic for real.

| Fake (at the boundary, through an injected seam) | Run real |
|---|---|
| the clock, timers, time zones | the domain logic under test |
| randomness, id generation | pure functions and calculations |
| the network: third-party APIs, webhooks in, outbound calls | in-process wiring between your own modules |
| payments, email, SMS, push | your validation and error handling |
| object storage, queues (in unit tests) | the database, in integration tests, on a per-test or per-branch instance |
| feature-flag and analytics services | serialization and the contracts your module exposes |

Rules:

- **One seam per external dependency**: an interface or adapter the code receives, which a test
  replaces. If there is no seam, adding one is part of the change (and a design finding to report).
- **Never mock the unit under test** or the module it belongs to: the test then proves the mock.
- **Fakes behave like the real thing on the paths you test**: a payment fake that declines, times out
  and returns a duplicate event, not one that always succeeds.
- **Idempotency**: deliver the same external event id twice and assert one effect.
- **Integration tests use a real database** isolated per test run (a per-branch database, a
  container, a transaction rolled back per test), never a shared one.
- **No real network or secret** in any test that runs in CI by default.

## Mini-example

The checkout service calls a payment provider.

- Fake: the provider adapter (`PaymentPort`) with scripted responses: approved, declined, timeout,
  duplicate webhook.
- Real: the checkout logic, the order state machine, the database (integration level).
- Tests: `AC-1 charges once on approval`, `AC-2 marks the order failed on decline`,
  `AC-3 retries a timeout at most three times with backoff`, `AC-4 applies a duplicate webhook once`.
