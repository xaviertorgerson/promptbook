# Evidence — evaluating-skills

## 2026-01-09 · Seed evals from real failures and track pass^k
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- **Claim:** Anthropic's own guidance: start with 20–50 tasks from real failures, grade outcomes rather than step sequences, isolate trials, and track pass^k (75% per trial is about 42% over three); fixing grading bugs and scaffold took one benchmark from 42% to 95%.
- **Result:** Scenarios grade end state, trials are isolated, k is chosen by risk, and results are reported as n/k.
- **Revisit:** when a model release makes pass^k at k=3 saturate on every scenario

## 2026-02-13 · Curated skills help; self-written skills do not
- **Kind:** literature
- **Source:** https://arxiv.org/html/2602.12670v1
- **Claim:** SkillsBench (7,308 trajectories): curated skills +16.2 points, self-generated −1.3; focused 2–3-module skills +18.6 vs comprehensive docs −2.9; a small model with skills beat a large one without.
- **Result:** Cases and skills an agent drafted count only after human review; routing is graded on the cheapest model.
- **Revisit:** when a controlled study shows self-generated skills helping without review

## 2026-09-08 · Smoke on pull requests, full suite on main
- **Kind:** vendor-reported
- **Source:** https://www.braintrust.dev/articles/llm-eval-pipeline-github-actions
- **Claim:** Braintrust's pattern: about 20 cases gate a pull request, the full suite runs on the default branch, with trial counts for non-determinism.
- **Result:** The where-it-runs table in references/routing-runner.md.

## 2026-09-23 · Routing evals exist but are switched off by default
- **Kind:** observed
- **Source:** agentic-template .github/workflows/skill-evals.yml and scripts/skill-evals.mjs @ bbfad58
- **Claim:** Routing evals run on the cheapest model with only names and descriptions and expect 100%, but CI runs them only when a repository variable is set; 17 of 19 skills have exactly one evidence entry.
- **Result:** The router prompt is reused verbatim; the skill says a suite switched off in CI is not a gate and names the missing secret as the blocker.
- **Revisit:** when the template turns the job on by default

## 2026-10-13 · Template routing tables are small and name the neighbour only in prose
- **Kind:** audit
- **Source:** agentic-template .claude/skills/*/evals.md @ bbfad58
- **Claim:** The 19 template routing tables hold 3–4 trigger rows and 2–3 do-not-trigger rows each; the neighbour sits in prose a runner cannot check, and no table separates unrelated prompts from near-misses.
- **Result:** The minimums are 4 positive, 3 near-miss with route_to, 2 negative, as JSONL the validator checks.

## 2026-10-13 · First routing run of the 33-skill catalog on the cheap model
- **Kind:** measured
- **Source:** the router prompt in references/routing-runner.md, sent through the engine's headless mode, 3 runs per case; catalog = the 8 learning and port skills (branch feat/skills-learning) + 20 sibling skills from the feat/skills-{planning,execution,runtime} worktrees as written on 2026-10-13 + 5 pinned Skilldex skills
- **Claim:** Against stand-in neighbour descriptions the 8 skills passed 94/95; against the real, longer sibling descriptions the first full run passed 272/285 and moved to 266–282/285 across description edits. The cheap router ignored "Do not use for" clauses whenever trigger words overlapped, and answered none on about 9% of clear positives in one run.
- **Result:** Three-run repeats stay mandatory; a new results row and runner notes say to lead with the deciding feature and to iterate on failing prompts before a full run. Final run 282/285; the residual failures are recorded in the affected skills' evidence.
- **Engine:** claude
- **Model:** haiku
- **Skill version:** 0.1.0
- **Revisit:** when the sibling skills merge and the catalog is final
