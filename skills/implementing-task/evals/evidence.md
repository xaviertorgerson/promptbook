# Evidence — implementing-task

## 2026-10-13 · Routes on a 275-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill implementing-task --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 45/45; precision 87%, recall 92% over every case in the catalog. The original 773-character description, same runner and cases: 45/45, precision 92%, recall 92%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Ported from agentic-template task-next
- **Kind:** observed
- **Source:** agentic-template .claude/skills/task-next/SKILL.md and evals.md at commit bbfad58
- **Claim:** The loop body (orient narrowly, claim by compare-and-swap, worktree with its own database, implement against EARS criteria, tests named by criterion id, park instead of guessing) is stack-neutral and proven in the template's loop and coder workflow.
- **Result:** Kept the procedure; dropped the CLI flags, pnpm, the dev-server script and the board script; moved the coder's last transition to review so finalization is a separate decision.
- **Revisit:** when the template's coder workflow changes its claim or finish steps

## 2026-09-21 · Parallel sessions on one database corrupted each other
- **Kind:** audit
- **Source:** agentic-template .claude/skills/task-next/evals.md (Evidence, 2026-09-21 template audit)
- **Claim:** The loop said "a worktree if running in parallel" and left the database shared; parallel sessions interleaved migrations.
- **Result:** Always a worktree with derived resources (step 3, delegated to managing-worktrees).

## 2026-10-13 · Runs need caps and a no-progress stop, and the agent writes its own session line
- **Kind:** observed
- **Source:** agentic-template branch fix/agent-run-caps, commit b3a7568 (scripts/loop.mjs)
- **Claim:** The loop dispatches by id, caps turns (200) and spend ($5) per run, stops when a task does not move, and has the agent name its session id in the agent-log handoff because the driver must never write the task file.
- **Result:** Step 11 appends the sessions entry and agent-log line from the agent; the runner writes only the run-record.

## 2026-10-13 · Unattended asks are denials
- **Kind:** measured
- **Source:** agentic-template branch docs/adr-permission-precedence, DECISIONS.md ADR-0021 (commit c177fa1), scripts/permission-probe.mjs
- **Claim:** In headless runs every ask (hook or rule) was denied in all five permission modes; unattended runs pin the no-prompt mode plus an allowlist.
- **Result:** A permission denial is a stop condition reported as a question for a human, never retried around.
- **Engine:** claude

## 2026-09-30 · One persistent author, findings routed back to it
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/SKILL.md (Development loop) at commit 48aff9a
- **Claim:** The author implements, verifies and opens the draft without a coordinator checkpoint; selected findings return to the same author; finalization needs separate permission.
- **Result:** Step 10 routes failing verdicts to the same writer and stops at review.

## 2026-04-22 · Writes stay single-threaded
- **Kind:** vendor-reported
- **Source:** https://cognition.com/blog/multi-agents-working
- **Claim:** Multi-agent systems work best today when writes stay single-threaded; other agents review and consult.

## 2025-10-26 · Verification failures are a quarter of multi-agent failures
- **Kind:** literature
- **Source:** https://arxiv.org/html/2503.13657v3
- **Claim:** MAST attributes about 23.5% of failures to verification and about 44% to system design such as ignored stopping conditions; an objective-verification step added 15.6% on ChatDev.
- **Result:** A separate evaluation before human review, and explicit stop conditions.

## 2025-07-18 · A rewritten plan file keeps the goal in recent context
- **Kind:** vendor-reported
- **Source:** https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- **Claim:** Manus rewrites a todo file across about 50 tool calls so the plan stays recited.
- **Result:** Working notes are rewritten in place; the agent log stays append-only.
