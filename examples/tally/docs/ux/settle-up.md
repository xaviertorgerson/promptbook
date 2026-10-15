---
epic: settle-up
prototype: docs/ux/prototypes/settle-up/index.html
---

# UX — Settle up

<!-- From Skilldex skills/designing-flows/assets/ux-template.ux.md. Fictional sample data. -->

## Screens
- **Bills** — reached from the household home; the month's bills and balances
- **New bill** — reached from Bills → Add bill; enter amount, payer, date
- **Household page** — reached from the shared link; what this housemate owes, Mark paid
- **Link revoked** — reached from a revoked link; says the link no longer works

## UX-1 · Log a shared bill
- **CUJs:** CUJ-1
- **Requirements:** REQ-1, REQ-2, REQ-6, REQ-7, NFR-1
- **Steps:**
  1. **Bills** → taps Add bill → **New bill**
  2. **New bill** ? amount is a positive number → yes: saves · no: **New bill** (field error)
  3. **New bill** → saves → **Bills** (the new bill at the top, shares updated) ⏹ bill logged
- **States:**
  - **Empty:** "No bills this month yet." with an Add bill button; balances read zero.
  - **Loading:** skeleton rows; Add bill stays usable; after 10 seconds a "still loading" note with Retry.
  - **Error:** "We couldn't save this bill. Your entry is kept." with Retry; the draft stays filled in.
  - **Success:** the bill at the top of the list with each member's share; a "Bill saved" confirmation.
- **Accessibility:** focus moves to the amount field on New bill and to the saved bill's row on return; "Bill saved" is announced; field errors are tied to their field.
- **Criteria for the building task:** empty, error with draft kept, success with shares; double submit stores one bill.

## UX-2 · Settle a share from the household link
- **CUJs:** CUJ-2
- **Requirements:** REQ-3, REQ-4, REQ-5, REQ-8, NFR-2, NFR-3, NFR-4
- **Steps:**
  1. **Household page** (loading) → loads → **Household page** with what this housemate owes
  2. **Household page** → taps Mark paid → **Household page** (balance zero, Undo for 24 hours) ⏹ share settled
  3. **Link revoked** → shown instead of step 1 when the link is revoked ⏹ no data shown
- **States:**
  - **Empty:** "Nothing to pay this month." with the month's total for context.
  - **Loading:** a skeleton of the balance card; nothing personal is shown until loaded.
  - **Error:** "We couldn't load this household." with Retry; a revoked link shows Link revoked instead.
  - **Success:** the balance card with Mark paid; after paying, zero and an Undo button.
  - **Revoked:** "This link no longer works. Ask your organiser for a new one." and no household data.
- **Accessibility:** Mark paid is a button whose name includes the amount; the new balance is announced; the whole flow completes with the keyboard; contrast meets 4.5:1.
- **Criteria for the building tasks:** success shows zero, Undo for 24 hours, keyboard-only completion on every browser of the matrix (SPLIT-3); the revoked state shows no data (SPLIT-4).

## Walkthroughs

| Date | CUJ | Walked by | Prototype | Result | What failed | Changed |
|---|---|---|---|---|---|---|
| 2026-10-13 | CUJ-1 | dana (fictional proof walk) | index.html | pass | none | none |
| 2026-10-13 | CUJ-2 | dana (fictional proof walk) | index.html | fail | no way to undo a share marked paid by mistake | added Undo for 24 hours to step 2 and the success state; REQ-8 added to the spec |
| 2026-10-13 | CUJ-2 | dana, keyboard only (fictional proof walk) | index.html | pass | none | none |
