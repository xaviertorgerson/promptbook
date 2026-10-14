# Walkthrough — Tally, from brief to integration merge

One fictional product, **Tally** (households settle shared bills from a link), taken through every
contract the harness defines: planning, execution and runtime, then learning. Every file here
validates against its contract; the timeline below says which skill wrote it, which gate it passed
and who passed it. All people, numbers, commits and links are fictional sample data.

The files stand as they would at **2026-10-15 11:00 UTC**, mid-epic: the skeleton merged, one task
integrated, one working, one waiting on a human. The rest of the epic, to dana merging
`integration/settle-up` into `main`, is narrated after the snapshot and replayed by
[`simulate.yaml`](simulate.yaml).

```sh
node tools/cli.mjs validate examples/tally                  # every file against its contract
node tools/cli.mjs trace examples/tally --strict            # BRIEF → PER → CUJ → REQ/NFR → UX → TASK → test names
node tools/cli.mjs simulate --project examples/tally --seeds 1..50   # the queue as it stands, from the snapshot
node tools/cli.mjs simulate examples/tally/simulate.yaml --seeds 1..50  # the walkthrough's faults
node tools/cli.mjs lock --lock examples/tally/toolkit.lock --check
node tools/cli.mjs compile-policy examples/tally/_operator/agent-policy.yaml --profile ci --engine claude
```

`tests/example.test.mjs` runs all of them (and diffs every compiled policy against
`_operator/compiled/`), so the example cannot rot.

## Cast

| Who | Role (workflow.yaml) | Runs as |
|---|---|---|
| dana | owner, engineer, operator | a human: the three gates, the grants, the L1 policy |
| coordinator | orchestrator, under GRANT-1 and GRANT-2 | Claude on the devbox (`devbox` profile, bypass tier) in a terminal multiplexer |
| tally-coder | coder | Claude, headless, one run per dispatch (`ci` profile: `dontAsk`, allow list, caps) |
| tally-evaluator | evaluator | Gemini, headless (`ci` profile): a different model family from the author |
| tally-reader | read-only helper | Claude at a smaller model, low effort |
| merge | merge | the forge's merge agent, the only automation that lands on `main` |

## Where each layer shows up

| Layer | In this example | Decides |
|---|---|---|
| L1 personal | [`_operator/agent-policy.yaml`](_operator/agent-policy.yaml) and its compiled settings, copied from dana's dotfiles | how often an agent asks: `workstation` auto-edit, `devbox` bypass (only with `requires` and the accepted egress gap), `ci` unattended (an ask is a denial) |
| L2 project | `docs/`, `specs/`, `DECISIONS.md`, `ARCHITECTURE.md`, `tests/`, [`toolkit.lock`](toolkit.lock) | what is built, which harness it speaks, and what is never allowed (its walls, the hook and deny rules a template pack installs, are not reproduced here) |
| L3 harness | this repository, pinned by `toolkit.lock`: the schemas every file validates against, the skills named below, the tools in the commands above | the contracts |
| L4 runtime | `.orchestrator/` (grants, task records), `.agent/` (run records, returns, verdicts) — runtime state a product keeps untracked, committed here so the example is whole | how much a run may spend, and every binding to an engine |

## Timeline

Status is the task's workflow status (a commit to its file); attention is the runtime record's view
for the human. They move separately: no row below moves a status on a signal.

### Plan — 2026-10-13

| # | Step | Skill | Artifact | Gate · passed by | Layer |
|---|---|---|---|---|---|
| 1 | Frame the product from ten interviews; riskiest assumption A3 (links keep households apart) | framing-products | `docs/product/brief.md` | go decision · dana | L2 |
| 2 | Two decision-relevant personas | defining-personas | `docs/product/personas.md` | — | L2 |
| 3 | Two critical journeys, each with personas, trigger, success and unwanted outcome | mapping-journeys | `specs/settle-up/cuj.md` | — | L2 |
| 4 | EARS requirements REQ-1..8; NFR-1..4 by category (NFR-4: compatibility) | writing-requirements | `specs/settle-up/spec.md` | — | L2 |
| 5 | Flows with four states, a clickable prototype, three walkthroughs; the failed CUJ-2 walk added Undo (REQ-8) | designing-flows | `docs/ux/settle-up.md`, `docs/ux/prototypes/` | — | L2 |
| 6 | Ranked quality attributes, ADR-0001..0004; ADR-0001 (tenancy) is the one-way door, decided | choosing-architecture | `DECISIONS.md`, `ARCHITECTURE.md` | one-way door accepted · dana | L2 |
| 7 | Epic mode `spec-driven`; no task overrides it | choosing-methodology | `spec.md` frontmatter | — | L2 |
| 8 | Four tasks: SPLIT-1 the skeleton and root; SPLIT-2 and SPLIT-3 share `migrations/**`, so ordered; SPLIT-4 its own lane; `lands_to`, `risk`, `evaluator`, `budget` on each | planning-work | `specs/settle-up/tasks/SPLIT-{1..4}.md` | — | L2 |
| 9 | Trace check at the gate: ready, 0 gaps, 17/17 criteria named in tests; the report is committed `--no-timestamp` and regenerated with the plan | checking-plan-readiness | `specs/settle-up/readiness.md` (generated) | `trace --readiness specs --check` in CI | L3 tool |
| 10 | **Gate 1, spec-approval**: epic draft → approved → in-progress; tasks spec-draft → ready | — | `spec.md`, task files | spec-approval · dana | L2 |
| 11 | Pin the harness (local, `main`@f88aec2) and Skilldex (`fc572b6`) | adopting-harness | `toolkit.lock` | `lock --check` in CI | L2 → L3 |
| 12 | Delegate: GRANT-1 (select-tasks, approve-plan, dispose-findings; 3 workers; SPLIT-1 excluded) and GRANT-2 (merge into `integration/settle-up` only); both expire 2026-10-27 | delegating-authority | `.orchestrator/grants/GRANT-{1,2}.yaml` | issued · dana | L4 |

