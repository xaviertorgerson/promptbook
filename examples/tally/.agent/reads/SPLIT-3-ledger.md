# Read · SPLIT-3 · where shares and balances live

Read-only, for the SPLIT-3 author · fictional sample data. Most relevant first.

- `src/ledger/balance.ts:12` — the only balance computation: sum of shares per member, joined to
  bills by household id. AC-1 changes it to skip paid shares.
- `migrations/0001_skeleton.sql:30` — `shares(id, bill_id, member_id, amount)`: no `paid_at`, so
  AC-1 and AC-2 need a migration (SPLIT-3's lane on `migrations/**`).
- `src/household/view.ts:8` — the household page's data; takes the household id from the link
  resolver (ADR-0001), so a paid share needs no new tenancy check.
