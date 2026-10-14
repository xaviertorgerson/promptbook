# Evidence — delegating-authority

## 2026-10-13 · Routes on a 295-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill delegating-authority --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 42/42; precision 81%, recall 100% over every case in the catalog. The original 825-character description, same runner and cases: 42/42, precision 81%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-30 · Generalized from stagehand's project delegation
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/references/project-delegation.md and SKILL.md "Authority and scope" at commit 48aff9a
- **Claim:** Delegation names the outcome, the decisions transferred, repositories and targets, concurrency and resource limits, and stopping conditions; finalization, publication and merge are separate grants; merge authority names repositories, target branches, strategy and required evidence; grants may be narrowed or revoked and are not renewed from a saved summary.
- **Result:** Kept every rule. Added a mandatory expiry, a structured file per grant (`grant` contract), an explicit check run before each action, and the never-delegable list.

## 2026-09-30 · stagehand's acceptance scenarios for delegation
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/evals/evals.md ("Explicit project delegation") at commit 48aff9a
- **Claim:** Milestone delivery with at most four workers and reserved finalization and merging; a separate merge grant for one repository's integration branch that leaves other repositories and main untouched; a vague "build everything" grants neither merging nor unlimited concurrency.
- **Result:** The two worked examples and scenarios S1, S2 and S4 port these cases.

## 2026-07-24 · The merge gate is delegated last, if ever
- **Kind:** observed
- **Source:** agentic-template DECISIONS.md ADR-0002 and docs/roles.md (commit bbfad58)
- **Claim:** Humans own the three gates (spec, PR, production release); only the post-approval merge agent touches the protected branch; human roles are interfaces a coordinator may later assume, deferred until a trigger fires.
- **Result:** Spec approval and production release are never grantable; merge is grantable only per repository, exact target and strategy, with independent review and required checks.

## 2026-10-13 · Asks are not protection in unattended runs
- **Kind:** measured
- **Source:** agentic-template DECISIONS.md ADR-0021 (branch docs/adr-permission-precedence, commit c177fa1), Claude Code 2.1.296, about 100 headless runs
- **Claim:** A hook or rule ask is a denial in every headless mode; only deny rules and hook denies hold under a personal bypass default.
- **Result:** Answering a permission prompt is never delegable; a denial is reported as a question for a human.
- **Engine:** claude

## 2026-04-15 · Every agent action traceable to an authorizing human
- **Kind:** vendor-reported
- **Source:** https://devblogs.microsoft.com/all-things-azure/agentic-devops-practices-principles-strategic-direction/
- **Claim:** Agentic DevOps should trace every agent action back to an authorizing human.
- **Result:** Every grant records `granted_by` and `source`; every use is recorded with the grant id.

## 2026-02-11 · Minimal merge gates are irresponsible at low throughput
- **Kind:** vendor-reported
- **Source:** https://openai.com/index/harness-engineering/
- **Claim:** OpenAI auto-merged small refactor PRs with minimal gates and said that would be irresponsible in a low-throughput environment.
- **Result:** Merge grants stay narrow, expiring and backed by review and checks.
