# Thin assignments

A worker gets an objective and boundaries, not orchestration machinery. Keep each assignment to
what is below. Never include grants, task records, watch ids, wake instructions, this skill, or
private configuration. Prefix every message you send with your role and the task id, and mark
relayed human words as the human's.

## Author

```
[orchestrator · {task_id}] Implement {task_id} ({task_file}) in {worktree}, branch {branch},
based on {base_commit}. Guiding docs: {guiding_docs}. Constraints and non-goals: {constraints}.
Budget for this run: {max_turns} turns, ${max_usd}.

Plan: {approval_path}
  - default: propose your plan to the human in this session and wait for approval before editing;
  - research-plan-implement: implement the approved plan in the task's Working notes;
  - under a grant with approve-plan: propose the plan to the coordinator, or implement {approved_plan}.

Claim the task by creating {branch} on the remote: its first commit sets owner and status
in-progress, pushed as a new ref, never to the default branch (a rejected push, or a branch that
already exists, means someone else has it: stop and say so). Every later status change is a commit
on {branch}. Implement against the acceptance criteria, verify, open
a draft PR, append your handoff to the agent log with your session id. Do not start other agents.
Hand back: a return object (summary, artifacts, attention, decisions_needed, criteria met/unmet,
verification). If you hit a decision the spec does not answer, stop and ask; do not guess.
```

## Evaluator

```
[orchestrator · {task_id}] Evaluate {pr} at head {head} against base {base} in {worktree}.
Intent: the task's acceptance criteria ({task_file}), the PR description and linked requirements.
Judge objective artifacts: run {evaluator_refs}; check every AC id is named in a test.
Report material, evidence-backed findings with locations to {findings_path}, and your verdict for
this head (pass or fail). Separate tangential follow-ups. Do not edit source, push,
approve, or publish. Do not start other agents. Hand back a return with the findings path as an artifact.
```

Give the evaluator intent and changeset only, never the author's transcript.

## Reader (search, research, one review lens)

```
[orchestrator · {task_id}] Read-only: {question}. Scope: {paths}. Write your full findings to
{findings_path} as `path:line — why it matters`, most relevant first. Do not edit tracked files or
start other agents. Hand back a return whose summary answers in a few sentences and whose artifacts
list the findings file.
```

## Routing findings back to the author

Forward the evaluator's findings file path (or quote the selected findings verbatim) with the
selection: which findings to fix now and which are follow-ups. The selection is the human's, or
yours only under a live grant with `dispose-findings`, applying its `policy`. Never rewrite a
finding in your own words.
