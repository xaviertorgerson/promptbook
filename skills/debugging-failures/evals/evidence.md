# Evidence — debugging-failures

## 2026-10-13 · Routes on a 251-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill debugging-failures --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 36/36; precision 98%, recall 100% over every case in the catalog. The original 737-character description, same runner and cases: 34/36, precision 100%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-21 · The doctrine had no failure behind it yet
- **Kind:** audit
- **Source:** agentic-template .claude/skills/debug-forensics/evals.md @ bbfad58
- **Claim:** The template audit recorded no evidence beyond the doctrine: no symptom patch had yet been caught slipping past review.
- **Result:** The port keeps the doctrine and its three scenarios, and this log waits for the first real incident; the skill cannot be promoted past project-level gates until it has three.
- **Revisit:** when the first symptom patch is caught in review

## 2026-10-12 · Fixes broke existing functionality without a strong verifier
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/building-c-compiler
- **Claim:** In Anthropic's parallel-agents compiler project, fixes frequently broke existing functionality, and the verifier had to be nearly perfect.
- **Result:** Step 5 requires the full suite green after the fix, and step 4 writes the regression test before the fix.

## 2026-10-12 · Read the git log before new work
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Claim:** Anthropic's long-running-agent harness starts each session by reading the git log and a progress file.
- **Result:** Localizing starts with what changed (git log, bisect, the culprit's message).

## 2026-10-13 · Ported from the template's debug-forensics
- **Kind:** observed
- **Source:** agentic-template .claude/skills/debug-forensics/SKILL.md and evals.md @ bbfad58
- **Claim:** Reproduce, localize, root cause by five whys, fix at the cause, a non-negotiable regression test, look for siblings, and the three don'ts (retry, weaken the test, claim without reproduction) are stack-neutral.
- **Result:** Kept all of them and the three scenarios. Dropped the template's /ship step, its audit-trail and decision-log names and the nightly-audit neighbour (an L4 runtime skill, kept as a near-miss routed to none). Added stop conditions for destructive repairs and security causes, and a flaky-test reference.
