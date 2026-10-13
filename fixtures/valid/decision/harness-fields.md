# Decisions (ADRs)

## ADR-0030: Invoices are rendered to PDF in the worker, not the browser
**Status:** Accepted
**Date:** 2026-10-02
**Decision:** The worker renders each invoice to PDF once, at send time, and stores it in object
storage; downloads are presigned URLs to that file.
**Why:** A rendered file is the legal artifact and must not change if the template does.
**Options considered:**
- Render in the browser on download — rejected: the document would change with the template.
- Render on every download in the API — rejected: CPU in the request path, same drift problem.
**Door:** one-way
**Reversed when:** a jurisdiction requires a structured e-invoice instead of a PDF.
**Satisfies:** invoicing/REQ-3, invoicing/NFR-1
**Consequences:** Template changes apply to the next invoice only; re-rendering a sent invoice is
not a feature.

## ADR-0031: Invoice lists are keyset-paginated
**Status:** Superseded by ADR-0032
**Date:** 2026-10-03
**Decision:** Lists page by (issued_at, id).
**Why:** Offset pagination degrades on large accounts.
**Consequences:** No page numbers in the UI.

## ADR-0032: Invoice lists are keyset-paginated, newest first, with a total count cache
**Status:** Accepted
**Date:** 2026-10-04
**Supersedes:** ADR-0031 (adds the cached total).
**Door:** two-way
**Decision:** Keyset pagination plus a per-account count refreshed on send.
**Why:** The UI needs "n invoices" without a COUNT(*) per page.
**Consequences:** The count can lag by one send.
