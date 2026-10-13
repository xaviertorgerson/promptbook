---
name: implementing-task
description: Use when a ready task file (BILL-12, TMIG-3) is claimed from the queue and built — "do the next task", "take BILL-12", "keep going"; work in its worktree, make design choices inside it, fix evaluator findings, take it to review. Do not use for diagnosis (debugging-failures).
license: MIT
compatibility: Any agent runtime that reads Agent Skills and can run git. Optional harness tools/validate.mjs (Node 22) to check the task file and the return.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Implementing a task

Take one `ready` task from claim to a draft PR at `review`, as its only writer. Every step leaves
durable state in git (task file, commits, PR), so a crash or a fresh session resumes from the files,
never from a transcript. The acceptance criteria are the stopping condition.

Typical asks: "do the next task", "take BILL-12", "implement this task", "keep going", "pick up the
ready task and build it", or a loop or dispatcher handing one ready task to a fresh session.

Hand off instead: choosing or ordering work across many tasks (orchestrating-work); a worktree on
its own (managing-worktrees); judging a change you did not write (verifying-work); a flaky or
failing test (debugging-failures); a test-only ask such as "cover AC-3 with a test" (writing-tests);
merging (landing-changes).

## Inputs

- The task file `specs/<epic>/tasks/<ID>.md` (`task` contract). Frontmatter: `status`, `owner`,
  `branch`, `depends_on`, `guiding_docs`, `requirements`, `touches`, `inputs`, `risk`, `evaluator`,
  `budget`, `mode`. Body: Context, Acceptance criteria (EARS, ids `AC-n`), Open questions, Agent log.
- The files in `guiding_docs` and the project's instruction file (its commands table). Nothing else
  unprompted: not other tasks, not deferred-idea files, not unlisted chapters.
- The dispatch: a task id, or none. With none, take the highest-priority `ready` task whose
  `depends_on` are all `merged` and whose `owner` is null. That pick is mechanical; reordering,
  choosing between equals on judgement, or adding work belongs to orchestrating-work.
- The run's caps from the dispatcher (turns, spend) and the task's `budget`. The lower one wins.

## Procedure

1. **Orient.** Read the instruction file, the task, its `guiding_docs`. If nothing is dispatchable,
   report "no ready task", name what each `ready` task waits on, and stop. Never claim a
   `spec-draft` task, never edit `depends_on`, never invent work.
2. **Check it is claimable now.** `status: ready`; `owner: null` (or you are the human who took it
   over); every `depends_on` merged; no unchecked Open question marked blocking; every `inputs`
   entry present (a named secret, service or decision you cannot see is a stop, step 12). If
   `risk` is `high` or `irreversible: true` and no human is supervising this run, do not claim it:
   hand back `needs-human` with the reason.
3. **Fetch and record the base.** Fetch the target base (the default branch, or the integration
   branch the grant names) and record its exact commit. Create the task's worktree on `branch` from
   that commit with managing-worktrees (minimum recipe in references/claim-and-handback.md). Run the
   project's smoke check; start from green or stop.
4. **Claim by compare-and-swap.** In one commit, set `owner: <your identity>` and
   `status: ready → in-progress` (transition `claim`), plus an agent-log line naming the base commit.
   Push the task branch without force. The branch name is unique to the task, so the push is the
   swap: if it is rejected, or the branch already exists on the remote, someone else holds the task.
   Remove your empty worktree, re-fetch, and go back to step 1 for the next one.
5. **Write the living plan.** Add or rewrite `## Working notes` in the task file: the plan as steps
   mapped to `AC-n`, decisions taken inside the task's scope, what changed and why, what is next.
   Rewrite it as you go; it is the plan, not a diary (the agent log is the append-only part). If
   the task cannot be finished within its budget in one session, stop and propose a split
   (step 12) rather than half-doing it.
6. **Implement against the criteria only.** Every edit serves an `AC-n`. Stay inside `touches`; a
   needed edit outside it goes in Working notes, and one that overlaps another task's lane is a
   stop. Discovered follow-ups go in Working notes as notes for the planner, not into this branch.
   Never edit the project's walls (hooks, permission rules, CI workflows, owner files) to get green.
7. **Test each criterion.** Follow writing-tests: every `AC-n` has a test whose name carries the id
   and reads like its neighbours in that file. Never delete, skip or loosen a test or assertion to
   pass. A criterion you cannot name a test for is a spec problem (step 12).
