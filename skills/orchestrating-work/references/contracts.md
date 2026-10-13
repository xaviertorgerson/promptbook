# Contract excerpts (harness 0.1.0, contracts 1.0.0)

The minimum of the harness contracts this skill reads and writes, so it works when installed alone.
Field names are exact. The full schemas are `schemas/*.schema.json` in the harness.

## task (specs/<epic>/tasks/<ID>.md, frontmatter)

| Field | Use here |
|---|---|
| `id`, `epic` | equal the file name and folder |
| `status` | spec-draft, ready, in-progress, review, human-review, merging, integrated, merged; side states blocked, needs-input, suspended |
| `owner` | null = claimable by auto-dispatch; set = held. The owner/status pair is the claim lock |
| `priority` | P0..P3, the owner's order |
| `depends_on` | task ids that must be `merged` before a claim; `integrated` is enough for a dependency in the same epic (it builds on that epic's integration branch) |
| `lands_to` | the epic's integration branch when the task lands there; absent: the protected branch |
| `touches` | path globs the task expects to modify; overlapping tasks are one lane |
| `size` | XS..XL; drives budget and model routing |
| `risk` | low, medium, high, or `{level, irreversible, reasons}`; high or irreversible never runs unsupervised |
| `evaluator` | ordered `{kind: tests, script, agent-review, human, eval; ref}` |
| `budget` | `{max_turns, max_usd, max_minutes, max_tokens}` for the whole task |
| `sessions` | appended by the agent in its handoff; the runner never writes the task file |
| `mode` | spec-driven, research-plan-implement, ralph-loop, icm-pipeline; absent: the epic's `mode` (spec.md frontmatter), else spec-driven |

## Task transitions (workflow machine) that matter to a coordinator

| Transition | From → to | By | Grant that lets a coordinator do it |
|---|---|---|---|
| claim | ready → in-progress | coder, engineer, owner | `select-tasks` (only to choose, reorder or add work; dispatching in the owner's order is mechanical) |
| open-draft | in-progress → review | coder, engineer | — |
| mark-pr-ready | review → human-review | coder, engineer | `finalize`; guard `independent-verification`: risk medium or high needs the evaluator's pass on the current head |
| approve-pr | human-review → merging | owner, engineer (gate) | `merge`, with independent review and required checks |
| land | merging → merged | merge | `merge` (repo, strategy and exact target match; the target is the protected branch) |
| integrate | merging → integrated | merge | `merge` (the target is the task's `lands_to`) |
| promote | integrated → merged | owner, engineer | never (a human merged the integration branch) |
| block / need-input | → blocked / needs-input | coder, planner, engineer, owner | — (must carry a reason) |

Rules: a status changes only by a commit from a listed role; runtime signals never advance it; a
human setting `owner` or `status` wins and a running agent yields; a kick-back carries a reason.

## Mode guards (added to transitions; modes never add states)

| Mode | Before claim | Before review | Runtime rule |
|---|---|---|---|
| spec-driven | spec approved | every AC id in a test name | — |
| research-plan-implement | a human approved the research note and plan in the task's working notes | as spec-driven | compact context into the notes between phases |
| ralph-loop | a prioritized fix plan exists | backpressure (tests, types) green each iteration | fresh session per iteration; turn, spend and no-progress caps; PR only; never on existing codebases or irreversible work |
| icm-pipeline | the previous stage's output exists | a human may edit each stage output before the next reads it | stages run in sequence; no concurrency inside a pipeline |

## task-record (.orchestrator/tasks/<id>.yaml)

Required: `task_id`, `state.name`, `state.summary`. `state.name` is attention: `working`,
`needs-human`, `complete`. `needs-human` requires `next_action`; `complete` forbids `next_action`
and `next_role`. `next_role` ∈ author, reviewer, worker, workspace_agent, orchestrator, null.
`summary` ≤ 120 characters. Optional: `runtime`, `mode` (engagement: development, reviewer-only,
delegated-work, workspace-only — not the task's methodology), `objective`, `intent_ref`, `grant`,
`repository{name, root, worktree, remote, base, base_commit, branch}`, `workspace{id, label}`,
`agents{role: name}`, `role_sessions{role: {pane_id, session_id, engine, model, effort}}`,
`wake.watches{role: id}`, `pull_requests[]`, `signals{role: {source, value, observed_at}}`,
`result`, `reviews[]{pr, head, outcome, by, ref}`, `decisions[]{decision, source, scope, at}`,
`updated_at`. No counters, no booleans, no phase history.

## return (a worker's hand-back, JSON)

Required: `summary` (≤ 8,000 characters, about 2k tokens), `attention`, `artifacts[]{path, kind,
note}`, `decisions_needed[]{question, options, recommendation, blocking, for: human|dispatcher}`.
Optional: `task`, `role`, `criteria{met[], unmet[]{id, reason}}`, `verification[]{command, result:
pass|fail|skipped, note}`, `session`. `needs-human` needs at least one question; `complete` needs no
unmet criterion.

## run-record (one JSON line per run, written by the runner)

Required: `task`, `session_id`, `started_at`, `ended_at`, `exit`, `outcome` (an author's run:
advanced, stalled, failed, needs-human; an evaluator's: verdict; a reader's or helper's: read),
`reason` (null when advanced, verdict or read), `subtype`, `num_turns`, `total_cost_usd`,
`status_after`. Optional: `engine`, `runtime`, `role` (author, evaluator, reader, planner,
orchestrator, merge, other; absent means author), `model`, `status_before`, `permission_mode`,
`permission_denials` (a count or one line per denied call), `attention`, `budget`, `grant`.
`advanced` means the task left ready and in-progress; log an evaluator's or reader's run with its
role and verdict or read, never as an author's advanced.

## authority defaults

Every decision is the human's unless a live grant names it. Grantable: `select-tasks`,
`approve-plan`, `dispose-findings` (with a `policy`), `finalize`, `publish-review`,
`merge{repo, target, strategy, requires}`. Never grantable: spec approval, production release,
answering a permission prompt, changing policy or walls, force-pushing a shared branch, destructive
data actions, widening a grant. Policy denies beat any grant.
