# Verdict · SPLIT-2 @ a41c9e2 · fail

Base integration/settle-up@7e21c0b · risk medium · k = 2 · evaluator gemini (writer claude) · fictional sample data.

| Criterion | Runs | Evidence |
|---|---|---|
| AC-1 | 0/2 | two identical submits sent concurrently both stored a bill in the preview |
| AC-2 | 2/2 | e2e: save fails, draft kept, Retry shown |
| AC-3 | 2/2 | e2e: amount 0 and -5 show a field error, nothing stored |
| AC-4 | 2/2 | load test p95 212 ms at 20 rps |

## Findings
1. **Material, in scope (AC-1).** `src/bills/save.ts:41` reads the idempotency key, then inserts;
   nothing in the table is unique, so two concurrent requests both pass the read. The AC-1 test
   submits in sequence only. Needs a unique constraint and a concurrent test.
2. **Outside the criteria.** The bills list query has no index on `(household_id, created_at)`.
   Disposition is the coordinator's (GRANT-1 dispose-findings).
