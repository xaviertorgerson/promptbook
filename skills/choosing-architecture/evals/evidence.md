# Evidence — choosing-architecture

## 2026-10-13 · Routes on a 296-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill choosing-architecture --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 8816da6, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 100%, recall 100% over every case in the catalog. The original 981-character description, same runner and cases: 33/33, precision 100%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Ported from agentic-template's decision register and mandate
- **Kind:** observed
- **Source:** agentic-template DECISIONS.md, AGENTS.md and .claude/skills/bootstrap/SKILL.md at commit bbfad58
- **Claim:** Proven practice: ADRs are immutable once accepted and corrected by superseding; newer ADRs carry a "Reversed when" trigger; bootstrap never chooses a stack, it confirms the mandate's one stack, and "a deviation without a trigger is a defect". Dropped: the specific stack.
- **Result:** pack-or-deviation in step 3, supersede-never-edit in step 6, and a reversal trigger on every ADR.

## 2026-09-23 · Tool-preference arguments added a second way of doing things
- **Kind:** observed
- **Source:** agentic-template template-update/REFLECTION.md at commit bbfad58
- **Claim:** Across four stack reversals, the argument that one tool was better usually added a second way of doing something; the argument that a property must hold usually showed the simpler design already held it.
- **Result:** decisions are ranked by quality-attribute scenarios, and a feature-list argument is not a decision.

## 2026-10-12 · Instruction files kept teaching superseded decisions
- **Kind:** incident
- **Source:** agentic-template AGENTS.md and .claude/rules/stack.md at commit bbfad58, against ADR-0015 and ADR-0019; fix on branch fix/stack-drift (scripts/decision-drift.mjs, commit 5651f88)
- **Claim:** Always-loaded text still described a stack two accepted ADRs had superseded, so every session was told the retired choice.
- **Result:** the decision-drift gate is a named fitness function in references/fitness-functions.md.

## 2026-09-23 · Module boundaries enforced as a gate
- **Kind:** observed
- **Source:** agentic-template .dependency-cruiser.cjs at commit bbfad58
- **Claim:** Boundaries such as "core never imports adapters" and "no circular imports" run as an error-level dependency rule in the pre-commit hook and CI, not as prose.
- **Result:** the dependency-rule kind of fitness function and the rule that every ADR names its check.

## 2026-02-11 · Layered domains enforced with linters that carry remediation
- **Kind:** vendor-reported
- **Source:** https://openai.com/index/harness-engineering/
- **Claim:** OpenAI enforced forward-only layered domains with custom linters and structural tests whose errors told the agent how to fix them.
- **Result:** fitness-function errors say how to fix the violation.

## 2026-07-01 · Determinism where the workflow is known
- **Kind:** vendor-reported
- **Source:** https://developers.googleblog.com/why-we-built-adk-20/
- **Claim:** Google's guidance: if you can clearly map the workflow, use determinism.
- **Result:** decisions that can be checked mechanically are checked by code, not by review.

## 2026-10-13 · No source measures the door test or pack-or-deviation
- **Kind:** audit
- **Source:** harness playbook planning/architecture-and-stack.md (Evidence, recommendation line)
- **Claim:** The one-way/two-way door test and "stack = pack or deviation" are the playbook's rules adapted from the user's mandate, not measured results.
- **Revisit:** when a reversal trigger fires or decision-drift reports grow faster than they are fixed.

## 2026-10-13 · ADR template validates; Fitness function is kept as an extra
- **Kind:** measured
- **Source:** node tools/validate.mjs --contract decision skills/choosing-architecture/references/adr-template.md (harness 4bdc755)
- **Claim:** The three template entries pass the decision contract (one-way doors carry a reversal trigger); the Fitness function label lands in `extra` and placeholders are warnings, not errors.
- **Skill version:** 0.1.0
