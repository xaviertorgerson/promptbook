---
epic: invoicing
prototype: https://www.figma.com/proto/abc123/invoicing
---

# UX — Invoicing

## UX-1 · Download an invoice
- **CUJs:** CUJ-1
- **Requirements:** REQ-3, NFR-1
- **Steps:**
  1. Billing → Invoices lists invoices, newest first.
  2. Each row has a Download action.
- **States:**
  - **Empty:** "No invoices yet — your first arrives after your first billing period."
  - **Loading:** skeleton rows; the header stays interactive.
  - **Error:** "We couldn't load invoices." with Retry; support link after two failures.
  - **Success:** the list; Download starts the PDF immediately.
- **Accessibility:** rows are a table with a caption; Download is a button with the invoice number in its label.
