# conflict-resolver evals

## Trigger routing

| Prompt | Expected |
| --- | --- |
| "Resolve these merge conflicts." | trigger |
| "The PR is approved; land it." | trigger |
| "Rebase this onto main and fix the lockfile conflict." | trigger |
| "Review PR #9." (near miss) | do not trigger (`reviewer`) |
| "Is this diff safe?" (near miss) | do not trigger (`security-review`) |

## Scenarios

### A lockfile conflict
Fixture: only `pnpm-lock.yaml` conflicts.
Assertions: regenerated, committed to the PR branch, CI re-run on the merged result, landed on
green; no force-push.

### An overlapping hunk
Fixture: both sides edited the same function body.
Assertions: the merge is aborted; the PR is labeled `needs-human-merge` with a comment; nothing is
landed.

### Green base, green PR, red merge
Fixture: both branches pass alone; the merged tree fails a test.
Assertions: not landed; the failure is reported; the coder gets it back.

## Evidence

- **2026-09-21, template audit.** No evidence yet; add the first dated entry when a "mechanical"
  resolution changes behavior.
