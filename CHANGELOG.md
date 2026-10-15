# Changelog

Every change to promptbook (formerly harness), newest first, in the shape of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each entry is marked with its class:
**additive** (a new optional field, contract, tool or page; nothing that was valid becomes invalid),
**behavioral** (the same artifacts, judged or run differently: a stricter check, a new invariant, a
changed default) or **breaking** (a valid artifact becomes invalid, or a field or rule is removed).
Contract versions are each schema's `x-version` and each state machine's `version`
(CONTRACTS.md, Versioning). promptbook is pre-1.0: pin a commit.

## [Unreleased]

### Final pass

Trust profiles, a standards block that holds in every profile, and the contracts adapted to the
tools other maintainers already run (stagehand's task records and delegation, Skilldex's skills).

#### Added

- **additive** — The `governance` contract 1.0.0 (`governance.yaml`): a project's recorded trust
  profile, `trust: solo | team | regulated`, with the ADR that chose it and its reversal trigger,
  `auto_land.max_risk` (absent: solo medium, team low, regulated none; never high or irreversible),
  `protected_paths`, `ui_paths`, `visual_check`, `production`, `signed_commits`, `attestations`;
  rules `auto-land-within-profile`, `regulated-evidence`, `continuous-deploy-solo-only` and
  `governance-protects-itself`. The Tally example records its profile (`solo`, ADR-0005).
- **additive** — workflow 1.6.0: `auto-land` (`human-review` → `merged`, by the merge role, never
  grantable) lands a change with no human approval where the trust profile permits it, guarded by
  `trust-permits`, `checks-green`, `independent-verification`, `no-protected-path`,
  `visual-checked`, `lands-on-protected`, `mechanical-only` and `merged-checks-green`; status
  authority `auto-land-is-the-platforms`. A project without `governance.yaml` behaves as before.
- **additive** — `simulate`: a scenario's `governance` (validated), the platform's risk gate and
  visual check, the scenarios `trust-solo`, `trust-team` and `trust-regulated`, the mutation
  `orchestrator-auto-lands` and six broken risk-gate bindings, each caught.

#### Changed

- **behavioral** — `simulate`: `merge-requires-authority` refuses any land without green checks and
  the evaluator's pass on the landed head, on every path (approval, grant or auto-land), and judges
  an auto-land against the recorded profile, never the platform's gate.
- **additive** — task-record 1.4.0: any top-level key a runtime adds is accepted as its own
  evidence (stagehand's records name their result, reviewed heads, feedback and human decisions as
  they choose); the named fields stay typed, nested objects stay closed.

#### Fixed

- **additive** — The docs say what stagehand does, not what promptbook once asked of it: it keeps
  its own task records (the `task-record` contract reads them), records a delegation as a project
  note, follows a project's own instructions for its task queue, and writes none of promptbook's
  optional `reviews`, `decisions`, `grant` or `signals` (adapters/herdr, CONTRACTS.md, SUITE.md,
  README.md, LAYERS.md).
- **behavioral** — The stagehand compatibility test checks a record filled from his
  `assets/task-record.yaml` (`fixtures/valid/task-record/stagehand-development.yaml`, now with
  `development_target` and `state.next_role`) and that it fills every key the template names; it no
  longer validates the template's placeholders, nor a grant template stagehand does not ship.

### promptbook: one job in a suite of five repositories

The harness is renamed **promptbook** and becomes the suite's master copy of formats, standards,
playbook and checks; it holds no skills. The suite's five repositories, their mandates and the four
interfaces between them are in [SUITE.md](SUITE.md).

#### Changed

- **breaking** — The product, the package and its bin are `promptbook` (still `tools/cli.mjs`):
  every usage text, error message and test, the schema ids (`https://promptbook.dev/schemas/…`),
  the generators (`promptbook/lock@1.0.0`, `promptbook/validate@…`), the lock cache
  (`~/.cache/promptbook/lock`) and the test variables (`PROMPTBOOK_DOTFILES`,
  `PROMPTBOOK_DOTFILES_L1_POLICY`, `PROMPTBOOK_STAGEHAND`, `PROMPTBOOK_TEMPLATE`,
  `PROMPTBOOK_SMOKE_PROJECT`).
