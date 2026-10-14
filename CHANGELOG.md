# Changelog

Every change to the harness, newest first, in the shape of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each entry is marked with its class:
**additive** (a new optional field, contract, tool or page; nothing that was valid becomes invalid),
**behavioral** (the same artifacts, judged or run differently: a stricter check, a new invariant, a
changed default) or **breaking** (a valid artifact becomes invalid, or a field or rule is removed).
Contract versions are each schema's `x-version` and each state machine's `version`
(CONTRACTS.md, Versioning). The harness is pre-1.0: pin a commit.

## [Unreleased]

Fixes from an independent review of 0.1.0 (workflow, authority, trace, simulator, skills, docs).

### Changed

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

### Added

- **additive** — `simulate --supervisor <module>`: runs a runtime's own supervisor against every
  invariant, so a binding can be tested; TOOLS.md documents the api it is given.

- **additive** — `trace --readiness <dir> --check`: regenerates each committed readiness report in
  its `--no-timestamp` form and fails on one that is missing, stale, timestamped or names no epic.
- **additive** — `CHANGELOG.md`.

### Fixed

- Citations of agentic-template ADR-0021 and `scripts/permission-probe.mjs` name the branch and
  commit that hold them (`docs/adr-permission-precedence`, `c177fa1`), not master.
- The README no longer claims that no file outside `adapters/` names an engine; it says where engine
  names appear and why.
- delegating-authority lists every never-grantable id `authority.yaml` holds (`promote-integration`,
  `answer-input-request` were missing); a docs test keeps the two in step. Version labels in the
  skills' references state the current contract and machine versions (a docs test checks every
  "`<name>` contract X.Y.Z" label). The Tally walkthrough no longer files routine dispatch under
  `select-tasks`: dispatching ready work in priority order is mechanical.

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
