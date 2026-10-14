# Evidence — writing-requirements

## 2026-10-13 · Routes on a 269-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill writing-requirements --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 36/36; precision 100%, recall 100% over every case in the catalog. The original 910-character description, same runner and cases: 36/36, precision 98%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Ported from agentic-template feature-planning, docs/ears.md and the spec template
- **Kind:** observed
- **Source:** agentic-template .claude/skills/feature-planning/SKILL.md, evals.md, docs/ears.md and specs/_SPEC-TEMPLATE.md at commit bbfad58
- **Claim:** Proven and stack-neutral: one checkable behaviour per requirement row, the five EARS patterns and their mapping from CUJ fields, "if you cannot name the test that proves it, it is not a criterion yet", criteria with AC-n ids, and the spec's Problem / Scope In-Out / Requirements / Acceptance shape. Dropped: the template's script names, the board, and stack-specific config rows.
- **Result:** procedure steps 4 and 7 and references/ears.md carry these unchanged; NFR rows with category and measure were added.

## 2026-09-21 · A criterion with no measure was rewritten or removed
- **Kind:** audit
- **Source:** agentic-template .claude/skills/feature-planning/evals.md at commit bbfad58 (scenario "A criterion without a test in mind")
- **Claim:** "The export shall be fast" was accepted as a criterion until the rule required an EARS sentence with a measurable outcome.
- **Result:** "fast" is listed as not an NFR, and vague measures become Open questions rather than invented numbers.

## 2026-09-21 · Criterion ids without a hyphen could not be matched to tests
- **Kind:** audit
- **Source:** agentic-template .claude/skills/planner/evals.md at commit bbfad58
- **Claim:** Tasks carried AC1 ids, so no test name could be matched to a criterion.
- **Result:** the AC-n form, and test names that carry "<TASK-ID> AC-n".

## 2025-10-15 · Kiro traces tasks to requirement numbers; over-specification is the opposite failure
- **Kind:** literature
- **Source:** https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- **Claim:** Kiro writes requirements with acceptance criteria and traces tasks back to requirement numbers; the same review found 16 criteria written for one small bug.
- **Result:** every row traces to a CUJ and tasks cite REQ ids; the scale table caps a bug at one row.

## 2025-10-26 · Unaware of stopping conditions
- **Kind:** literature
- **Source:** https://arxiv.org/html/2503.13657v3
- **Claim:** MAST attributes about 44% of multi-agent failures to system design, including 12.4% to agents unaware of stopping conditions.
- **Result:** requirements are written as the conditions an agent stops on: testable, one behaviour, measurable NFRs.

## 2026-01-09 · Grade outcomes, not steps
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- **Claim:** Anthropic's eval guidance grades outcomes rather than step sequences.
- **Result:** responses must be observable from outside the system named; implementation words are rejected.

## 2026-10-13 · Skilldex writing-specifications is the pinned alternative for component design
- **Kind:** observed
- **Source:** Skilldex skills/writing-specifications/SKILL.md at commit fc572b6
- **Claim:** It runs a consultative, outline-first, section-by-section process for architectural design documents (system, component, API specifications), with no journey or requirement-id traceability.
- **Result:** step 2 and the checklist say when to prefer it: one component's contract, no journeys, an engineer audience.

## 2026-10-13 · The template parses as both contracts
- **Kind:** measured
- **Source:** node tools/validate.mjs --contract epic and --contract requirement on skills/writing-requirements/references/spec-template.md (harness 9dfd497)
- **Claim:** The template's frontmatter passes `epic`; its 5 REQ rows classify as the five EARS patterns and its 7 NFR rows pass `requirement` with a category and measure.
- **Skill version:** 0.1.0
