---
epic: settle-up
status: draft
priority: P1
size: M
business_value: high
initiative: null
owner: dana
mode: spec-driven
---

# Epic: Settle up

<!-- From skills/writing-requirements/references/spec-template.md. Fictional sample data. -->

- **CUJs:** [`cuj.md`](cuj.md)  ·  **ADRs:** ADR-0001, ADR-0002, ADR-0003, ADR-0004
- **Rationale (value vs effort):** both brief outcomes depend on it and it is the smallest useful slice; P1, M.
- **Mode:** spec-driven (choosing-methodology): clear behaviour, unattended agents, one human reviewer.
- **Lands on:** the skeleton on `main`; every later task on `integration/settle-up`, which dana merges into `main` (landing-changes, tier 3).

## Problem / motivation
Organisers rebuild a spreadsheet and chase housemates every month (brief: Problem). This epic lets a
household log bills and settle each member's share from a link.

## Scope
**In:** log a bill, even split, a household link for housemates, mark a share paid, revoke a link.
**Out:** moving money; uneven splits; reminders (an open question in the brief).

## Requirements

### Functional

| ID | Requirement | Module | Verified by | CUJ |
|---|---|---|---|---|
| REQ-1 | When an organiser saves a bill, the ledger shall add each member's even share to their balance. | `ledger` | unit test | CUJ-1 |
| REQ-2 | If the same bill is submitted twice within 10 seconds, then the API shall store one bill. | `api/bills` | integration test | CUJ-1 |
| REQ-3 | When a housemate opens a valid household link, the app shall show that household's bills and the housemate's balance. | `web/household` | e2e test | CUJ-2 |
| REQ-4 | When a housemate marks a share paid, the ledger shall set that share's balance to zero. | `ledger` | unit test | CUJ-2 |
| REQ-5 | If a household link has been revoked, then the app shall show that the link no longer works and no household data. | `api/links` | e2e test | CUJ-2 |
| REQ-6 | If saving a bill fails, then the app shall keep the entered bill as a draft and offer Retry. | `web/bills` | e2e test | CUJ-1 |
| REQ-7 | If a bill's amount is not a positive number, then the app shall show a field error and save nothing. | `web/bills` | e2e test | CUJ-1 |
| REQ-8 | While a share was marked paid less than 24 hours ago, the app shall let the housemate undo it. | `ledger` | unit test | CUJ-2 |

### Non-functional

| ID | Category | Requirement | Measure | Verified by | CUJ | ADR |
|---|---|---|---|---|---|---|
| NFR-1 | performance | The bills API shall acknowledge a saved bill within the save-path latency budget. | p95 < 300 ms at 20 rps on the save path | load test in CI | CUJ-1 | ADR-0002 |
| NFR-2 | security | The API shall return only the requesting household's data. | 0 cross-household rows in the negative-path suite | permission tests | CUJ-2 | ADR-0001 |
| NFR-3 | accessibility | The household page shall meet WCAG 2.2 AA. | 0 serious violations in the automated audit; CUJ-2 completes keyboard-only | accessibility check per flow | CUJ-2 | ADR-0003 |
| NFR-4 | compatibility | The household page shall work in the browsers housemates open links in. | CUJ-2 completes in the last two major versions of mobile Safari and Chrome and in the pilot chat app's in-app browser | device-matrix e2e in CI | CUJ-2 | ADR-0004 |

## Interfaces / contracts
`POST /bills`, `GET /h/{link}`, `POST /h/{link}/shares/{id}/paid`, `DELETE /links/{id}`. New, none breaking.

## Risks & edge cases
A leaked or forwarded link is the main risk (NFR-2, ADR-0001); revocation must take effect at once.
Chat apps open links in their own in-app browsers, which lag the system browser (NFR-4, ADR-0004).

## Open questions
- [x] Is an even split enough for the pilot? → yes; uneven splits are out of scope (dana, 2026-10-13)
- [x] Does revocation need its own task? → yes: it touches only `src/links/**`, so it runs in its own lane beside the save path (dana, 2026-10-13)

## Tasks

| Task | Title | CUJ | Priority | Depends on | Lands on |
|---|---|---|---|---|---|
| [`SPLIT-1`](tasks/SPLIT-1.md) | Walking skeleton: one household's bill, read only through its link | CUJ-1, CUJ-2 | P0 | — | `main` |
| [`SPLIT-2`](tasks/SPLIT-2.md) | Save a bill exactly once | CUJ-1 | P1 | `SPLIT-1` | `integration/settle-up` |
| [`SPLIT-3`](tasks/SPLIT-3.md) | Settle a share from a household link | CUJ-2 | P1 | `SPLIT-1`, `SPLIT-2` | `integration/settle-up` |
| [`SPLIT-4`](tasks/SPLIT-4.md) | Revoke a household link | CUJ-2 | P1 | `SPLIT-1` | `integration/settle-up` |

Lanes (`touches`): SPLIT-2 and SPLIT-3 both add migrations, so SPLIT-3 waits for SPLIT-2; SPLIT-4
touches only links and runs beside them.

## Acceptance (epic Definition of Done)
REQ-1..REQ-8 and NFR-1..NFR-4 verified · SPLIT-1..SPLIT-4 merged · the docs updated · learnings
recorded (or "none" with one line of why).
