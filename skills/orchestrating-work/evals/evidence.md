# Evidence — orchestrating-work

## 2026-10-13 · Routes on a 295-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill orchestrating-work --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 48/48; precision 65%, recall 100% over every case in the catalog. The original 905-character description, same runner and cases: 47/48, precision 83%, recall 97%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-30 · Generalized from stagehand's coordinator
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/SKILL.md and references/{workflow-state,project-delegation,safety-and-escalation}.md at commit 48aff9a
- **Claim:** A coordinator that does no product work, keeps a persistent author and independent reviewer per task, treats wakes as hints, keeps three attention states and reconciles from git and the forge recovers cleanly and never advances work on an idle pane.
- **Result:** Kept: no product work, persistent pairs, wake-as-hint, three states, delegation with explicit limits, reconcile-before-record, no retry spiral, thin worker prompts. Dropped: Herdr commands, the board, controller binding (now runtime notes). Added: caps table and disjoint-touches selection from agentic-template.
- **Revisit:** when stagehand changes its record or delegation model

## 2026-10-13 · Generalized from agentic-template's loop and CI agents
- **Kind:** observed
- **Source:** agentic-template scripts/loop.mjs, LOOPING.md, docs/workflow.md, docs/concurrency.md (commit bbfad58; run caps from branch fix/agent-run-caps commit b3a7568)
- **Claim:** A code-owned loop that dispatches the highest-priority ready task with merged dependencies, caps each run (200 turns, $5), stops after one no-progress run, and appends a run record per run keeps an unattended queue from spinning.
- **Result:** Selection order, per-run ceilings, the no-progress stop and the one-line run record are the dispatch loop's mechanical core; lanes by overlapping files come from concurrency.md.

## 2026-01-28 · Multi-agent helps parallel work and hurts sequential work
- **Kind:** literature
- **Source:** https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- **Claim:** Across 180 configurations, centralized coordination gained 80.9% on a parallelizable benchmark, every multi-agent variant lost 39–70% on sequential planning, and independent agents amplified errors 17.2× against 4.4× with a central coordinator.
- **Result:** One writer per task; parallelism only across tasks with disjoint touches; a central coordinator with a verifier.

## 2025-10-26 · Most multi-agent failures are design and verification gaps
- **Kind:** literature
- **Source:** https://arxiv.org/html/2503.13657v3
- **Claim:** In 1,642 annotated traces about 44% of failures were system design (repeated steps, ignored stop conditions), 32% inter-agent misalignment and 23.5% verification.
- **Result:** Caps and stop conditions are explicit, and every author is paired with an independent evaluator.

## 2025-06-13 · Fan-out buys tokens; coding is a poor fit
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/multi-agent-research-system
- **Claim:** Anthropic's research system beat a single agent by 90.2% at about 15× chat tokens; token usage explained 80% of variance; most coding tasks were named a poor fit.
- **Result:** Readers may fan out; writers do not.

## 2026-10-12 · Agent teams cost about 7× a standard session
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/costs
- **Claim:** Agent teams use roughly seven times the tokens of a standard session.
- **Result:** The worker cap counts every worker, evaluators and readers included.

## 2025-06-10 · Paraphrasing workers' output loses fidelity
- **Kind:** vendor-reported
- **Source:** https://www.langchain.com/blog/benchmarking-multi-agent-architectures
- **Claim:** Most supervisor errors came from paraphrasing subagent output; forwarding messages directly gave nearly a 50% gain.
- **Result:** Return intake forwards the raw artifact or a verbatim quote, never a rewrite.

## 2025-09-29 · Returns are short summaries plus file references
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Claim:** Subagents return a condensed summary of about 1,000–2,000 tokens while full outputs stay in files.
- **Result:** Workers hand back the `return` contract; the coordinator reads artifact paths, not transcripts.

## 2026-04-22 · Writes stay single-threaded
- **Kind:** vendor-reported
- **Source:** https://cognition.com/blog/multi-agents-working
- **Claim:** Multi-agent systems work best when writes stay single-threaded and extra agents review or consult.
- **Result:** Author and evaluator per task; the evaluator never edits.

## 2026-10-13 · Runtime event history is not durable
- **Kind:** vendor-reported
- **Source:** https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/socket-api.mdx
- **Claim:** A lagging subscriber gets events_lost and must reconcile from a session snapshot.
- **Result:** Recovery reconciles from task records, git and a snapshot on every start and on lost events.

## 2026-10-12 · Engines default to deep, wide, same-model delegation
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/sub-agents
- **Claim:** Subagents default to the parent's model, nest up to three levels and run up to 20 at once.
- **Result:** The skill sets depth 1, takes width from the grant, and has routing-models set each role's model.
