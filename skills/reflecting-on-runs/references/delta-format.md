# Deltas

A delta is one operation on one item in one file. A curator (deterministic tooling or a person)
applies it; the reflector never edits the file wholesale.

## The delta table (one row per delta, in the pull request description)

| Field | Content |
|---|---|
| target | repository path of the one file (`skills/<name>/SKILL.md`, `AGENTS.md`, `knowledge/<topic>.md`, `skills/<name>/evals/routing.jsonl`) |
| op | `add`, `modify` or `remove` |
| anchor | the section heading and the existing line (for modify and remove) or the line after which to add |
| before | the exact current text (modify, remove) |
| after | the exact new text (add, modify) |
| class | the failure class this generalizes (one line) |
| evidence | the signals: run ids, verdict paths, PR comment links, commits; at least one human-authored or deterministic |
| recurrence | how many times the class was seen in the window and before it |
| eval | the routing case, scenario or test that will fail if the lesson regresses |
| risk | `low` (wording, a case), `medium` (a step in a procedure), `high` (anything near a gate or wall) |

## Pull request template

```markdown
fix(skills): <target-name>, <the class in a few words>

Window: <from> → <to>. Inputs: <n> run records, <n> verdicts, <n> review threads.

| op | anchor | before | after |
|---|---|---|---|
| modify | Procedure, step 4 | "Run the tests." | "Run the tests whose names carry the task's AC ids; report each as met or unmet." |

Class: verification skipped the criteria the task named.
Evidence: run 9a1d2c8e (stalled, BILL-8), review finding on PR #42 accepted by the owner, verdict
.agent/verdicts/BILL-8.json (AC-3 unmet).
Recurrence: 3 in this window, 1 before (evidence.md 2026-09-30).
Eval: scenario S4 in skills/implementing-task/evals/scenarios.md.
Risk: medium.

Not auto-merged. A human merges or closes this.
```

## Worked example: three signals, one delta

- run A: `outcome: stalled`, reason "AC-2 has no test"; run B: evaluator verdict "AC-2 unmet: no test
  name contains AC-2"; review on PR #51: "you tested AC-1 twice and AC-2 never".
- Class: criteria are verified by count, not by id.
- Search: the testing skill already says "name tests by criterion id"; its evidence log has one entry
  for this class. This is a recurrence.
- Form: the rule exists; the failure is that nothing checks it. Propose (do not write) a gate: the
  criterion-coverage check runs before `review`. Meanwhile, add one scenario to the testing skill that
  fails when an AC id has no test, and append an `incident` evidence entry.
- Output: one PR adding the scenario and evidence entry; the gate proposal goes into the report as
  `needs-human` because it changes a gate.

## Rejected deltas

List each in the report with the guard that rejected it: "drop: drift (only the agent's own summary
said the step was confusing)".
