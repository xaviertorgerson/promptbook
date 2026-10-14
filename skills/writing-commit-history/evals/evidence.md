# Evidence — writing-commit-history

## 2026-10-13 · Routes on a 291-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill writing-commit-history --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 86%, recall 100% over every case in the catalog. The original 804-character description, same runner and cases: 33/33, precision 95%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-21 · The doctrine had no failure behind it yet
- **Kind:** audit
- **Source:** agentic-template .claude/skills/commit-history/evals.md @ bbfad58
- **Claim:** The template audit recorded no evidence yet; the first entry was to come when a body restated a diff and a reviewer had to ask why.
- **Result:** Kept the doctrine and its two scenarios; this log waits for the first real incident before the skill can pass promotion gates.
- **Revisit:** when a reviewer first asks "why" on a commit

## 2026-10-12 · A fresh session reorients from the git log
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Claim:** Anthropic's long-running-agent harness has every coding session read the git log and a progress file before new work.
- **Result:** The body carries the why and the contract references a fresh session needs; reading history comes before guessing.

## 2026-10-13 · Engineering invariant ENG-6
- **Kind:** audit
- **Source:** standards/engineering.md (harness @ 9dfd497)
- **Claim:** Small commits, one logical change each, Conventional Commits, a body that says why, and no AI attribution are an invariant in every repository; today only review enforces it.
- **Result:** The writing procedure restates ENG-6 and adds contract references (task, AC, REQ, ADR) so commits join the trace.
- **Revisit:** when a commit-message lint becomes an L2 hook

## 2026-10-13 · Ported from the template's commit-history
- **Kind:** observed
- **Source:** agentic-template .claude/skills/commit-history/SKILL.md and evals.md @ bbfad58
- **Claim:** Conventional Commits, the why-body with references, one logical change per commit, intentional staging, no attribution, heredoc messages, and the history queries are git-only and stack-neutral.
- **Result:** Kept all of them and both scenarios. Dropped the pg-boss example prompt (reworded neutrally) and the ship neighbour (an L4 pack skill, kept as a near-miss routed to none). Added task status-transition commits, the no-rewrite-of-published-history gate, the secret stop condition and the "say when history is silent" rule.

## 2026-10-13 · History questions about a retry loop route to debugging
- **Kind:** measured
- **Source:** routing run on the 33-skill catalog (see evaluating-skills evidence, 2026-10-13), 4 runs per prompt per description variant
- **Claim:** "Who introduced this retry loop, and what does the commit say about why?" routed to debugging-failures in 4 of 4 runs under six description variants, including ones that named retries explicitly; the same question about a config key or a function routed here. Ending the description with a debugging exclusion did not help; leading with "writing a commit message or digging through git history" did.
- **Result:** The positive case now asks about a config key, with a note; debugging-failures' description excludes questions about who wrote code or which commit introduced it. Final run 31/33: "when did X last change" and the config-key question each answered none once.
- **Engine:** claude
- **Model:** haiku
- **Skill version:** 0.1.0
- **Revisit:** when a newer cheap model is adopted for routing
