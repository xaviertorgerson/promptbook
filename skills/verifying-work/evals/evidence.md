# Evidence — verifying-work

## 2026-10-13 · Routes on a 288-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill verifying-work --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 42/42; precision 100%, recall 100% over every case in the catalog. The original 811-character description, same runner and cases: 38/42, precision 97%, recall 92%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2025-10-26 · Verification is a quarter of multi-agent failures
- **Kind:** literature
- **Source:** https://arxiv.org/html/2503.13657v3
- **Claim:** MAST (1,642 traces) attributes about 23.5% of failures to verification; a high-level objective-verification step added 15.6% task success on ChatDev.
- **Result:** A separate evaluation step before human review, judged on objective artifacts.

## 2025-06-21 · Heterogeneous models beat same-model debate
- **Kind:** literature
- **Source:** https://arxiv.org/html/2502.08788v3
- **Claim:** Multi-agent debate often fails to beat self-consistency; model heterogeneity is the most reliable improvement.
- **Result:** Prefer a different model family; record when the evaluator shares the writer's family.

## 2024-03-14 · Self-correction without feedback can degrade reasoning
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2310.01798
- **Claim:** Intrinsic self-correction with no external feedback can make answers worse.
- **Result:** The evaluator runs tests and the app instead of re-reading the writer's reasoning.

## 2026-04-22 · A clean-context reviewer finds severe bugs
- **Kind:** vendor-reported
- **Source:** https://cognition.com/blog/multi-agents-working
- **Claim:** Cognition's clean-context reviewer catches about 2 bugs per PR, 58% of them severe.
- **Result:** The packet excludes the writer's transcript and Working notes.

## 2026-03-24 · An untuned evaluator talks itself into approving
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/harness-design-long-running-apps
- **Claim:** Out of the box the model was a poor QA agent that approved weak work; the evaluator judged the live app and needed several tuning rounds.
- **Result:** Per-criterion evidence is required, the running app is a first-class artifact, and the test-reality checks catch assertions that prove nothing.

## 2026-01-09 · pass^k measures consistency
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- **Claim:** pass^k requires all k trials to pass; 75% per trial is about 42% over three trials.
- **Result:** k by risk (1, 2, 3); a flaky pass is a fail.

## 2026-05-19 · A grader in its own context lifts task success
- **Kind:** vendor-reported
- **Source:** https://claude.com/blog/new-in-claude-managed-agents
- **Claim:** Managed Agents Outcomes, a grader in its own context window, reported up to a 10-point task-success gain.

## 2026-09-30 · Independent reviewer, findings to the same author, complete re-review
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/SKILL.md and assets/reviewer-startup-prompt.md at commit 48aff9a
- **Claim:** The reviewer is independent of the author, reviews the complete current changeset, never modifies source or PR state, routes only selected findings to the original author, and re-reviews the whole changeset after fixes; review counts are not approval.
- **Result:** Steps 2, 10 and the never-edit gate.

## 2026-09-23 · The template's critic is optional and verifies criteria by reading
- **Kind:** audit
- **Source:** agentic-template .claude/skills/task-next/SKILL.md (step 6) and .claude/skills/reviewer/evals.md (Evidence, 2026-09-21) at commit bbfad58
- **Claim:** The loop treats a fresh critic as ideal rather than required, and the reviewer once verified criteria by reading with no tie to a test, so unverified criteria slipped through as looking covered.
- **Result:** Evaluation is mandatory from risk medium, and the deterministic criteria-in-test-names gate runs first.
