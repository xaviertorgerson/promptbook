# Evidence — designing-flows

## 2026-10-13 · Routes on a 288-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill designing-flows --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 30/30; precision 100%, recall 100% over every case in the catalog. The original 778-character description, same runner and cases: 30/30, precision 100%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Every screen has four states
- **Kind:** observed
- **Source:** agentic-template template-update/QUALITY.md at commit bbfad58
- **Claim:** The template's pending quality package requires that every screen has four states (empty, loading, error, populated), screenshots all four in a visual-regression suite, and fails review for a screen without an empty state.
- **Result:** the four states are required per data screen, and each becomes a criterion for the building task.

## 2026-09-23 · Ported from agentic-template's design template
- **Kind:** observed
- **Source:** agentic-template docs/_DESIGN-TEMPLATE.md, docs/design-presets/README.md and .claude/rules/style.md at commit bbfad58
- **Claim:** Stack-neutral and kept: the WCAG 2.2 AA accessibility bar (contrast, keyboard, focus, labels, errors tied to fields, reduced motion), states every interactive component handles, and "UI changes are exercised in a browser before done". Left to a design pack: tokens, presets and signature moves.
- **Result:** the accessibility checklist; visual design is named out of scope in the description.

## 2025-11-26 · Testing as a human user would
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Claim:** Browser automation used as a human user would greatly improved Anthropic's long-running coding results.
- **Result:** the walkthrough follows each journey through the prototype in a browser, keyboard-only at least once.

## 2026-03-24 · An evaluator walks the live app against agreed contracts
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/harness-design-long-running-apps
- **Claim:** Anthropic's evaluator tested the running app through a browser against sprint contracts agreed before coding.
- **Result:** the walk of record is by a human or a separate evaluator, not the agent that drew the prototype.

## 2025-11-20 · Verify with artifacts, not logs
- **Kind:** vendor-reported
- **Source:** https://developers.googleblog.com/en/build-with-google-antigravity-our-new-agentic-development-platform/
- **Claim:** Antigravity's tenet is to verify with artifacts such as screenshots and recordings rather than logs.
- **Result:** each walk is a recorded row with its prototype version and result.

## 2026-10-13 · No source measures prototype walks before tasks
- **Kind:** audit
- **Source:** harness playbook planning/ux-before-code.md (Evidence, recommendation line)
- **Claim:** Walking the prototype against every CUJ before tasks are cut is the playbook's rule, not a measured result.
- **Revisit:** when an eval across several products shows agents produce all four states unprompted.
