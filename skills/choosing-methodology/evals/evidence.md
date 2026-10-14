# Evidence — choosing-methodology

## 2026-10-13 · Routes on a 300-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill choosing-methodology --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 38/39; precision 91%, recall 100% over every case in the catalog. The original 854-character description, same runner and cases: 39/39, precision 100%, recall 100%.
- **Result:** Misses: "What research methodology should my survey study use?" 1/3 (got choosing-methodology).
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2025-10-15 · Spec-driven tools burden small changes
- **Kind:** literature
- **Source:** https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- **Claim:** Böckeler found spec-driven tools produced verbose output and heavy review, expanded a small bug into many stories and criteria, and agents still ignored specs.
- **Result:** spec-driven stays the default but enters at the lightest depth for XS–S work.

## 2025-08-01 · Research-plan-implement needs an expert reviewer (page undated, about August 2025)
- **Kind:** vendor-reported
- **Source:** https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md
- **Claim:** HumanLayer (self-reported) fixed a bug in a 300k-line Rust codebase approved the next day, failed a seven-hour dependency removal after shallow research, and needs an expert human with context kept at 40–60%.
- **Result:** research-plan-implement for brownfield and high-risk work, with a human approving research and plan; degraded when no expert is available.
- **Revisit:** when a controlled comparison of planning depth appears

## 2025-07-14 · Ralph is not for existing codebases
- **Kind:** vendor-reported
- **Source:** https://ghuntley.com/ralph/
- **Claim:** The Ralph loop's author (self-reported) names nondeterminism as its weakness and would not use it in an existing code base.
- **Result:** ralph-loop only for greenfield, low-risk, reversible work with strong backpressure and caps.

## 2026-03-17 · ICM evidence is self-reported and favors content work
- **Kind:** literature
- **Source:** https://arxiv.org/html/2603.16021
- **Claim:** ICM's evidence comes from a 52-member invite-only community on one model family, mostly content work, with no controlled comparison; frameworks keep the edge on concurrency and automated branching.
- **Result:** icm-pipeline for sequential, human-reviewed content pipelines only; branching or concurrent pipelines use spec-driven tasks.

## 2025-07-14 · Focused context beats long context
- **Kind:** literature
- **Source:** https://www.trychroma.com/research/context-rot
- **Claim:** Chroma (vendor-run) found model performance falls with input length and distractors, on the same task.
- **Result:** The shared premise of all four modes: each loads only its own skills and the task's inputs.

## 2026-02-12 · Instructions help; overviews do not
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2602.11988v1
- **Claim:** Repository context files generally did not improve task success and raised cost by over 20%; agents follow specific instructions.
- **Result:** A mode loads task-specific skills and stage contracts, not general overviews.

## 2026-10-13 · The harness defines modes as guards over one workflow
- **Kind:** observed
- **Source:** harness playbook/methodology/modes.md and state-machines/workflow.yaml (commit 9dfd497)
- **Claim:** A mode chooses skills and adds guards to transitions; it never adds states or removes an invariant; a mid-flight change is a kick-back to spec-draft with a reason.
- **Result:** The skill implements that page; switching follows the workflow's respec transitions.

## 2026-09-23 · The template already names loop shapes per task
- **Kind:** observed
- **Source:** agentic-template LOOPING.md "Loop shapes" (commit bbfad58)
- **Claim:** The loop chooses a shape per task (retry, plan-execute-verify, explore-and-narrow) with human-in-the-loop as a modifier, never a fourth shape, and documents the choice.
- **Result:** Mode is chosen per epic with per-task overrides and a recorded rationale; human checkpoints are guards, not modes.
