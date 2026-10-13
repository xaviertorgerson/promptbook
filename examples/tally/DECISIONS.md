# Decisions

<!-- From skills/choosing-architecture/references/adr-template.md. Fictional sample data. -->

## ADR-0001: Every query is scoped by a household id resolved from the session or link
**Status:** Accepted
**Date:** 2026-10-13
**Decision:** The repository layer takes a household id on every call and adds it to every query; a
household link resolves to exactly one household id, or to none once revoked.
**Why:** NFR-2 (0 cross-household rows) ranks first, and a missing filter is the usual leak. Link
access without accounts (PER-2) makes the link the only credential, so it must resolve to one household.
**Options considered:**
- One database per household — rejected: isolation is strong, but the cost NFR and one part-time developer cannot run hundreds of databases.
- Row-level security in the database alone — rejected: the link-resolved household does not map to a database role without extra machinery; kept as a later hardening.
- A household id required by the repository layer, chosen — meets NFR-2 with the pack's default datastore and is testable in the negative-path suite.
**Door:** one-way
**Reversed when:** a tenant needs data residency or an isolation guarantee the shared schema cannot give.
**Satisfies:** settle-up/NFR-2, settle-up/REQ-3, settle-up/REQ-5
**Fitness function:** the tenancy probe (two households, every list endpoint, 0 foreign rows) and a dependency rule that only the repository layer imports the database client.
**Consequences:** Every new query needs a household id; cross-household reports need a separate, audited path.

## ADR-0002: Follow the stack pack's defaults for the bills service
**Status:** Accepted
**Date:** 2026-10-13
**Decision:** Use the pinned stack pack's datastore, API style and web rendering without deviation.
**Why:** The pack already meets NFR-1 on comparable services; no requirement forces a departure.
**Door:** two-way
**Reversed when:** the load test shows p95 over 300 ms at 20 rps after indexing.
**Satisfies:** settle-up/NFR-1
**Consequences:** No deviation to maintain; the pack's upgrades apply as they ship.

## ADR-0003: Household pages meet WCAG 2.2 AA and are checked per flow
**Status:** Accepted
**Date:** 2026-10-13
**Decision:** The household page and its states are built to WCAG 2.2 AA and an automated audit runs on every flow in CI.
**Why:** PER-2 may use a screen reader (assumption under test); NFR-3 sets the bar.
**Door:** two-way
**Reversed when:** the pilot shows the audit misses issues a manual walk finds, and a stronger check is chosen.
**Satisfies:** settle-up/NFR-3
**Consequences:** Each UI task's evaluator includes the audit and a keyboard-only walk.

## ADR-0004: Support the browsers housemates open links in, checked on a device matrix
**Status:** Accepted
**Date:** 2026-10-13
**Decision:** The household page targets the last two major versions of mobile Safari and Chrome and
the pilot chat app's in-app browser; CI runs CUJ-2 end to end on that matrix.
**Why:** NFR-4. Housemates open the link from a group chat on a phone (PER-2), and in-app browsers
lag the system browser; a page that fails there fails the journey that settles the month.
**Options considered:**
- Latest browser versions only — rejected: pilot phones lag a version or two behind.
- Every browser with a market share above 1% — rejected: one part-time developer cannot test it, and the pilot needs only the phones its households use.
- The pilot's browsers on a device matrix in CI, chosen — small, measurable, and it grows with the pilot.
**Door:** two-way
**Reversed when:** the pilot's analytics show a browser outside the matrix opening more than 5% of household links.
**Satisfies:** settle-up/NFR-4
**Consequences:** The build targets the matrix's oldest engine; a new chat app in the pilot adds a row to the matrix before its households are invited.
