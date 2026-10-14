# Evidence — reporting-state

## 2026-10-13 · Routes on a 282-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill reporting-state --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 8816da6, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 39/42; precision 73%, recall 100% over every case in the catalog. The original 857-character description, same runner and cases: 39/42, precision 67%, recall 100%.
- **Result:** Misses: "BILL-7's criteria pass; open the draft PR and move it to review." 3/3 (got preparing-pull-requests).
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-09-30 · Generalized from stagehand's state and wakeups
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/references/workflow-state.md and assets/task-record.yaml at commit 48aff9a
- **Claim:** Three attention values, a 3–5-word summary, next_role and next_action, no counters or booleans, a wake treated as a hint, idle or done never treated as completion, and reconciliation that advances to the furthest supported state without replaying handoffs keep a coordinator's record recoverable.
- **Result:** Kept all of it; the record is the `task-record` contract, of which stagehand's template is a valid subset. Added the `signals` map so every runtime's observation is stored the same way.

## 2026-09-30 · stagehand's wake and status scenarios
- **Kind:** observed
- **Source:** stagehand skills/orchestrating-development/evals/evals.md ("Wake delivery and recovery", "Models, capacity, and status") at commit 48aff9a
- **Claim:** A permission dialog wakes the coordinator, which inspects and asks the human; both roles idle after reviews keep the latest result and next actor; a ready PR awaiting merge is complete; duplicated wakes repeat nothing.
- **Result:** Scenarios S1, S2, S5 and S6 port these.

## 2026-10-13 · Herdr's event history is not durable
- **Kind:** vendor-reported
- **Source:** https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/socket-api.mdx
- **Claim:** A lagging subscriber receives events_lost and must resubscribe and reconcile through session.snapshot.
- **Result:** The lost-events procedure: resubscribe, one snapshot, reconcile each record, then drain notices.

## 2026-10-12 · Remote agent and tool-call task states have human-input states
- **Kind:** vendor-reported
- **Source:** https://a2a-protocol.org/latest/specification/
- **Claim:** A2A v1.0 task states include INPUT_REQUIRED and AUTH_REQUIRED as interrupted states; MCP Tasks use input_required.
- **Result:** Both map to needs-human; AUTH_REQUIRED is recorded without inspection because credentials are always a human action.

## 2026-10-12 · Headless runs report a result subtype and permission denials
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/agent-sdk/agent-loop
- **Claim:** The result message carries a subtype (success or a named ceiling or error) and turn and cost fields.
- **Result:** Ceilings and crashes map to needs-human; success alone is not complete.

## 2026-10-13 · An ask in an unattended run returns as a denial
- **Kind:** measured
- **Source:** agentic-template DECISIONS.md ADR-0021 (branch docs/adr-permission-precedence, commit c177fa1), Claude Code 2.1.296
- **Claim:** Under the no-prompt mode every ask is denied and listed in permission_denials.
- **Result:** A non-empty permission_denials makes the run needs-human even when its subtype is success.
- **Engine:** claude

## 2026-10-13 · The loop's run outcome is judged from the task files
- **Kind:** observed
- **Source:** agentic-template scripts/loop.mjs on branch fix/agent-run-caps (commit b3a7568)
- **Claim:** A run is advanced only if the dispatched task left ready and in-progress; stalled and failed stop the loop for a human.
- **Result:** The runner's outcome row in the attention map.

## 2026-10-12 · Supervision surfaces show outcomes, not activity
- **Kind:** literature
- **Source:** https://addyosmani.com/blog/claude-code-agent-teams/
- **Claim:** Parallel activity metrics can mislead about progress.
- **Result:** "What needs me" lists only needs-human tasks and their next actions.
