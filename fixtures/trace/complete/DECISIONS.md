# Decisions

## ADR-0001: Every invoice query is scoped by tenant in the repository layer
**Status:** Accepted
**Date:** 2026-10-01
**Decision:** The invoice repository takes a tenant id and adds it to every query.
**Why:** A missing WHERE clause is the usual cross-tenant leak.
**Door:** two-way
**Satisfies:** invoicing/NFR-1
**Consequences:** No query reaches invoices without a tenant.
