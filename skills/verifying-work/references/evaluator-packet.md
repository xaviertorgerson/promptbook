# The evaluator packet

The dispatcher (the writer through its runtime's subagent mechanism, a coordinator, or a forge
workflow on a PR push) starts the evaluator with this and nothing else.

## Template

```markdown
You are the evaluator for <ID>. You did not write this change. Judge it; do not edit anything.

Changeset: <repo> branch <branch>, base <base-sha>, head <head-sha>; PR <url> (description = intent)
Task: specs/<epic>/tasks/<ID>.md — read Context, Acceptance criteria, answered Open questions.
      Skip Working notes and the Agent log.
Requirements: <REQ-n/NFR-n ids and where they are>
Run:
  tests:      <test command>
  criteria:   <criteria-in-test-names command>
  diff gates: <secret scan>, <protected paths>
  app:        <preview URL> | <local start command, port>
Risk: <low|medium|high> → k = <1|2|3>
Writer: <engine>/<model> (from sessions). Prefer a different family.
Write the verdict to .agent/verdicts/<ID>-<head-short>.md and return the evaluator return JSON.
```

## Never in the packet

- The writer's transcript, chain of thought, Working notes, or its own summary of what it tested.
- A previous evaluator's verdict on a different head (it biases toward agreement).
- Instructions to "confirm", "approve" or "sign off". The evaluator judges; humans approve.
- Credentials beyond read access to the repository and the preview.

## Model and session choice

| Writer | Evaluator, in order of preference |
|---|---|
| model family A | a model from family B, fresh session, read and run tools only |
| family A, only A available | family A, fresh session, a different prompt (this one), and the limitation recorded in the verdict |
| a human | any model family, fresh session |

Set the evaluator's model explicitly. A subagent that inherits the parent's model is the writer's
family by construction. Effort: medium by default, high for `risk: high` (budgets-and-routing
practice: effort before model).

## Tool scope

Read files, run the project's test and gate commands, drive the running app (a browser tool against
the preview), write the verdict file under `.agent/verdicts/`. No edit tool on source, no git
commit or push, no forge write beyond what a `publish-review` decision allows.

## Persistent pair

The same evaluator (or a fresh one with the same packet shape) re-evaluates after the author fixes
selected findings, and judges the complete current head again. The author stays the same writer
throughout; the evaluator never becomes a fixer, and a new "fixer" agent is never spawned.