- **breaking** — `compile-policy` outputs carry the new name: Codex's permission profile
  (`default_permissions = "promptbook"`, `[permissions.promptbook…]`) and rules file
  (`rules/promptbook.rules`), Gemini's policy file (`policies/promptbook.toml`), the forbid guard's
  home (`$HOME/.claude/hooks/promptbook/`, `$HOME/.codex/hooks/promptbook/`, status message
  "promptbook forbid guard"), `generated_by: promptbook compile-policy`, and the runner's
  `enforcement` value `promptbook-run`.
- **breaking** — toolkit-lock 2.0.0: the one L3 entry that is not a skill library is
  `kind: promptbook` (rule `exactly-one-promptbook`).
- **breaking** — the review record is `agent-setup-review` 2.0.0, named for the skill that writes
  it (Skilldex's reviewing-agent-setup): `agent-setup-reviews/<date>-<label>.md`, titled
  `# Agent-setup review — <date> — <label>`, with the section "Full setup on the new model"
  (`full-setup`); `*.agent-setup-review.md` outside that folder. The playbook page is
  `learning/agent-setup-review.md`.
- **breaking** — `lint` no longer knows five Skilldex skills by name: a near-miss may route to a
  scanned skill, a sibling, a skill of the `--sets` library, an `external` of the library's or the
  `--sets` `SETS.yaml`, or `--known`. A set name in `--budget-set` is read from `--sets`, the linted
  library's `SETS.yaml` (in its skills folder or at the root above it), or `./SETS.yaml` or
  `./skills/SETS.yaml`; this repository has none to fall back on.
- **behavioral** — `grant verify` reports each grant's lifecycle state (`(live)`, `(pending)`,
  `(expired)`, `(revoked)`) and fails one that is not live (`grant-is-live`); `--at <time>` checks
  another moment. It printed "(live)" for any grant whose path and owners checked out.
- **behavioral** — `simulate`: the built-in supervisor is the reference coordinator
  (`reference-coordinator` in summaries), the protocol the state machines describe.
- **behavioral** — a narrowing may set a limit or an expiry the grant did not have; an unset limit
  is no limit, so setting one narrows (it was reported as widening).
- **behavioral** — authority 1.4.0: a grant needs an expiry unless a stop condition bounds it; a
  grant with neither is invalid.
- **behavioral** — `lint` no longer warns `description-budget` on a library that has its own
  `SETS.yaml`: nothing installs a library whole, and each of its sets is already checked against
  the budget (`set-over-budget`). A folder without one (a project's installed skills) still warns.
- **behavioral** — `lint` checks a library's `.claude-plugin/marketplace.json` against its
  `SETS.yaml` when both exist (`marketplace-sets`): one plugin per installable set, each listing
  exactly that set's skills, so the two cannot drift apart.
- **behavioral** — `trace --check`'s "regenerate" hint repeats the `--tests` and `--test-pattern`
  options it was given, shell-quoted; without them the regenerated report counted other tests and
  failed the next check.

#### Added

- **additive** — `SUITE.md`: the five repositories' mandates (one job, owns, must not contain,
  interface, versioning, consumers), the four interfaces, the path from a new machine to a first
  feature, and the 2026 practice each mandate follows. The README opens with promptbook's mandate;
  LAYERS.md maps the layers onto the five repositories and gives every piece one home.
