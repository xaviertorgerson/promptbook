# Switching a task's mode

A mode change on a task past `spec-draft` is a kick-back to `spec-draft` with a reason. The workflow
gives it no new state; the task re-enters through the new mode's entry guard.

## Who may do it

The kick-back (`respec`) goes from `review` or `human-review` to `spec-draft` and is the owner's or
an engineer's. A coder that finds the spec (or its mode) wrong uses `respec-surfaced` from `review`.
The workflow has no transition from `in-progress` (or from a side state) to `spec-draft`, so an
in-progress task first moves to `review`: the author commits what it has, opens the draft PR as a
record of the attempt, and the human respecs from there. A coordinator proposes a switch; it does
not make one.

## Steps

1. The running worker commits its progress and appends a handoff to the agent log; the runtime
   stops it (a human taking the task over always wins).
2. One commit to the task file:
   - `status: spec-draft`
   - `mode: <new mode>`
   - `kickback_reason: "<old> → <new>: <why, in one sentence>"`
   - a Working notes update: what was tried, what failed, what the new mode needs first.
3. Keep the branch and its commits. A draft PR stays open as a draft or is closed by the human.
4. Meet the new mode's entry guard (a reviewed research note and plan; a fix plan; stage contracts).
5. Move to `ready` through the normal guards.

## Worked example

```yaml
# specs/rating-engine/tasks/BILL-15.md frontmatter after the switch
status: spec-draft
mode: research-plan-implement
kickback_reason: "ralph-loop → research-plan-implement: three iterations stalled on the existing ledger module's invariants; needs a research note on how postings are reversed"
```

Agent log line: `2026-10-13 owner — respec: mode ralph-loop → research-plan-implement; branch kept (feat/bill-15-ledger-adjust, 3 commits); see Working notes.`

## What never happens

- Editing `mode` on an in-progress task without the kick-back.
- Inventing a state such as "researching".
- Dropping the evaluator or a test-name guard because the new mode "doesn't need it".
- Re-running the old mode with a bigger budget instead of switching.
