# Verification

## Problem

An agent grading its own work overrates it. Same-model critique in the same context shares the same
blind spots, and self-correction without external feedback can make reasoning worse. A swarm with a
weak verifier just produces wrong work faster. One lucky pass hides a flaky success rate.

## Practice

- **A separate evaluator, every task.** Before `human-review`, a fresh evaluator judges the change.
  It is mandatory for `risk: medium` and above and the default for everything else.
- **Clean context.** The evaluator starts with the intent (task criteria, PR description, linked
  requirements) and the changeset, not the writer's conversation.
- **Different where possible.** Prefer a different model family from the writer; at minimum a
  different session with a different prompt.
- **An objective artifact.** The evaluator judges something it can run or check: tests whose names
  carry the AC ids, the running app in the PR preview, a rubric scored per criterion. "Looks right"
  is not a verdict.
- **Findings go back to the writer.** The evaluator reports material, evidence-backed findings and
  never edits. The writer resolves the selected ones; changed code needs re-evaluation of the full
  current head. Review counts are not approval.
- **Measure consistency, not luck.** For evals of the harness itself, track pass^k (all k trials pass),
  not pass@k. 75% per trial is about 42% over three.
- **Record the verdict** in the run record and the task's agent log.

## Evidence

- 2025-10-26 · controlled · MAST (1,642 traces): about 23.5% of failures were verification; adding a
  high-level objective-verification step gave +15.6% on ChatDev ([arXiv 2503.13657](https://arxiv.org/html/2503.13657v3)).
- 2025-06-21 · controlled · multi-agent debate often fails to beat self-consistency; model
  heterogeneity is the "universal antidote" ([arXiv 2502.08788](https://arxiv.org/html/2502.08788v3)).
- 2024 · controlled · intrinsic self-correction without feedback can degrade reasoning
  ([Huang et al.](https://arxiv.org/abs/2310.01798)).
- 2026-05-19 · vendor · Managed Agents "Outcomes", a grader in its own context, reported up to a
  10-point task-success gain ([Claude blog](https://claude.com/blog/new-in-claude-managed-agents)).
- 2026-04-22 · vendor · Cognition's clean-context reviewer catches about 2 bugs per PR, 58% severe
  ([Cognition](https://cognition.com/blog/multi-agents-working)).
- 2026-03-24 · vendor · out of the box, Claude was a "poor QA agent" that talked itself into approving;
  the evaluator needed several tuning rounds ([Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
- 2026-01-09 · vendor · pass^k: 75% per trial is about 42% over three trials
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
- 2026-05-12 · vendor · Google ADK: "golden evaluations" in CI pre-seed state to catch skipped steps
  ([Google](https://developers.googleblog.com/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/)).
- 2026-09-23 · practice · agentic-template's local loop treats a fresh critic as "ideal", not required;
  stagehand makes the independent reviewer mandatory ([task-next](https://github.com/xaviertorgerson/agentic-template/blob/master/.claude/skills/task-next/SKILL.md);
  [stagehand](https://github.com/QuentinTorg/stagehand/blob/main/skills/orchestrating-development/SKILL.md)).

## Contracts used

`task` (`evaluator`, `risk`, `AC-n`), `return` (criteria met/unmet, findings), `run-record`
(verdict), `state-machines/workflow.yaml` (`review` → `human-review` requires a verdict).

## Anti-patterns

- The writer's "self-review" counted as the evaluation.
- An evaluator handed the writer's transcript and asked to agree.
- A green CI treated as proof of the criteria.
- The evaluator fixing what it finds.
- A flaky eval reported as its best run.

## Revisit when

An evaluator's false-approval rate is measured below the human's on the project's own failures, or a
model release makes same-family review measurably as good as cross-family.
