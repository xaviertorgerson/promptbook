# Evidence — landing-changes

## 2026-10-13 · Routes on a 288-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill landing-changes --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 72%, recall 100% over every case in the catalog. The original 952-character description, same runner and cases: 33/33, precision 72%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Ported from agentic-template conflict-resolver and the merge agent
- **Kind:** observed
- **Source:** agentic-template .claude/skills/conflict-resolver/SKILL.md, evals.md, scripts/conflict-classify.mjs and docs/concurrency.md at commit bbfad58
- **Claim:** Only the merge agent lands on the protected branch, after human approval, auto-resolving mechanical conflicts only (lockfiles regenerated, generated files regenerated, one-sided or identical hunks), re-running CI on the merged result, labelling semantic conflicts for a human, serialized one land at a time.
- **Result:** Kept as tier 1 and the conflict table; dropped pnpm, the board script and the forge shim names.

## 2026-10-13 · The classifier calls a delete-versus-modify conflict mechanical
- **Kind:** measured
- **Source:** agentic-template scripts/conflict-classify.mjs at commit bbfad58, run on two scratch merges with git 2.43.0 (default and diff3 styles), recorded in references/conflict-classes.md
- **Claim:** A hunk where one side deleted a line and the other changed it, and a hunk where one side deleted a line and the other inserted next to it, were both reported "all hunks one-sided or identical", so "take the present side" would undo the deletion.
- **Result:** Row 7: an empty side over a non-empty base is semantic; merges use diff3 style.

## 2026-09-30 · Merge authority is a separate, scoped grant
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/references/project-delegation.md and SKILL.md at commit 48aff9a
- **Claim:** Finalization, review publication and merging are separate grants; merge authority names repositories, target branches, strategy and required evidence; only the coordinator exercises it through forge PRs after a current-head independent review; it checks the actual base and head and records the result; refreshing a PR branch by merging its base is not landing; force-with-lease only for authorized feature-branch rewrites.
- **Result:** Tier 2, the grant check and the refresh rule.

## 2026-09-23 · Agents are not code owners; one push-capable merge token
- **Kind:** observed
- **Source:** agentic-template docs/roles.md at commit bbfad58
- **Claim:** Branch protection, required code-owner review with agents excluded, and a single merge-capable credential on a trusted runner make the human gate real; prose alone does not.
- **Result:** The forge controls table in references/authority-tiers.md.

## 2026-10-13 · A merge queue tests each PR on the latest base plus the PRs ahead
- **Kind:** vendor-reported
- **Source:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- **Claim:** Queued PRs are tested with the changes ahead of them; a failing PR is removed from the queue; workflows must run on the merge_group event for required checks to report.
- **Result:** Step 8 lands through the queue where one exists.

## 2026-04-15 · Every agent action traces back to an authorizing human
- **Kind:** vendor-reported
- **Source:** https://devblogs.microsoft.com/all-things-azure/agentic-devops-practices-principles-strategic-direction/
- **Claim:** Microsoft's agentic DevOps principles call for every agent action to trace to an authorizing human.
- **Result:** The land record cites the approval or the grant and its source.

## 2026-02-11 · Minimal-gate auto-merge was called irresponsible
- **Kind:** vendor-reported
- **Source:** https://openai.com/index/harness-engineering/
- **Claim:** OpenAI auto-merged small refactor PRs with minimal gates and described that as irresponsible outside its low-throughput setting.
- **Result:** No auto-merge on the protected branch; the human merges integration into it.
