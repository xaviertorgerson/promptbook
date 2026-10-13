---
epic: my-epic                # the folder name under specs/
status: scoping              # intake → scoping → draft → approved (the owner's spec gate) → in-progress → done
priority: P2                 # P0 · P1 · P2 · P3
size: M                      # XS · S · M · L · XL
business_value: medium       # low · medium · high (or 1-5)
initiative: null             # an initiative slug, or null
owner: null                  # the human product owner; required from approved on
---

# Epic: <epic name>

<!-- Copy to specs/<epic>/spec.md. About one to two printed pages. One behaviour per REQ row, one
     category and one measure per NFR row, every REQ traced to a CUJ. Delete example rows you do not
     use; never renumber an id. Statements stay EARS (references/ears.md).
     Check: harness validate specs/<epic>/spec.md (or --contract epic / --contract requirement). -->

- **CUJs:** [`cuj.md`](cuj.md)  ·  **ADRs:** none yet
- **Rationale (value vs effort):** <one line: why this priority and size>

## Problem / motivation
<1-3 sentences: what need this serves and what is wrong or absent today. Cite the brief outcome.>

## Scope
**In:** <what this epic delivers>
**Out:** <what it explicitly does not do>

## Requirements

### Functional

| ID | Requirement | Module | Verified by | CUJ |
|---|---|---|---|---|
| REQ-1 | When <trigger>, the <system> shall <observable response>. | <module> | <unit / integration / e2e test> | CUJ-1 |
| REQ-2 | While <state>, the <system> shall <observable response>. | <module> | <test> | CUJ-1 |
| REQ-3 | If <unwanted condition>, then the <system> shall <handling response>. | <module> | <test> | CUJ-1 |
| REQ-4 | Where <feature or setting is enabled>, the <system> shall <observable response>. | <module> | <test> | CUJ-1 |
| REQ-5 | The <system> shall <always-true property>. | <module> | <test> | CUJ-1 |

### Non-functional

| ID | Category | Requirement | Measure | Verified by | CUJ | ADR |
|---|---|---|---|---|---|---|
| NFR-1 | performance | The <system> shall <respond within a bound>. | <p95 < N ms at M rps> | <load test in CI> | CUJ-1 | — |
| NFR-2 | security | The <system> shall <protection>. | <0 cross-tenant rows in the negative-path suite> | <permission tests> | — | — |
| NFR-3 | privacy | The <system> shall <data handling rule>. | <no personal data in logs; retention N days> | <log scan; retention job test> | — | — |
| NFR-4 | accessibility | The <system> shall <meet the accessibility bar>. | <WCAG 2.2 AA; 0 serious violations in the automated audit> | <accessibility check per flow> | — | — |
| NFR-5 | availability | The <system> shall <stay up>. | <99.5% monthly on the health probe> | <external probe> | — | — |
| NFR-6 | cost | The <system> shall <stay within a budget>. | <under N per month at M users> | <monthly bill review> | — | — |
| NFR-7 | operability | The <system> shall <be diagnosable or recoverable>. | <restore drill under N minutes> | <drill record> | — | — |

## Interfaces / contracts
<New or changed endpoints, events, schemas. Mark any breaking change loudly.>

## Risks & edge cases
<Failure modes, rate limits, concurrency, security surface. Keep to the ones that change a requirement.>

## Open questions
- [ ] <question> — answered by <person>

## Tasks
<!-- planning-work fills this index; each row matches a task file's frontmatter. -->

| Task | Title | CUJ | Priority | Depends on |
|---|---|---|---|---|

## Acceptance (epic Definition of Done)
Every REQ and NFR above verified · every task merged · the docs updated · learnings recorded (or
"none" with one line of why).
