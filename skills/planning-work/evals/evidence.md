# Evidence — planning-work

## 2026-10-13 · Routes on a 289-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill planning-work --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 39/39; precision 88%, recall 100% over every case in the catalog. The original 890-character description, same runner and cases: 39/39, precision 97%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Ported from agentic-template planner and the task template
- **Kind:** observed
- **Source:** agentic-template .claude/skills/planner/SKILL.md, evals.md, specs/_TASK-TEMPLATE.md and docs/workflow.md at commit bbfad58
- **Claim:** Proven and kept: slice into tasks of about one CUJ slice finishable in one focused session; prefer thin vertical slices; split before ready, not after a stall; spec-draft until the epic is approved; never invent a criterion (unknowns go to Open questions, needs-input when a decision is required); "a task serving no CUJ is probably scope creep"; deferred slices go to a deferred list with a trigger. Dropped: the board script, the ship skill and template paths.
- **Result:** procedure steps 3, 4, 7, 9 and 11.

## 2026-09-21 · Tasks without size or id-form criteria
- **Kind:** audit
- **Source:** agentic-template .claude/skills/planner/evals.md at commit bbfad58
- **Claim:** Tasks carried AC1 ids and no size, so no test could be matched to a criterion and value could not be ranked against effort.
- **Result:** the AC-n form, a test name carrying "<TASK-ID> AC-n", and a required size.

## 2026-10-12 · The research report proposed the harness task fields
- **Kind:** audit
- **Source:** /home/claude/reports/Agentic orchestration patterns 2026.md and harness playbook planning/plan-readiness.md
- **Claim:** Adding touches, risk, inputs, evaluator, budget and sessions to the task frontmatter makes single-writer and routing checkable.
- **Result:** step 5 fills every harness field; task-fields.md maps risk to evaluator and size to budget.

## 2025-11-26 · An end-to-end check before new work
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Claim:** Anthropic's long-running harness ran an init script and an end-to-end test at each session start, against failures such as one-shotting and premature victory.
- **Result:** the walking skeleton is the first task and its journey's smoke test keeps running.

## 2026-02-05 · Fixes broke existing behaviour until CI was added
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/building-c-compiler
- **Claim:** In Anthropic's multi-agent compiler build, fixes often broke existing behaviour and CI was added late to stop regressions.
- **Result:** the skeleton puts the real build, deploy and probe first, before feature tasks.

## 2026-10-02 · Independent tasks run in waves from a dependency graph
- **Kind:** vendor-reported
- **Source:** https://kiro.dev/docs/specs/
- **Claim:** Kiro builds a dependency graph from its task list and runs independent tasks concurrently in waves.
- **Result:** depends_on is the schedule, and disjoint touches decide which independent tasks may run together.

## 2026-03-18 · Stage contracts name exact sections to load
- **Kind:** literature
- **Source:** https://arxiv.org/html/2603.16021
- **Claim:** ICM's stage contracts list the exact files and sections to load per stage (self-reported, no controlled comparison).
- **Result:** inputs cite section anchors, not whole directories.

## 2025-07-14 · Ralph suits greenfield work with backpressure
- **Kind:** literature
- **Source:** https://ghuntley.com/ralph/
- **Claim:** Huntley would not run the Ralph loop in an existing code base and relies on test and type backpressure.
- **Result:** ralph-loop is never the mode for high risk or an existing codebase.

## 2026-10-13 · Templates validate against the task contract
- **Kind:** measured
- **Source:** node tools/validate.mjs --contract task on skills/planning-work/references/*-template.md (harness 4bdc755)
- **Claim:** The feature and skeleton templates pass the task contract with every harness field set and EARS criteria.
- **Skill version:** 0.1.0
