# Evals and evidence

## Problem

Instruction files, skills, hooks and policies change behavior as surely as code, and break as
silently. A skill whose description drifts starts misrouting; a rule added after one bad session
helps once and costs tokens forever. Without evals, "the agent got better" is a feeling; without
evidence, nobody remembers why a rule exists.

## Practice

Every skill ships an `evals/` folder with three files; the agent setup as a whole has a suite built the same
way.

| File | Holds | Runs |
|---|---|---|
| `routing.jsonl` | prompts that must trigger the skill, near-misses that must not (naming the skill that should) | every description change; CI on a cheap model; target 100% |
| `scenarios.md` | fixtures plus assertions on outcomes (end state, files, gates), not on step sequences | on body changes and model releases; pass^k with k ≥ 3 |
| `evidence.md` | dated entries: the real failure, what changed in the skill, the eval that now covers it | appended when a failure teaches something |

- **Start from real failures.** Seed each suite with 20–50 tasks drawn from failures you actually
  saw, then grow it. Grade outcomes, not the path taken.
- **pass^k, not pass@k.** A behavior counts when it passes every one of k trials.
- **Curated beats self-written.** An agent may draft a skill; a human curates it and the evals must
  pass before it ships. Focused skills (2–3 modules) beat comprehensive documents.
- **Smoke on PRs, full on main.** About 20 cases gate a pull request; the full suite runs on the
  default branch and on every model release.
- **Isolate trials.** Each trial starts clean; an agent must not read the previous trial's history.
- **Generalize, never paste.** A user's correction is one instance of a class; write the rule for the
  class and put the instance in `evidence.md`.

## Evidence

- 2026-02-13 · controlled · SkillsBench, 7,308 trajectories: curated skills +16.2 points;
  self-generated −1.3; focused 2–3-module skills +18.6 vs comprehensive docs −2.9; software
  engineering only +4.5; a small model with skills beat a large one without
  ([arXiv 2602.12670](https://arxiv.org/html/2602.12670v1)).
- 2026-01-09 · vendor · Anthropic: start with 20–50 tasks from real failures, grade outcomes, track
  pass^k, isolate trials; fixing grading bugs and scaffold took one benchmark from 42% to 95%
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
- 2026-09-08 · vendor · Braintrust: about a 20-case smoke suite on PRs, full suite on main, trial
  counts for non-determinism ([Braintrust](https://www.braintrust.dev/articles/llm-eval-pipeline-github-actions)).
- 2026-02-12 · controlled · context files did not improve task success and raised cost over 20%;
  write them only for non-standard practices and evaluate them ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988v1)).
- 2026-09-23 · practice · agentic-template: every skill has an `evals.md` (routing, scenarios,
  evidence); routing evals run on haiku and expect 100%, but CI runs them only when a variable is
  set; 17 of 19 skills have one evidence entry ([_SKILL-AUTHORING.md](https://github.com/xaviertorgerson/agentic-template/blob/master/.claude/skills/_SKILL-AUTHORING.md);
  [skill-evals.yml](https://github.com/xaviertorgerson/agentic-template/blob/master/.github/workflows/skill-evals.yml)).
- 2026-09-17 · practice · Skilldex evals are manual test plans with routing tables and assertions
  ([reviewing-code evals](https://github.com/QuentinTorg/skilldex/blob/main/skills/reviewing-code/evals/evals.md)).

## Contracts used

`evidence` (`evals/evidence.md` entries dated to the day or the month, `routing.jsonl` lines, and
the routing results `promptbook eval-routing --runs k --out` writes, pass^k per case, which a measured
entry cites), `skill` (`metadata.version`), `run-record` (trial outcomes); `tools/lint-skills.mjs`
checks the folder exists and parses, and keeps each description under 400 characters and the set
under 8000; `promptbook import-evals` converts an agentic-template `evals.md`.

## Anti-patterns

- A routing table that lists only prompts that should trigger.
- Scenarios asserting "the agent called tool X then Y".
- An eval suite that exists but is switched off in CI.
- A skill written by an agent from its own transcript and shipped unreviewed.
- One green run reported as passing.

## Revisit when

The suite's pass rate saturates at 100% on every model in use (raise difficulty), or an open
cross-engine eval runner makes `tools/` redundant.
