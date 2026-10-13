# Evidence — reviewing-harness

## 2026-10-13 · Routes on a 267-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill reviewing-harness --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 94%, recall 100% over every case in the catalog. The original 731-character description, same runner and cases: 33/33, precision 97%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-02-12 · Context files did not improve task success and raised cost
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2602.11988v1
- **Claim:** Repository-level context files did not improve coding-agent success and raised cost by over 20%; the authors recommend them only for non-standard practices, evaluated.
- **Result:** Instruction blocks and rule sections are ablation candidates like any other component.

## 2026-03-24 · Re-examine the harness with each new model; remove what isn't load-bearing
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/harness-design-long-running-apps
- **Claim:** Anthropic's harness post treats each component as an assumption about what the model cannot do alone, and removed sprints and context resets for a newer model.
- **Result:** Steps 3–7; loop shapes (resets, sprint splits) are listed as candidates.

## 2026-04-08 · Coordination returns diminish once the single agent is strong
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2512.08296
- **Claim:** The scaling study reports "capability saturation" for multi-agent coordination when the single-agent baseline is strong.
- **Result:** Subagents and extra review rounds are re-tested on each release rather than kept by default.

## 2026-10-12 · Sweep effort on the strong model alone first
- **Kind:** vendor-reported
- **Source:** https://platform.claude.com/docs/about-claude/models/optimizing-for-cost-and-intelligence
- **Claim:** Anthropic's cost guide: run an effort sweep on the strong model alone first; it is the baseline any multi-model setup must beat.
- **Result:** Step 3 runs the new model alone, walls on, at each effort level before any comparison.

## 2026-10-12 · Prune prompts one group at a time against evals
- **Kind:** vendor-reported
- **Source:** https://developers.openai.com/api/docs/guides/latest-model
- **Claim:** OpenAI's guidance for its latest model: prune prompts one instruction group or tool at a time against evals.
- **Result:** Step 5 ablates one component per run; scenario S4.

## 2026-10-12 · Releases that would have triggered a review
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/news
- **Claim:** Opus 5.5 shipped on Sep 22, Sonnet 5.5 on Sep 28 and Haiku 5.5 on Oct 7, 2026: three reviews in three weeks if every release triggers one.
- **Result:** The trigger is a major release from a lab the toolkit routes to, else quarterly; the review declares a spend cap.
- **Revisit:** when releases come faster than monthly

## 2026-10-13 · Walls are excluded because evals do not sample rare events
- **Kind:** audit
- **Source:** playbook: harness-review (harness @ 4bdc755); agentic-template ADR-0021 on branch docs/adr-permission-precedence
- **Claim:** The playbook excludes deny hooks, branch protection and secret guards from removal; ADR-0021 measured that only denies hold in every permission mode, so a removed deny has no fallback.
- **Result:** Step 6 and the walls list in references/components.md; scenario S2 at k=10.

## 2026-10-13 · Model-release prompts drifted to the reflector
- **Kind:** measured
- **Source:** routing run on the 33-skill catalog (see evaluating-skills evidence, 2026-10-13), 4 runs per prompt
- **Claim:** "Sonnet 5.5 is out. Ablate the reviewer subagent and the extra rule blocks and delete what doesn't help" routed to reflecting-on-runs 4 of 4 while this description opened with the release trigger; opening with "harness components must be re-tested and the ones that no longer help deleted" fixed it (3–4 of 4). Final full run 33/33.
- **Result:** The description leads with ablation and deletion; reflecting-on-runs names ablation and model releases as exclusions.
- **Engine:** claude
- **Model:** haiku
- **Skill version:** 0.1.0
