# Evidence — promoting-learnings

## 2026-10-13 · Routes on a 293-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill promoting-learnings --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 39/39; precision 100%, recall 100% over every case in the catalog. The original 716-character description, same runner and cases: 39/39, precision 100%, recall 91%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-02-05 · Public skills carry malicious payloads
- **Kind:** literature
- **Source:** https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub
- **Claim:** 13.4% of 3,984 public skills had a critical issue and 76 were confirmed malicious; Unit 42 reported malicious skills that passed scanners (https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain-risk/).
- **Result:** Gate 5 is a security read by hand for anything with hooks, MCP servers, executables or egress; third parties are mirrored and pinned with auto-update off.

## 2026-02-13 · Curated skills beat self-written ones
- **Kind:** literature
- **Source:** https://arxiv.org/html/2602.12670v1
- **Claim:** SkillsBench: curated skills +16.2 points, self-generated −1.3; promotion therefore requires evals and evidence from real failures rather than enthusiasm.
- **Result:** Gates 2–4. The three-evidence threshold itself is this playbook's recommendation, not a measured number.

## 2026-09-14 · Two sessions pushed promotions to the template's default branch
- **Kind:** incident
- **Source:** agentic-template .claude/skills/promote-to-template/evals.md @ bbfad58
- **Claim:** Two projects' sessions pushed to the template's default branch within minutes; the second swept the first's uncommitted doctrine edits into its own commit.
- **Result:** Promotion lands by pull request in the destination, never by a direct push (step 8, scenario S2).

## 2026-09-14 · Product specifics were promoted inside a doctrine
- **Kind:** incident
- **Source:** agentic-template .claude/skills/promote-to-template/evals.md @ bbfad58
- **Claim:** The first promotion carried a product's copy, prices and demo job into a generic doctrine.
- **Result:** Rules in the generic voice; one attributed worked example at the end (step 6, scenario S1).

## 2026-10-12 · Engines resolve skill name collisions in opposite directions
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/skills
- **Claim:** Claude Code's docs say personal skills override project ones; Gemini CLI's docs (https://geminicli.com/docs/cli/skills/) give the workspace precedence over the user; Codex lists duplicates from both scopes.
- **Result:** Rename on promotion and delete the lower copy; never shadow.
- **Revisit:** when engines converge on one precedence order

## 2026-10-12 · Auto-update can change reviewed files
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/plugins/security
- **Claim:** Claude Code's plugin docs warn that with auto-update on, files you reviewed can change on disk; marketplace entries can pin a 40-character sha (https://code.claude.com/docs/en/plugins/marketplace-reference).
- **Result:** Pins carry commit and tree; bumps are pull requests that run evals.

## 2026-10-13 · Ported from the template's promote-to-template
- **Kind:** observed
- **Source:** agentic-template .claude/skills/promote-to-template/SKILL.md @ bbfad58
- **Claim:** The generic test, the home-by-kind table, registration plus a changelog line classed additive/behavioral/breaking, and "never promote an unverified claim" are stack-neutral and were used in three projects.
- **Result:** Kept those. Dropped the template-only steps (the sync's managed-file list, the sync dry run, the template check), which belong in the template's own pack reference.

## 2026-10-13 · A lock bump can route to adopting-harness
- **Kind:** measured
- **Source:** routing run on the 33-skill catalog (see evaluating-skills evidence, 2026-10-13), 3 runs
- **Claim:** 38 of 39 cases passed; "Bump the harness pin in toolkit.lock to v0.4.0" routed to adopting-harness once and in an earlier run twice, because that description triggers on "add a toolkit.lock". "Deprecate X in favor of Y" routed to building-skills until the description named the phrase.
- **Result:** The description names "bump the harness or a pack pin in toolkit.lock" and "deprecate X in favor of Y"; adopting-harness should exclude pin bumps in its own description.
- **Engine:** claude
- **Model:** haiku
- **Skill version:** 0.1.0
