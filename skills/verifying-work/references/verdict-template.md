# Verdict template

Write one file per evaluated head: `.agent/verdicts/<ID>-<head-short>.md` (runtime state, not
committed; the PR comment or the task record links it).

```markdown
# Verdict · <ID> @ <head-short>

Outcome: pass | fail
Changeset: <repo> <branch> <base-sha>...<head-sha> · PR <url>
Evaluator: <engine>/<model>, fresh session <id> · Writer: <engine>/<model> · Different family: yes|no
Risk: medium · k = 2 · Evaluated: 2026-10-13T10:12:00Z

## Gates (verbatim result lines)
- tests: <command> → pass (41 passed) ×2
- criteria in test names: <command> → pass
- secret scan: <command> → pass
- protected paths: <command> → pass

## Criteria
| AC | Verdict | Trials | Evidence |
|---|---|---|---|
| AC-1 | pass | 2/2 | rerate.spec.ts:"AC-1 replaces both segments in one transaction"; asserts rows of both segments replaced; fails on base |
| AC-2 | fail | 0/2 | rerate.spec.ts:"AC-2 rejects a concurrent rerate" asserts only that no error is thrown; preview: two rerates at once both succeeded (trace .agent/verdicts/BILL-7-2c4e1aa/ac2-trace.json) |
| AC-3 | pass | 2/2 | rerate.spec.ts:"AC-3 withdrawn change rates on the original plan"; preview walk screenshot ac3.png |

## Findings
1. blocks AC-2 — apps/api/src/core/rating/rerate.ts:88 — the lock is taken after the read, so two
   rerates both pass the check. Evidence: trace above. Smallest fix: take the row lock in the read.
2. defect — apps/api/src/core/rating/rerate.ts:120 — a failed rerate leaves the period flagged
   "rerating" forever; the next rerate is refused. Evidence: forced error in preview, flag stays set.
3. follow-up — invoice preview double-counts prorations (pre-existing, not in this diff).

## Limitations
- Rubric-free: every criterion had a runnable artifact.
- The fail-without-change check was skipped for AC-3 (the test needs a fixture the base lacks).
```

## Routing a verdict

| Outcome | Goes to | What is forwarded | Next |
|---|---|---|---|
| pass | the writer and the coordinator | the verdict file path | evidence for `independent-review`; an engineer, or a coordinator with a `finalize` grant, marks the PR ready |
| fail with `blocks AC-n` | the same writer | the verdict file, unedited; the blocking findings are selected by contract | the writer fixes them (pinned resolving-findings skill), then asks for re-evaluation of the full new head |
| fail with only `defect` findings | the human, or the coordinator under a `dispose-findings` grant | the verdict file | only the findings they select go to the writer; the rest become follow-ups |
| `follow-up` items | the planner (through the human or coordinator) | the lines, quoted | new tasks or notes; never added to this PR silently |
| needs a decision | the human | the question and the verdict file | attention `needs-human` |

Never rewrite findings in your own words when routing them; forward the file or quote it.

## Task-record entry (for the coordinator)

```yaml
reviews:
  - { pr: "https://github.com/acme/billing/pull/240", head: 2c4e1aa, outcome: changes-requested, by: evaluator-gemini, ref: .agent/verdicts/BILL-7-2c4e1aa.md }
```

`outcome` is `pass` or `changes-requested`; `comment` only for a review that judged nothing.