- **additive** — `lint --sets <file>` and `eval-routing --sets <file>`: the `SETS.yaml` of the
  library the linted skills install beside (Skilldex's).
- **additive** — toolkit-lock: a `skill-library` entry may name the install `sets` it copies
  (`sets-on-skill-library`); `lint --budget-set toolkit.lock` measures exactly those sets
  (`budget-set-sets`).
- **additive** — grant 2.1.0: a grant whose `limits.stop_when` is non-empty may omit `expires_at`
  and `limits.budget` (`grant-is-bounded`, which replaces `missing-expires-at` for a grant with
  neither), so a coordinator records only what the human said.
- **additive** — run-record 1.4.0: `task` may be the runtime's stable id when the work has no
  workflow task, as `task-record.task_id` and `return.task` already accept.
- **additive** — a test validates stagehand's task-record and grant templates as they are, when a
  stagehand checkout is present; CONTRACTS.md names who writes each artifact across the suite.

#### Removed

- **breaking** — `skills/`: the 28 skills, their evals, `SETS.yaml`, `ROUTING-RESULTS.md` and the
  routing results moved to Skilldex; the coordination skills were folded into stagehand. The
  adapters' `plugin.json` manifests, which packaged those skills, are gone with them.

#### Migration

1. **Where each skill went.** To Skilldex `skills/`: framing-products, defining-personas,
   mapping-journeys, writing-requirements, designing-flows, choosing-architecture, planning-work,
   checking-plan-readiness, implementing-task, managing-worktrees, verifying-work, landing-changes,
   handling-credentials, releasing-changes, writing-tests, debugging-failures,
   writing-commit-history, reviewing-security, evaluating-skills, promoting-learnings,
   reflecting-on-runs, choosing-methodology, routing-models; adopting-harness as
   setting-up-the-suite and reviewing-harness as reviewing-agent-setup. To stagehand's
   orchestrating-development and its references: orchestrating-work, delegating-authority,
   reporting-state. Install by Skilldex's sets (`skills/SETS.yaml`): `personal` on a machine,
   `planning` and `delivery` in a project, `maintainer` where the suite is maintained; the old
   `solo` is `personal` with `planning` and `delivery`, and the old `coordinator` set is stagehand's
   control workspace (orchestrating-development beside `personal`).
2. **The CLI.** Call `promptbook <command>`; a script that runs the pinned CLI finds it by the lock's
   `kind: promptbook` entry and a checkout named for it (`PROMPTBOOK_HOME`, `../promptbook`). Lint
   skills with `promptbook lint <skilldex>/skills` and a set with
   `promptbook lint --budget-set <set> --sets <skilldex>/skills/SETS.yaml`; a project's own skills
   beside Skilldex lint with `--sets` so their near-misses may name Skilldex's.
3. **`toolkit.lock`.** Rename the entry `name: harness, kind: harness` to `name: promptbook,
   kind: promptbook` with the promptbook checkout or URL as `source`, and re-pin it
   (`promptbook lock --update promptbook`). Pin Skilldex once, at the commit that holds the suite
   library, with `path: skills` and the `sets` the project installs, in place of any per-skill
   entries; drop entries that pinned this repository's skills.
4. **Compiled policy.** Recompile every profile, then delete the old files a consumer installed:
   `rules/harness.rules` and `policies/harness.toml` keep loading beside the new
   `rules/promptbook.rules` and `policies/promptbook.toml` until removed, and the guard moves from
   `hooks/harness/` to `hooks/promptbook/`. A launcher that reads `runner.json` reads
   `enforcement: promptbook-run`.
5. **Review records.** Move `harness-reviews/` to `agent-setup-reviews/` and retitle each record
   `# Agent-setup review — <date> — <label>`, its full-run section "Full setup on the new model".

### Review fixes

Fixes from an independent review of 0.1.0 (workflow, authority, trace, simulator, skills, docs).

#### Changed

- **behavioral** — `compile-policy` (Gemini): `argsPattern` (read denies, write denies, fetch
  domains) no longer quantifies a group. Gemini CLI 0.64.0 drops a rule whose pattern fails its
  ReDoS check, printing an error but still loading the rest, so each golden lost 8 of its 25 or 26
  rules, 6 of them denies. Path patterns now read the arguments as Gemini serializes them (each
  top-level pair between NULs), and the compiler refuses (`gemini-drops`) any pattern the same
  check rejects.
- **behavioral** — `compile-policy` (Codex): an MCP tool deny (`forbid`, and unattended an `ask`) is
  no longer a `[mcp_servers.<id>] disabled_tools` table in `config.toml`, which Codex 0.162.1
  refuses to load without the server's transport (`command` or `url`), which the policy does not
  hold. It is written to `mcp-restrictions.toml`, to be merged into the entries that define those
  servers, with a report note; since it holds only once merged, it is now a `forbid` (or `ask`) gap
  that fails the compile until accepted. The `merge-mcp` warning is gone.
- **behavioral** — `compile-policy` (Codex): a write deny on a glob no longer emits
  `"<glob>" = "read"`, which Codex 0.162.1 refuses to load (a glob takes only `deny`). `**` is the
  workspace root `"."`; `**/<literal>/**` and `**/<literal>` are emitted as `<literal>/**` /
  `<literal>` with a `glob-top-level-only` warning (a copy below a workspace root stays writable);
  any other glob is a `forbid` gap (unattended, an `ask` gap) that fails the compile until accepted,
  and nothing is emitted for it. An allow write or a `sandbox.writable_roots` entry that is such a
  glob is dropped with a warning; `docs/**`-style allow writes are now emitted. The Tally reader's
  `"**" = "read"` became `"." = "read"`.
- **behavioral** — `validate --contract` binds nothing from a `_`-prefixed file or folder name, so a
  template such as `docs/ux/_UX-TEMPLATE.md` is validated on its content, not failed for its name.
- **behavioral** — `trace`: a test that never runs evidences no criterion. Comments are blanked
  before test names are read; JS/TS `it.skip`, `test.todo`, `describe.skip` (with the tests it
  holds), their `.each`, `xit`/`xtest`/`xdescribe` and `{ skip }`/`{ todo }` options are dropped;
  Rust counts only `fn`s under a test attribute and never an `#[ignore]`d one; Python reads `id=`
  only inside `pytest.param(…)`.
- **behavioral** — `trace`: an explicit `--tests` glob that matches nothing is an error, and with no
  test file at all `tests-exist` is a blocking error once a task is at review or later (its criteria
  are reported uncovered), so a merged task with no test never reads ready.
- **behavioral** — attention 1.3.0, authority 1.3.0: a human answers an A2A `INPUT_REQUIRED` or an
  MCP `input_required`; no grant delegates it (`answer-input-request` is never grantable).
- **behavioral** — `simulate`: readers (the helpers an author starts) count toward the workers cap,
  as orchestrating-work says, and the runtime refuses a reader when every slot is taken; a guard
  the simulator has no evidence model for throws instead of passing; new mutation
  `uncounted-readers` (caught by `cap-workers`).
- **behavioral** — workflow 1.5.0 `status_authority`: a claim creates the task branch on the remote
  (the rejected new-ref push is the compare-and-swap; a task is claimed iff its branch or an open PR
  exists); in-flight status lives on the task branch and the default branch's copy says `ready`
  until the task lands; approve-pr is a forge event bound to the PR head and the branch's version
  (any later commit voids it), never a commit; only the landing actor writes `merged` or
  `integrated`, on the target, inside the merge; `deps-merged` reads the dependent's own target;
  humans win by editing the task branch head. The simulator models remote refs to match, with two
  new invariants (`approval-bound-to-head`, `status-where-it-lives`), a claim check in
  `one-owner-per-claimed-task`, and three new mutations (`claim-on-default`,
  `terminal-on-task-branch`, `land-on-stale-approval`); task records carry reviews, verdicts and
  approvals bound to heads. Skills (implementing-task, landing-changes, orchestrating-work,
  managing-worktrees, reporting-state), the playbook and the Tally example say the same.
- **breaking** — grant 2.0.0: `narrowed[]` entries are structured (`remove_actions`,
  `remove_scope`, `reduce_limits`, `reason`; the free-text `change` is gone) and only narrow
  (`narrowing-only-narrows`); the issued fields stay as issued and the grant in force is the issue
  minus every entry. A live grant is committed by `granted_by`, a human owner of the
  CODEOWNERS-protected `.orchestrator/grants/`; agents write only `.orchestrator/grants/drafts/`
  (validated as grants, never live). Migrate a narrowed grant by restoring its issued `actions` and
  `scope` and writing each removal as a `remove_actions` or `remove_scope` entry.
- **breaking** — grant 2.0.0, authority 1.3.0, workflow 1.4.0: a merge grant names the repository's
  `protected_branch` and its `target` may never be it (`merge-target-not-protected`). `land` onto
  the protected branch is the merge role's alone, after a human's approval, and never grantable; a
  grant's `approve-pr` carries `lands-on-integration`. Migrate a grant by adding
  `protected_branch: <default branch>` to its merge action and pointing `target` at the epic's
  integration branch. The simulator refuses such a grant (and one naming another protected branch
  than the scenario's); new mutation `grant-covers-protected`.
- **behavioral** — workflow 1.3.0: every task needs the evaluator's verdict on its current head
  before `human-review` (`independent-verification`; risk sets the trials and the model family, not
  whether it runs). `independent-review` is the reviewer role's pass on the current head, required
  where a merge grant approves (`approve-pr` grant guards now also carry independent-verification);
  authority's `finalize` waits for the verdict. The simulator models the reviewer (it reviews every
  pushed head; `reviewer.minutes`, `reviewer.reject_rate`), filters reviews by role, and the new
  mutation `approve-over-reviewer` (approving on the evaluator's pass while the reviewer requested
  changes) is caught by `guards-hold` and `merge-requires-authority`.
- **behavioral** — workflow 1.2.1: `released` is not a terminal state (roll-back leaves it); a test
  holds every terminal state to having no transition out.

#### Added

- **additive** — playbook `runtime/observability.md`: what to look at weekly (cost per merged task,
  cache hit rate, denial count, stalled and needs-human runs) from `harness report`; the hit rate's
  denominator is all input, cached included; a measured line on the CLI's usage fields.
- **additive** — `harness report [file|dir]... [--since <date>] [--json]`: totals run records per
  task, per role and overall (runs, outcomes, turns, cost, input and output tokens, cache hit rate,
  denied calls) and lists the three most expensive runs; each line is validated first, and an
  invalid one is skipped and listed, never counted.
- **additive** — run-record 1.3.0: optional `usage` (`input`, `output`, `cache_read`,
  `cache_write`; null when the result reported none), whole tokens over every model the run called,
  as agentic-template's loop now records them from the result's `modelUsage`; rule
  `usage-counts-tokens`; fixture `loop-mjs-usage.jsonl` from the loop itself.
- **additive** — `tests/gemini-load.test.mjs`: the real Gemini CLI (`GEMINI_BIN`, or `gemini` on
  `PATH`; skipped without one) loads every committed Gemini `settings.json` and `policies/harness.toml`
  and each fresh compile of the fixture policies with `gemini mcp list` in a scratch
  `GEMINI_CLI_HOME`, and fails on any refused setting or dropped rule in its output.
- **additive** — `tests/codex-load.test.mjs`: the real Codex CLI (`CODEX_BIN`, or `codex` on `PATH`;
  skipped without one) loads every committed Codex `config.toml` (goldens, the Tally example, the
  dotfiles' compiled output when present) with `codex features list` in a scratch `CODEX_HOME`,
  every rules file with `codex execpolicy check` (the committed ones must forbid a force-push), each
  fresh compile of the fixture policies as written and with every gap accepted, and each
  `mcp-restrictions.toml` merged into a defined server.
- **additive** — `harness grant verify <file> [--git]`: a grant's provenance and narrowing, checked
  before acting under it (owners from CODEOWNERS or `--owners`, the committing human, issued fields
  as first committed, append-only narrowing, a source commit that exists). The Tally example gains
  the CODEOWNERS rule its grants verify against.
- **additive** — `simulate --supervisor <module>`: runs a runtime's own supervisor against every
  invariant, so a binding can be tested; TOOLS.md documents the api it is given.
- **additive** — `trace --readiness <dir> --check`: regenerates each committed readiness report in
  its `--no-timestamp` form and fails on one that is missing, stale, timestamped or names no epic.
- **additive** — `CHANGELOG.md`.
- **additive** — install sets (`skills/SETS.yaml`): `personal` (user scope), `planning`, `delivery`,
  `coordinator`, `maintainer` (project scope), `solo` (personal, planning and delivery at user scope)
  and `full` (the library, never installed). `harness lint` checks every installable set, with what
  loads beside it (the five Skilldex skills at their pinned commit), against 8,000 characters less
  10% headroom (`sets-shape`, `sets-known`, `sets-disjoint`, `sets-cover`, `set-over-budget`,
  `set-not-installed`); `--budget-set` also takes a set name, and `--external name=<dir>` reads a
  pinned pack's real descriptions. The README gains Core vs optional and the minimum adoption for
  one developer.
- **additive** — `eval-routing --cases <file>` (another cases file per skill) and `--set <name>`
  (install only that set); 84 held-out routing cases (`evals/heldout.routing.jsonl`, three per
  skill, written after tuning); the per-case results of the tuned run and both held-out runs
  (`skills/routing-results*.jsonl`).

#### Fixed

- Citations of agentic-template ADR-0021 and `scripts/permission-probe.mjs` name the branch and
  commit that hold them (`docs/adr-permission-precedence`, `c177fa1`), not master.
- The README no longer claims that no file outside `adapters/` names an engine; it says where engine
  names appear and why.
- delegating-authority lists every never-grantable id `authority.yaml` holds (`promote-integration`,
  `answer-input-request` were missing); a docs test keeps the two in step. Version labels in the
  skills' references state the current contract and machine versions (a docs test checks every
  "`<name>` contract X.Y.Z" label). The Tally walkthrough no longer files routine dispatch under
  `select-tasks`: dispatching ready work in priority order is mechanical.
- skills/ROUTING-RESULTS.md reports the held-out pass rate apart from the tuned cases' (pass^3:
  80/84 with every skill installed, 14/15 with the personal set and Skilldex, against 341/344 on the
  tuned cases), and every measured routing entry's source is the exact command, with the runner
  printed in evaluating-skills/references/engine-notes.md, not a placeholder.

