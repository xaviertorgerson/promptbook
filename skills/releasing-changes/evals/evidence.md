# Evidence — releasing-changes

## 2026-10-13 · Routes on a 277-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill releasing-changes --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 96%, recall 100% over every case in the catalog. The original 959-character description, same runner and cases: 33/33, precision 77%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · One image promoted by digest through four stages
- **Kind:** observed
- **Source:** agentic-template docs/ci-cd.md and DECISIONS.md ADR-0018 at commit bbfad58
- **Claim:** CI builds one image per merge; the train promotes the same digest dev, QA, UAT, production, checking hold, CI, probe dwell, error rate and smoke each as its own step, never retrying; canary-watch rolls back on its own; production needs the protected environment's reviewer.
- **Result:** Steps 1, 3, 6 and 7, and the gate table.

## 2026-09-23 · No agent deploys to production
- **Kind:** observed
- **Source:** agentic-template docs/roles.md at commit bbfad58
- **Claim:** The capability matrix forbids every agent role from deploying to production; the train deploys to production only after the owner approves the environment.
- **Result:** The production gate is human; the skill prepares the request only.

## 2026-09-23 · Expand, migrate, contract
- **Kind:** observed
- **Source:** agentic-template .claude/skills/migration-safety/SKILL.md at commit bbfad58
- **Claim:** Live schema changes go expand, migrate data, contract across three PRs; a DROP needs an ADR; every PR's migrations run against a clone in CI.
- **Result:** references/migrations.md, stack specifics removed.

## 2026-03-24 · The evaluator judged the live app
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/harness-design-long-running-apps
- **Claim:** Anthropic's evaluator drove the running app to judge the work, not the code alone.
- **Result:** A preview per PR exists so verifying-work can run the change.

## 2025-06-13 · Rainbow deployments for long-running agents
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/multi-agent-research-system
- **Claim:** Anthropic shifted traffic gradually between versions so in-flight agents were not broken.
- **Result:** Traffic steps during production rollout.

## 2026-09-30 · Flags ship disabled and roll back automatically
- **Kind:** vendor-reported
- **Source:** https://github.com/growthbook/skills
- **Claim:** GrowthBook's flag workflows create new flags disabled everywhere and guard rollouts with automatic rollback.
- **Result:** references/flags.md.

## 2026-03-25 · Auto mode is no replacement for review on high-stakes infrastructure
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/claude-code-auto-mode
- **Claim:** Auto mode is not a drop-in replacement for careful human review on high-stakes infrastructure.
- **Result:** The production release remains a human gate.
