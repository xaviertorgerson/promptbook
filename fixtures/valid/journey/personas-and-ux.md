---
epic: invoicing
---

# Critical User Journeys — Invoicing

## CUJ-1 · An account owner downloads last month's invoice
- **Actor:** an account owner
- **Personas:** PER-1
- **User-facing:** yes
- **Goal:** get a PDF of last month's invoice for their accountant
- **Trigger:** the owner opens Billing → Invoices.
- **Steps:**
  1. The page lists invoices, newest first.
  2. The owner selects last month's and downloads the PDF.
- **Success (observable):** the PDF downloads and its total equals the invoice row's total.
- **Unwanted:** a draft invoice is downloadable, or another tenant's invoice is listed.

## CUJ-2 · The invoicer closes a period
- **Actor:** the billing pipeline
- **User-facing:** no
- **Goal:** every rated period becomes exactly one invoice
- **Trigger:** a period's rating completes.
- **Success:** one invoice per account per period, immutable once sent.
- **Unwanted:** a second invoice for the same account and period.