The L1 policy predates the epic: dana wrote it once for her machines (adopting-harness,
handling-credentials) and compiles it per engine; nothing in the product reads it.

### Build the skeleton, supervised — 2026-10-14

| # | When | Step | Skill | Artifact | Gate · passed by | Attention | Layer |
|---|---|---|---|---|---|---|---|
| 13 | 08:30 | dana claims SPLIT-1: risk high never runs unattended; worktree slot 0 on the workstation | managing-worktrees | SPLIT-1 → in-progress; record `resources` | — | working | L1 `workstation` (auto-edit) |
| 14 | 12:52 | Skeleton built in her session; tests named `SPLIT-1 AC-n`; draft PR #1 | implementing-task, writing-tests | `tests/skeleton.test.ts`; → review | — | working | L2 |
| 15 | 13:34 | Evaluator passes 3c9a1f4 (k = 2), including ADR-0001's tenancy probe | verifying-work | `.agent/verdicts/SPLIT-1-3c9a1f4.md`; run record 1 (role evaluator, outcome `verdict`) | independent verification · tally-evaluator | working | L1 `ci` |
| 16 | 14:01 | **Gate 2, pr-approval**: dana approves; the merge agent lands on `main` after merged checks; staging serves the image by digest (AC-4, AC-5) | landing-changes, releasing-changes | → human-review → merging → **merged** | pr-approval · dana | complete | L4 merge role |
| 17 | 14:31 | Cleanup audit passes; worktree removed | managing-worktrees | record `resources.audit`, `worktree_removed_at` | — | complete | L4 |
| 18 | 14:40 | `integration/settle-up` created from `main`@7e21c0b, protected, required checks on | landing-changes | the branch | — | — | L2 forge |

### The unattended phase — 2026-10-15

The coordinator wakes on events and a cheap check-in timer, reads the task files, PRs and returns
(never a wake alone), and acts only where a role or a grant lets it.

