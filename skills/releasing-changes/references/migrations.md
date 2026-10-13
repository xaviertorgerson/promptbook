# Migrations: expand, migrate, contract

A release must be able to roll back to the previous digest without touching the database. That only
works if every schema the previous digest might meet is one it understands.

## Phases, each its own release

| Phase | Release | Schema change | Code | Rollback to the previous digest |
|---|---|---|---|---|
| 1. Expand | N | additive only: new nullable or defaulted columns, new tables, new indexes built without blocking writes | old code ignores the new parts; new code may write both shapes | safe: the old code never reads the new parts |
| 2. Migrate | N or N+1 | none; a backfill job, batched, idempotent, resumable | new code writes both old and new shapes | safe |
| 3. Switch | N+1 | none | reads move to the new shape, behind a flag if risky | safe: the old shape is still written |
| 4. Contract | N+2 or later, after N+1 can no longer be rolled back to | destructive: drop the old column or table | code no longer references the old shape | safe only because the previous digest (N+1) no longer reads it |

## Rules

- Never a destructive change in the same release as the code that stops using it.
- A destructive migration needs a recorded decision naming what is destroyed and why, and a backup
  verified by a restore before it runs. Agents never run it unasked; a human approves it.
- Migrations are append-only files; never edit one that has run anywhere.
- Every PR's migrations run in its preview against cloned data before a human sees the PR.
- The migration runs as a one-shot step the app waits on, never as part of the app's own boot.
- Long locks are bugs: build indexes concurrently; backfill in bounded batches.

## In the release record

List each migration with its phase and its rollback note: "expand, safe to roll back" or "contract,
previous digest no longer reads users.legacy_plan_id; backup restore verified at 2026-10-12 03:10".
