# Evidence — checking-plan-readiness

## 2026-10-13 · Routes on a 289-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill checking-plan-readiness --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 100%, recall 100% over every case in the catalog. The original 902-character description, same runner and cases: 33/33, precision 96%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Ported from agentic-template's workflow gates and planner rules
- **Kind:** observed
- **Source:** agentic-template docs/workflow.md and .claude/skills/planner/SKILL.md at commit bbfad58
- **Claim:** Proven and kept: the spec approval is the first human gate; a task with an open blocking question cannot be ready; a task larger than one session is split before ready; "a CUJ no task covers is a gap; a task serving no CUJ is probably scope creep".
- **Result:** parts B and C of the checklist and the rule that the owner, not the agent, approves.

## 2026-10-13 · The trace check separates complete and broken plans
- **Kind:** measured
- **Source:** node tools/validate.mjs --trace fixtures/trace/complete and fixtures/trace/broken (harness 9dfd497)
- **Claim:** The complete fixture reports READY with 0 errors and full coverage; the broken fixture reports NOT-READY with 13 epic errors (cycle, missing ADR, orphan requirement, missing UX, unknown persona) and 1 project error.
- **Result:** part A mirrors these rule names and severities so a manual report reads the same as a generated one.
- **Skill version:** 0.1.0

## 2026-10-13 · The generated report validates against its own contract
- **Kind:** measured
- **Source:** node tools/validate.mjs --trace <copy of fixtures/trace/complete> --readiness <copy>/specs, then validate on the written readiness.md (harness 9dfd497)
- **Claim:** The report the tool writes passes the readiness-report contract, and so does the manual template in references/.
- **Skill version:** 0.1.0

## 2025-10-26 · Most multi-agent failures are design and verification gaps
- **Kind:** literature
- **Source:** https://arxiv.org/html/2503.13657v3
- **Claim:** MAST attributes about 44% of multi-agent failures to system design, including agents unaware of stopping conditions.
- **Result:** readiness checks that every task has requirements and criteria named in tests before any agent starts.

## 2026-10-12 · A bad line of a plan becomes many bad lines of code
- **Kind:** literature
- **Source:** https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md
- **Claim:** HumanLayer (about August 2025, self-reported) puts review effort on research and plans, because a bad plan line yields hundreds of bad lines of code.
- **Result:** the human gate sits on the plan, with the report as its evidence.

## 2026-10-02 · Lighter spec variants drop approval gates
- **Kind:** vendor-reported
- **Source:** https://kiro.dev/docs/specs/
- **Claim:** Kiro ships Feature, Quick and Bugfix spec variants, the Quick one without approval gates.
- **Result:** a single bug task skips the report and runs only the task-level rows; the epic gate stays for epics.
