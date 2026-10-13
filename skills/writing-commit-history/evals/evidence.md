# Evidence — writing-commit-history

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
- **Source:** standards/engineering.md (harness @ 4bdc755)
- **Claim:** Small commits, one logical change each, Conventional Commits, a body that says why, and no AI attribution are an invariant in every repository; today only review enforces it.
- **Result:** The writing procedure restates ENG-6 and adds contract references (task, AC, REQ, ADR) so commits join the trace.
- **Revisit:** when a commit-message lint becomes an L2 hook

## 2026-10-13 · Ported from the template's commit-history
- **Kind:** observed
- **Source:** agentic-template .claude/skills/commit-history/SKILL.md and evals.md @ bbfad58
- **Claim:** Conventional Commits, the why-body with references, one logical change per commit, intentional staging, no attribution, heredoc messages, and the history queries are git-only and stack-neutral.
- **Result:** Kept all of them and both scenarios. Dropped the pg-boss example prompt (reworded neutrally) and the ship neighbour (an L4 pack skill, kept as a near-miss routed to none). Added task status-transition commits, the no-rewrite-of-published-history gate, the secret stop condition and the "say when history is silent" rule.
