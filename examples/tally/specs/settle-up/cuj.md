---
epic: settle-up
---

# Critical user journeys — Settle up

<!-- From skills/mapping-journeys/references/cuj-template.md. Fictional sample data. -->

## CUJ-1 · An organiser logs a shared bill
- **Actor:** the organiser (PER-1)
- **Personas:** PER-1
- **User-facing:** yes
- **Goal:** record a bill once so every housemate's share is right
- **Trigger:** the organiser taps Add bill in their household.
- **Steps:**
  1. The organiser enters the amount, the payer and the date.
  2. Tally splits it evenly across the household's members.
  3. The bill appears in the month's list with each member's share.
- **Success:** the bill is listed and every member's balance includes their share, to the cent.
- **Unwanted:** the bill is saved twice, or appears in another household.
- **Failure paths:** network drops while saving → the draft is kept and retried; amount is not a positive number → field error, nothing saved
- **Critical because:** the first outcome (months settle without a spreadsheet) depends on every bill being recorded once

## CUJ-2 · A housemate settles their share from a link
- **Actor:** a housemate (PER-2)
- **Personas:** PER-2, PER-1
- **User-facing:** yes
- **Goal:** see what they owe this month and mark it paid without an account
- **Trigger:** the housemate opens the household link the organiser shared.
- **Steps:**
  1. Tally shows the month's bills and what the housemate owes.
  2. The housemate marks their share paid.
  3. The organiser sees the balance drop to zero.
- **Success:** the housemate's balance shows zero and the organiser sees it as paid.
- **Unwanted:** a link shows another household's bills, or works after the organiser revokes it.
- **Failure paths:** revoked link → a page that says the link no longer works, with no data; marked paid by mistake → undo within 24 hours
- **Critical because:** the second outcome (less chasing) and persona PER-2's must-never (no account, no leak)