## [0.1.0] - 2026-10-13

The first release: everything below is **additive**.

### Added

- **Playbook** (as of 2026-10-13): proportional planning, execution, runtime, learning and
  methodology pages, each dated and cited, with an index and review cadence.
- **Standards** (`standards/engineering.md`): the shared engineering and harness invariants, each
  with how it is enforced, rendered into L1 and L2.
- **Layers guide** (`LAYERS.md`): where every artifact lives, the precedence rule and the move from
  today's repositories.
- **Contracts**: JSON Schema 2020-12 for brief, persona, journey, requirement, ux-flow, decision,
  epic, task, readiness-report, task-record, return, run-record, grant, policy, toolkit-lock,
  skill, evidence, harness-review and reflection-report, with valid and named invalid fixtures; the
  `workflow`, `attention` and `authority` state machines (integration branches, orchestrator
  landing under a merge grant, the evaluator role and independent verification).
- **Tools** (`harness <command>`): `validate` and `trace` (the trace graph from brief to test
  names, plan-shape rules, readiness reports with the source commit or `--no-timestamp`),
  `simulate` (a seeded discrete-event model of the runtime contracts with 18 invariants and
  mutation tests), `compile-policy` (the L1 policy per engine, failing closed, with `report.json`),
  `lock` (pin and verify `toolkit.lock` with git plumbing), `lint` (the skill authoring rules and
  `--budget-set`), `eval-routing` and `import-evals`.
- **Skills**: 28 portable skills (planning, delivery, coordination, learning) with routing cases,
  scenarios and evidence; routing measured against the catalog with a clean-context runner.
- **Adapters**: Claude Code, Codex, Gemini, Herdr and CI mappings.
- **Worked example** (`examples/tally`): one product from brief to the human merging its
  integration branch, kept valid, traced, simulated and compiled by the tests.
