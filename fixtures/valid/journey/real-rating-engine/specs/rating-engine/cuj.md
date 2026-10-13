<!-- ILLUSTRATIVE EXAMPLE — delete with the rest of specs/rating-engine/. -->

# Critical User Journeys — Rating engine

## CUJ-1 · A period's usage becomes billable line items
- **Actor:** the billing pipeline (after aggregation closes a period)
- **Goal:** turn aggregated usage into money the invoicer can render
- **Trigger:** a period is marked aggregated → an EARS *Event-driven* criterion.
- **Steps:**
  1. The rater reads the period's aggregated usage and the account's active plan.
  2. It computes a line-item amount per rated dimension.
  3. It emits `LineItemRated` events.
- **Success (observable):** every aggregated record has a corresponding line item with a `rate_version`.
- **Unwanted:** an unknown/expired plan id silently produces a `0` charge.

## CUJ-2 · Late events don't double-bill
- **Actor:** the billing pipeline (a late event arrives after a period was rated)
- **Goal:** re-rate the period without creating duplicate charges
- **Trigger:** a rerate is requested for an already-rated period.
- **Success:** the period's line-item set is replaced atomically; totals are correct; no duplicates.
- **Unwanted:** a rerate appends a second set of line items.

## CUJ-3 · A mid-cycle plan change is fair
- **Actor:** an account that upgrades/downgrades mid-cycle
- **Goal:** charge only for what was used on each plan
- **Trigger:** a plan change lands mid-period.
- **Success:** the period is split at the change date and each segment rated on its plan, prorated.
- **Unwanted:** the whole period is charged at the new (or old) plan rate.