| # | When | Step | Skill | Artifact | Gate · passed by | Attention | Layer |
|---|---|---|---|---|---|---|---|
| 19 | 08:00 | Check-in: SPLIT-2 and SPLIT-4 ready, deps merged, lanes disjoint → dispatch both (2 of 3 workers); SPLIT-3 waits on the migrations lane | orchestrating-work, routing-models | claims by tally-coder (compare-and-swap); records SPLIT-2, SPLIT-4 | — (dispatching ready work in priority order is mechanical; GRANT-1's `max_workers` caps it) | SPLIT-2, SPLIT-4 working | L4, L1 `devbox` |
| 20 | 08:23 | SPLIT-4's run wants `psql` on its worktree database; `ask` under `dontAsk` is a **denial**; the run hands back instead of working around it | implementing-task, reporting-state | return `SPLIT-4-author-denied.json`; run record 2: stalled, `permission_denials: 1`; status stays in-progress | — | SPLIT-4 **needs-human** (phone push) | L1 `ci` ask → L4 |
| 21 | 08:31 | SPLIT-2 draft PR #2 at a41c9e2; the author's return says complete | implementing-task, writing-tests | return `SPLIT-2-author-a41c9e2.json`; run record 3; → review | — | working | L4 |
| 22 | 09:01 | **Evaluator rejects** a41c9e2: two identical submits racing both stored (AC-1) | verifying-work | verdict and return `SPLIT-2-evaluator-a41c9e2.json`; run record 4: `verdict` | independent verification failed · tally-evaluator | working | L1 `ci` (Gemini) |
| 23 | 09:02 | Findings disposed: the race to the author now, a missing index to Working notes as a follow-up | orchestrating-work (resolving-findings) | SPLIT-2 Working notes; record `decisions` | dispose-findings · GRANT-1 | working | L4 |
| 24 | 09:24 | Author fixes it: unique index in `migrations/0002`, a race test; d8f03b7 | implementing-task | run record 5; → in-progress → review | — | working | L4 |
| 25 | 09:53 | Evaluator passes d8f03b7. **Its done wake is lost**; the events-lost notice (10:06) makes the coordinator read a snapshot and the verdict file (10:07) | verifying-work, reporting-state | `SPLIT-2-evaluator-d8f03b7.json`; run record 6; record `signals` | independent verification · tally-evaluator | working | L4 |
| 26 | 10:10 | The coder marks PR #2 ready: checks green, criteria met and named in tests, the evaluator's pass on this head (GRANT-1 holds no finalize) | implementing-task | run record 7; → human-review | — | working | L4 |
| 27 | 10:25 | **Gate 2 under a grant**: the coordinator approves (independent review and required checks on d8f03b7), rebases, re-runs checks on the merged result, integrates by merge commit | landing-changes (tier 2) | → merging → **integrated**; record `decisions` | pr-approval · coordinator under GRANT-2 | SPLIT-2 **complete** | L4 |
| 28 | 10:28 | SPLIT-3 dispatched: SPLIT-2 is integrated in the same epic, which counts; a reader maps the ledger first | orchestrating-work | claim; return `SPLIT-3-reader-ledger.json`; run record 8: the reader's, outcome `read`, status unchanged | — (mechanical dispatch, as in step 19) | SPLIT-3 working | L4 |
| 29 | 10:45 | SPLIT-2's cleanup audit is blocked: its dev server still listens on 4511 | managing-worktrees | record `resources.audit` (blocked) | — | complete | L4 |

### The snapshot — 2026-10-15 11:00

| Task | Status (task file) | Attention (task record) | Why they differ |
|---|---|---|---|
| SPLIT-1 | merged | complete | they agree |
| SPLIT-2 | integrated | complete | dana's merge of the integration branch is a gate the status already shows; attention flags what she must act on now (attention.yaml) |
| SPLIT-3 | in-progress | working | they agree |
| SPLIT-4 | in-progress | needs-human | a denial is a question for a human; it never moves the status |

### Learn — 2026-10-15

| # | Step | Skill | Artifact | Decided by |
|---|---|---|---|---|
| 30 | A model release: replay four of this epic's failures, ablate the reader and the evaluator's second trial; too few tasks to remove anything; walls not ablated | reviewing-harness | `harness-reviews/2026-10-15-model-5.6.md` | dana |
| 31 | Two deltas from the window: idempotency asserted on stored state under a race (accepted, a pull request on the harness, L3); an allow for `psql` (rejected: it widens an unattended agent's reach and would lose to the ask anyway) | reflecting-on-runs | `reflections/2026-10-15-settle-up.md` | dana |

### After the snapshot — replayed by `simulate.yaml`

| # | Step | Skill | Gate · passed by | Attention |
|---|---|---|---|---|
| 32 | dana answers SPLIT-4: read the schema in `migrations/0001_skeleton.sql`, no shell. The coordinator redispatches; evaluator pass; the coder marks ready; integrated under GRANT-2 | orchestrating-work, verifying-work, landing-changes | pr-approval · coordinator under GRANT-2 | needs-human → working → complete |
| 33 | SPLIT-3: draft PR, evaluator pass, ready, integrated | implementing-task, verifying-work, landing-changes | pr-approval · coordinator under GRANT-2 | working → complete |
| 34 | The coordinator opens `integration/settle-up` → `main` with the acceptance evidence, the grant ids and the disposed findings | landing-changes | — | complete |
| 35 | **Tier 3**: dana reviews and merges the integration branch into `main`, then records `promote` for SPLIT-2..4 (integrated → merged) and `finish` on the epic | landing-changes | pr-approval of the integration PR, then promote · dana (promote is never grantable) | complete |
| 36 | Next, outside this example: production release by the train | releasing-changes | **gate 3**, production-release · dana | — |

## The faults the scenario replays

| Walkthrough step | `simulate.yaml` | The invariant that would catch a wrong handling |
|---|---|---|
| 20, 32: the unattended `psql` ask | `faults.ask` on SPLIT-4, policy tier `unattended` | `asks-surface-to-human`, `no-progress-stops`, `stalls-surface` |
| 22, 24: the evaluator rejects the first head | `faults.evaluator_rejection: { SPLIT-2: 1 }` | `guards-hold` (independent-verification), `merge-requires-authority` |
| 25: the lost wake | `faults.lost_events` (a tenth of the wakes, some with no notice) | `signals-never-advance-workflow`, `stalls-surface` |
| 27, 32-35: the integration-branch flow | GRANT-1 and GRANT-2 verbatim (GRANT-1's three workers and $30 bound the run; merge authority comes from GRANT-2 alone); `merge.queue_targets: [main]`; `human.on_integration: merge` | `merge-requires-authority`, `transitions-allowed`, `human-gates-by-humans` |

Every seed of the fifty integrates SPLIT-2..4 under GRANT-2 and ends with dana promoting all three,
with zero violations; `tests/example.test.mjs` checks that each fault actually fired.
