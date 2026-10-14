# Evidence — routing-models

## 2026-10-13 · Routes on a 298-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill routing-models --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 8816da6, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 38/39; precision 100%, recall 100% over every case in the catalog. The original 919-character description, same runner and cases: 39/39, precision 94%, recall 100%.
- **Result:** Misses: "Set this laptop to auto-edit and the devbox to autonomous." 1/3 (got delegating-authority).
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-10-12 · Start with the frontier default and tune effort first
- **Kind:** vendor-reported
- **Source:** https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- **Claim:** Anthropic says to start with Opus 5.5 for most workloads, tune effort before switching models, move to Fable 5.1 only when evals at xhigh or max fall short, and labels Haiku 5.5 for sub-agent tasks.
- **Result:** Roles route to abstract tiers; effort is tuned before the tier changes.
- **Revisit:** next Anthropic model release

## 2026-10-12 · Advisors pay only over competent executors that consult them
- **Kind:** vendor-reported
- **Source:** https://platform.claude.com/docs/about-claude/models/optimizing-for-cost-and-intelligence
- **Claim:** Haiku 5.5 and Sonnet 5.5 executors with an Opus 5.5 advisor consulted it on 0 of 198 questions at 12–25% extra cost; an Opus 5.5 executor with a Fable 5.1 advisor gained 1.7 points at about 2.1× cost, roughly what more effort buys; low effort with failures re-run at high reached 97.0% at $0.17 per task against 95.3% at $0.29.
- **Result:** No advisor without an eval against the effort-swept baseline; consultations are counted.

## 2026-04-09 · An advisor can help a mid-tier executor
- **Kind:** vendor-reported
- **Source:** https://claude.com/blog/the-advisor-strategy
- **Claim:** A Sonnet executor with an Opus advisor gained 2.7 points at 11.9% lower cost on SWE-bench Multilingual.
- **Result:** The advisor rule is conditional (stronger advisor, competent executor, prompted to consult), not a ban.

## 2026-10-12 · Cache reads are cheap; tool and effort changes break the cache
- **Kind:** vendor-reported
- **Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- **Claim:** Cache reads cost 0.05× base input on Opus and Sonnet 5.5; writes 1.25× (5 minutes) or 2× (1 hour); changing tools invalidates everything; changing effort or thinking invalidates messages.
- **Result:** Route only at task and subagent boundaries; keep the prefix stable.

## 2025-07-18 · Input dominates agent cost
- **Kind:** vendor-reported
- **Source:** https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- **Claim:** Manus measured an input-to-output ratio of about 100:1 and calls KV-cache hit rate the most important production metric.
- **Result:** Cache hit rate is one of the numbers watched; a drop is diagnosed before any model change.

## 2026-10-12 · Engines default subagents to the parent's model
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/sub-agents
- **Claim:** A subagent's model resolves per invocation, then frontmatter, then an environment default, then the main model, so the default is inherit.
- **Result:** Every role's model is set explicitly; the same holds for Codex and Gemini CLI per their docs.

## 2026-10-12 · OpenAI and Google publish role splits
- **Kind:** vendor-reported
- **Source:** https://learn.chatgpt.com/docs/agent-configuration/subagents
- **Claim:** Codex recommends gpt-6.1-sol for demanding multi-step work and gpt-6-luna for fast, narrow, high-volume work; Google positions Gemini 3.5 Flash-Lite as a subagent under 3.6 Flash.
- **Result:** The frontier/fast split per role is the same across three vendors; mapping is in engine-notes.md.

## 2024-07-01 · Per-prompt router savings come from chat benchmarks
- **Kind:** literature
- **Source:** https://lmsys.org/blog/2024-07-01-routellm
- **Claim:** RouteLLM cut cost by over 85% on MT Bench, a chat benchmark where early errors do not compound.
- **Result:** Route by role at boundaries; a per-prompt router needs its own eval on agent tasks.

## 2026-01-09 · pass^k, not pass@k
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- **Claim:** Start with 20–50 tasks from real failures and track pass^k; 75% per trial is about 42% over three trials.
- **Result:** The measuring protocol uses k ≥ 3 and pass^k for every routing comparison.

## 2026-09-23 · The template already routes one role explicitly
- **Kind:** observed
- **Source:** agentic-template .claude/agents/explorer.md (commit bbfad58)
- **Claim:** The explorer subagent is read-only and pinned to a cheaper model at low effort, and returns path:line findings; the coder, reviewer and test-runner did not set a model.
- **Result:** The role table generalizes the explorer's routing to every role and removes implicit inheritance.
