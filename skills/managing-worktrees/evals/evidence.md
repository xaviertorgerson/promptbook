# Evidence — managing-worktrees

## 2026-10-13 · Routes on a 282-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill managing-worktrees --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 89%, recall 100% over every case in the catalog. The original 773-character description, same runner and cases: 33/33, precision 100%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-23 · Per-worktree database and port block from the branch
- **Kind:** observed
- **Source:** agentic-template docs/concurrency.md and scripts/dev-server.mjs at commit bbfad58
- **Claim:** Each worktree gets the database app_<branch-slug> and dev servers on free ports from the project's block; .worktreeinclude copies .env in; five concurrent worktrees is one human's review span.
- **Result:** The naming rule keeps the template's slug so existing databases keep their names.

## 2026-09-21 · A shared dev database corrupted parallel tasks
- **Kind:** audit
- **Source:** agentic-template .claude/skills/task-next/evals.md (Evidence, 2026-09-21)
- **Claim:** Parallel sessions sharing one database interleaved migrations and test data.
- **Result:** Derived resources are mandatory, not optional for parallel runs.

## 2026-09-30 · Audited cleanup, recorded base, primary-workspace safeguards
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/references/safety-and-escalation.md at commit 48aff9a
- **Claim:** Record the exact base commit; preserve a dirty or diverged primary checkout; audit ownership, recoverability and process state before removal; audit submodules separately; never close a primary workspace with child worktrees; force removal only for the submodule case after the audit.
- **Result:** Ported as the create steps, the cleanup audit and the submodule exception.

## 2026-10-13 · git removal deletes ignored files and refuses submodule worktrees
- **Kind:** measured
- **Source:** git 2.43.0 probe in a scratch repository (worktree with an ignored .env; worktree with an initialized submodule), recorded in references/cleanup-audit.md
- **Claim:** git worktree remove refused untracked files but deleted an ignored .env silently, and refused a worktree containing submodules even after deinit --all until --force.
- **Result:** The audit checks ignored files explicitly, and the force exception is limited to the audited submodule case.

## 2026-10-13 · The template's hook denies force-with-lease
- **Kind:** measured
- **Source:** agentic-template .claude/hooks/pre-tool-safety.mjs at commit bbfad58, probed with git push --force-with-lease origin feat/x
- **Claim:** The hook denies every git push with --force, including --force-with-lease, and allows git worktree remove.
- **Result:** Refresh by merge where the walls deny force; the audit is the only guard on removal there.
- **Engine:** claude

## 2026-02-11 · One app instance per worktree
- **Kind:** vendor-reported
- **Source:** https://openai.com/index/harness-engineering/
- **Claim:** OpenAI booted its app per worktree, each with an ephemeral observability stack the agent could query.

## 2026-04-10 · Worktree-per-agent tooling is being absorbed by runtimes
- **Kind:** vendor-reported
- **Source:** https://vibekanban.com/blog/shutdown
- **Claim:** Vibe Kanban, a worktree-per-agent board, sunset as native features absorbed its value.
- **Revisit:** when the runtime provisions per-task sandboxes with derived resources natively
