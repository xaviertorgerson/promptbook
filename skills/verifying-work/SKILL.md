---
name: verifying-work
description: Use when a PR or change must be verified against its acceptance criteria by an independent evaluator — "evaluate BILL-7", "is AC-2 met on this head", "run the evaluator", "re-evaluate after the fix"; pass or fail per AC before human review. Do not use for a style review (reviewing-code).
license: MIT
compatibility: Any agent runtime with a way to start a fresh session or subagent and run the project's tests. Optional harness tools/validate.mjs (Node 22) to check the return.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Verifying work

Judge whether one changeset meets its task's acceptance criteria, from objective artifacts, as
someone who did not write it. A writer grading its own work overrates it, and a same-context critic
shares its blind spots, so the evaluator starts clean, prefers a different model family, runs things
rather than reading claims, and never fixes what it finds.

Typical asks: "evaluate BILL-7", "verify the PR against its acceptance criteria", "is AC-2 actually
met", "run the evaluator on this head", "give me a verdict per criterion", or a task at risk medium
or higher reaching review.

Hand off instead: a style or design review of a diff (reviewing-code); a security review
(reviewing-security); writing or finding missing tests, such as "cover AC-3 with a test" or "which
criteria are untested" (writing-tests); fixing what it finds (the original author, via
implementing-task).

## Inputs

The evaluator packet, and nothing more (references/evaluator-packet.md):

- The task file (`task` contract): Context, Acceptance criteria (`AC-n`, EARS), answered Open
  questions, `requirements`, `risk`, `evaluator`. Skip `## Working notes` and the Agent log: they
  are the writer's narrative.
- The changeset: repository, branch, exact base and head commits (`<base>...<head>`), the PR and
  its description (intent to check, not evidence).
- How to run it: the test command, the criteria-in-test-names check, and the running app (the PR's
  preview environment or a local start command and port).
- `risk`, which sets k.

Not inputs: the writer's transcript, its summary of what it verified, its opinion, a prior
evaluator's verdict on a different head.

## Procedure

1. **Check independence.** You did not write any commit in `<base>...<head>`. Record your engine
   and model and the writer's (from the task's `sessions` or the PR). Prefer a different model
   family; if only the same family is available, say so in the verdict as a limitation. If the
   packet contains the writer's transcript or reasoning, do not read it; note the contamination.
2. **Bind the head.** Fetch and check out the exact head in a clean checkout or worktree of your own
   (read-only for you). If the PR head moved past the packet's head, evaluate the current head and
   say so; a verdict always names the head it judged.
3. **Run the deterministic gates first**, verbatim: the project's tests, the criteria-in-test-names
   check, and the diff checks the project ships (secret scan, protected paths). A red gate is a
   finding with the output attached. Do not interpret around it.
4. **Choose an objective artifact per criterion** (references/judging-criteria.md): a test that
   carries the id and asserts the criterion's observable outcome; the running app driven through
   the criterion's trigger (preview or local); a measurement for a non-functional criterion; a
   rubric scored per criterion when nothing runnable exists. "Looks right" is not evidence.
5. **Check the tests are real.** For each criterion's test: it exists, its name carries the id, it
   asserts the EARS response (not just "no error"), it fails without the change where that is cheap
   to check, and the diff did not delete, skip or loosen an assertion. A weakened test is a failing
   finding even when the suite is green.
6. **Judge each criterion k times.** k = 1 for low risk, 2 for medium, 3 for high (references/
   judging-criteria.md). Re-run the tests k times; for app and rubric judgements, take k
   independent trials. A criterion passes only if all k trials pass; a flaky pass is a fail.
7. **Classify findings.** Each is one of: `blocks AC-n` (the criterion is unmet; evidence attached),
   `defect` (material, evidence-backed, outside the criteria), `follow-up` (tangential). Only
   findings with a realistic consequence earn a place; no style preferences (those belong to the
   pinned reviewing-code skill).
8. **Write the verdict** with references/verdict-template.md to `.agent/verdicts/<ID>-<head>.md`:
   per criterion pass or fail with evidence, the k used, gates output, findings, limitations, and
   one overall outcome: `pass` only if every criterion passed all k trials and no gate is red.
9. **Hand back** a `return` (role `evaluator`): `criteria.met` and `criteria.unmet` with reasons,
   the verdict path in `artifacts`, `verification` with each command and result, `attention`
   `complete` on pass, `working` on a fail the author can fix, `needs-human` when a verdict needs a
   decision only a human can make. Examples: references/verdict-pass.return.json,
   references/verdict-fail.return.json.
10. **Route a fail to the same author, with selected findings only.** Whoever disposes findings
    (the human, or a coordinator under a `dispose-findings` grant and its policy) selects which
    finding numbers the author fixes now. `blocks AC-n` findings are the default selection, since
    the task cannot reach `human-review` with a criterion unmet, unless the human chooses to
    re-spec that criterion instead. Forward the verdict file unedited plus the selection list,
    never a paraphrase; the original writer (the persistent pair, not a new fixer) acts only on the
    selected numbers. After fixes, evaluate the complete current head again.

## Outputs

- A verdict file per evaluated head (references/verdict-template.md).
- A `return` JSON (contract `return`, role `evaluator`). If `harness validate` is available, run
  `node tools/validate.mjs --contract return <file>`.
- For the coordinator: a `reviews[]` entry for the task record (`pr`, `head`, `role: evaluator`,
  `outcome` `pass` or `fail`, `by`, `ref` to the verdict). On risk medium or high, a `pass` on the
  current head is what the workflow guard `independent-verification` requires before
  `mark-pr-ready`. The writer adds the agent-log line; the runner
  records the run. The evaluator writes neither the task file nor the code.

## Gates and stop conditions

- **Never edit** source, tests, the task file, the PR's state or description. Never approve, merge,
  or mark ready. Never post a review on someone else's PR without a `publish-review` decision.
- A pass is evidence for the `independent-verification` guard (`mark-pr-ready`) and the
  `independent-review` guard (a grant's `approve-pr`), not approval; review counts are not approval.
  A changed head voids the verdict.
- Hand to a human (`needs-human` with a question): a criterion that cannot be judged without a
  product decision (ambiguous or contradictory); the preview or test infrastructure is down for
  reasons outside the change; the packet's head and the PR disagree and you cannot tell which is
  intended; the same criterion failed on two consecutive heads (report both verdicts); you are
  asked to fix, approve or merge.

## References

- references/evaluator-packet.md — what the dispatcher sends, what it must not, model choice.
- references/judging-criteria.md — artifacts per criterion kind, the test-reality checks, k by risk.
- references/verdict-template.md — the verdict file, the finding classes, the routing table.
- references/verdict-pass.return.json, references/verdict-fail.return.json — evaluator returns.
- references/engine-notes.md — how runtimes start a clean evaluator on a different model.
