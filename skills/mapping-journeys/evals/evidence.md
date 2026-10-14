# Evidence — mapping-journeys

## 2026-10-13 · Routes on a 290-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill mapping-journeys --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 97%, recall 100% over every case in the catalog. The original 717-character description, same runner and cases: 33/33, precision 100%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Ported from agentic-template's CUJ template and feature-planning
- **Kind:** observed
- **Source:** agentic-template specs/_CUJ-TEMPLATE.md and .claude/skills/feature-planning/SKILL.md at commit bbfad58
- **Claim:** The CUJ shape (actor, goal, trigger, steps, observable success, unwanted) and its mapping of trigger, success and must-not onto EARS event, state and unwanted criteria were proven on two epics; "a CUJ no task covers is a gap; a task serving no CUJ is probably scope creep".
- **Result:** the template keeps that shape unchanged and adds Personas, User-facing, Failure paths and Critical because.

## 2026-10-13 · Both template epics' cuj.md validate unchanged
- **Kind:** measured
- **Source:** harness fixtures/valid/journey/real-rating-engine and real-template-migration (harness 9dfd497)
- **Claim:** The journey contract reads agentic-template's existing cuj.md files without edits, so the template is backward compatible.
- **Skill version:** 0.1.0

## 2025-10-15 · Small work inflated into many stories
- **Kind:** literature
- **Source:** https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- **Claim:** Böckeler saw a spec tool turn a small bug into 4 user stories with 16 acceptance criteria.
- **Result:** a bug writes no journey, a feature writes one to three, and only journeys someone would notice breaking are kept.

## 2025-10-26 · Missing stopping conditions cause multi-agent failures
- **Kind:** literature
- **Source:** https://arxiv.org/html/2503.13657v3
- **Claim:** MAST attributes 12.4% of multi-agent failures to agents unaware of stopping conditions.
- **Result:** every journey carries an observable success and a specific unwanted outcome, the raw material for the criteria an agent stops on.

## 2026-03-24 · Contracts agreed before coding let an evaluator test the live app
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/harness-design-long-running-apps
- **Claim:** Anthropic's evaluator tested the running app through a browser against contracts agreed before coding.
- **Result:** journeys are written from the user's observable path so the evaluator can walk them.
