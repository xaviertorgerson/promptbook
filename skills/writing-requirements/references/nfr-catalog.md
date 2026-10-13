# NFR catalog

Write an NFR only when a journey, a persona or a constraint makes the quality non-negotiable. Each row
names one category, one measure (a number, a unit, a condition) and how it is verified. The
`Category` column takes exactly one of the contract's values (lowercase): performance, reliability,
availability, security, privacy, accessibility, usability, operability, observability, cost,
compliance, maintainability, portability, scalability.

## The seven to consider first

| Category | Ask | Example measure | Verified by |
|---|---|---|---|
| performance | how long may the slowest common path take, under what load | p95 < 300 ms for the balances endpoint at 20 rps; first contentful paint < 1.5 s on a mid-range phone over 4G | a load test in CI; a lab performance budget per page |
| availability | how much downtime can the users absorb, and when | 99.5% monthly for the API measured by an external probe every minute | an off-box probe and its monthly report |
| security | what must an attacker never do; what must a user never see | 0 cross-tenant rows in the negative-path suite; every route denies without a session | negative-path permission tests; an authorization matrix test |
| privacy | which personal data, where, for how long, who sees it | no personal data in logs (0 hits for the log-scan patterns); account data deleted within 30 days of a request | a log scan in CI; a deletion job test |
| accessibility | which standard and level, for which flows | WCAG 2.2 AA on every user-facing flow; 0 serious violations in the automated audit; keyboard-only completion of each CUJ | an automated audit per flow plus a keyboard walk of each journey |
| cost | what may it cost to run, at what scale | infrastructure under 50 per month at 1,000 households; under 0.01 per settlement in third-party fees | the monthly bill against the budget; a per-unit cost report |
| operability | how fast is a failure seen, understood and undone | a failed job is visible to an operator within 5 minutes; a restore drill finishes in under 30 minutes; a rollback takes one action | an alert test; a drill record; a rollback rehearsal |

## Others, when they apply

| Category | Example measure |
|---|---|
| reliability | 0 lost bills across 10,000 simulated crashes mid-save; every job retried with backoff and dead-lettered after 5 tries |
| observability | every request has a correlation id in logs; each CUJ has one dashboard panel |
| usability | 4 of 5 first-time organisers settle a month unaided in a moderated test |
| compliance | data stays in the EU region; an audit log entry for every permission change |
| scalability | p95 holds at 10× today's peak in a load test |
| maintainability | the dependency rules pass in CI (no cycles, the domain never imports adapters) |
| portability | runs on the two named browsers' last two major versions |

## Writing the measure

- One number per row. Two thresholds (latency and throughput) are one condition: "p95 < 300 ms at 20 rps".
- Name the percentile, not the average. Name the condition (load, device, network, data size).
- Name who measures and where; a measure nobody can check is not a requirement.
- If the owner cannot give the number yet, do not invent one: put the question in Open questions
  with an owner and leave the row out.

## Which NFRs need an ADR

An NFR that constrains structure (performance at scale, availability, tenancy isolation, data
residency, cost ceilings) usually needs an architecture decision. List those ids in the hand-back
for choosing-architecture; it records the ADR and fills the ADR column.
