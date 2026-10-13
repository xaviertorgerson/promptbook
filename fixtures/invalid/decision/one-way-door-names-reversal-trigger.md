# Decisions (ADRs)

## ADR-0030: Invoices are rendered to PDF in the worker
**Status:** Accepted
**Date:** 2026-10-02
**Door:** one-way
**Decision:** The worker renders each invoice to PDF once, at send time.
**Why:** The rendered file is the legal artifact.
**Consequences:** Re-rendering a sent invoice is not a feature.

<!-- A one-way door with no "Reversed when": nothing says what evidence would justify paying the
     cost of walking back through it. -->