8. **Self-check.** Run the project's gates (lint, types, tests, the criteria-in-test-names check)
   and read your diff against each `AC-n`. Fix until green. This is the writer's check; it is not
   the evaluation.
9. **Commit and publish the draft.** Small Conventional Commits with the why in the body, no AI
   attribution, pushed to the task branch after each. Open a draft PR (PR text: the pinned
   preparing-pull-requests skill, draft mode). Set `status: in-progress → review` (transition
   `open-draft`, guard: the draft PR exists) with an agent-log line. Update Working notes.
10. **Get the independent evaluation.** Mandatory when `risk` is `medium` or `high`: the workflow
    guard `independent-verification` holds `mark-pr-ready` until an evaluator that did not write the
    change records a pass on the current head. The default otherwise. Request verifying-work with
    only the evaluator packet (task criteria, diff ref `<base>...<head>`, how to run the tests and
    the PR preview), never your transcript or Working notes. Without a subagent mechanism, end the
    run at `review` and hand back `attention: working` with "evaluation due on <head>" in the
    summary; the dispatcher starts the evaluator. A failing verdict comes back to you with a
    selection list (by the human, or under a `dispose-findings` grant's policy; unmet criteria are
    selected by default): fix only the selected findings with the pinned resolving-findings skill,
    push, and ask for re-evaluation of the full current head. Stay at `review` while you iterate;
    use `iterate` (back to `in-progress`) only when the approach itself must change.
11. **Hand back.** Append one entry to the task's `sessions` (`engine`, `session_id`, `actor`,
    `role: coder`, `started_at`, `ended_at`, `outcome`, `run`) and one agent-log line (done, left,
    uncertain, status, session id). Commit and push. Write the `return` JSON to
    `.agent/returns/<ID>-<session>.json` or the runtime's structured output. Never write the
    run-record; the runner appends it.
12. **Stop instead of guessing.** On any condition in references/stop-conditions.md: commit what is
    green, write the question or blocker where the table says, make the side-state transition, and
    hand back `needs-human` with a specific question in `decisions_needed`.

## Outputs

- Task file: `owner`, `status` (`in-progress`, then `review`, or a side state), `## Working notes`,
  agent-log lines, a `sessions` entry. Committed on the task branch.
- Commits and a draft PR on the task branch; the worktree and its derived resources.
- A `return` (contract `return`): `task`, `role: coder`, `summary` (≤ 8,000 characters),
  `artifacts`, `attention`, `decisions_needed`, `criteria` (`met`, `unmet` with reasons),
  `verification`, `session`. `complete` only when every criterion is met and the evaluation (when
  required) passed on the current head. Worked examples: references/handback-review.return.json,
  references/handback-needs-input.return.json. If `harness validate` is available, run
  `node tools/validate.mjs --contract return <file>`.

## Gates and stop conditions

- **Your last transition is `review`.** Never set `human-review`, `merging` or `merged`. Marking the
  PR ready (`mark-pr-ready`) happens after a passing verdict on the current head (guard
  `independent-verification` from risk medium), by an engineer or by a coordinator holding a live
  `finalize` grant. Landing is landing-changes.
- Never push to the default or integration branch, never force-push, never approve or merge your
  own PR, never answer a permission prompt. A permission denial is a question for a human.
- A human who sets `owner` to themselves, or moves `status` (suspend, kick back), wins: commit,
  write the handoff line, and yield.
- Hand to a human (`needs-human`): a decision the spec does not make; a missing secret, service or
  decision input; a criterion that is contradictory or untestable; a red gate you cannot fix
  without weakening a test; the same failure twice with no progress; a turn or spend cap near;
  `risk: high` unsupervised; a verdict that fails twice on the same criterion.

## References

- references/claim-and-handback.md — the claim commit and push, a minimal worktree recipe, the
  Working notes template, the agent-log line, the `sessions` entry, the evaluator packet.
- references/stop-conditions.md — each stop: the workflow transition, who may make it, what to
  write, the return's attention.
- references/handback-review.return.json — a `complete` return at `review` after a passing evaluation.
- references/handback-needs-input.return.json — a `needs-human` return with a blocking question.
- references/task-at-review.task.md — a task file at `review` with Working notes, a `sessions`
  entry and the agent log (validates against the `task` contract).
- references/engine-notes.md — how runtimes provide worktrees, subagents and structured returns.
