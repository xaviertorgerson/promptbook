# promptbook

The suite's master copy (formerly harness): in a theatre, the promptbook is the stage manager's copy
of the play with every cue in it, and everyone follows it. promptbook is one of five repositories
that make the suite; each has one job and touches the others only through the interfaces in
[SUITE.md](SUITE.md), always at a pin.

## Mandate

| | |
|---|---|
| **One job** | The master copy: the shared file formats, the engineering standards, the playbook, and the tools that check them. |
| **Owns** | [`standards/`](standards/engineering.md), [`playbook/`](playbook/00-index.md), `schemas/`, `state-machines/`, `adapters/`, `tools/` (validate, trace, lint, compile-policy, lock, run, check-requires, report, simulate, eval-routing, import-evals, grant), [`examples/`](examples/tally/WALKTHROUGH.md), [`SUITE.md`](SUITE.md). |
| **Must not contain** | Skills (all live in Skilldex), runtime coordination (stagehand), any stack (stagecraft's sets). |
| **Interface** | JSON Schemas and the `promptbook` CLI (`package.json` `bin`: `tools/cli.mjs`); SUITE.md. |
| **Versioning** | Semver tags, pre-1.0: pin a commit and tree in `toolkit.lock` (kind `promptbook`). Each schema carries its own `x-version` and each state machine its `version`; every change is classed additive, behavioral or breaking in [CHANGELOG.md](CHANGELOG.md). |
| **Consumers** | stagecraft (the gates in CI, `lock`), dotfiles (`compile-policy`, the standards block), Skilldex (`lint` and `eval-routing` run against it). promptbook reads stagehand's task records; stagehand depends on none of it. |

The thesis, from the research behind it: engineer the setup around the model, not the swarm. Keep
one writer per change, parallel readers, and a separate judge; keep state in files and git; load
context only when needed; enforce rules with walls instead of prose; and delete scaffolding as models
improve. The practices and the standards name no engine, runtime, forge or stack. Names appear only
where a binding or a fact needs them: `adapters/`, evidence lines that cite a vendor, the signal
vocabularies `state-machines/attention.yaml` maps, optional contract fields that record which engine
or runtime ran, and the policy compiler's per-engine emitters. promptbook depends on nothing.

## The layers and the suite

| Layer | Lives in | Decides |
|---|---|---|
| L1 personal | dotfiles | how often an agent asks: the autonomy tier per machine, taste, installed agents and runtimes, the personal skill set, secrets wiring |
| L2 project | each product repo, started from stagecraft | what is never allowed: walls, the task queue, product docs, ADRs, `toolkit.lock` |
| **L3 shared** | **promptbook** (formats, standards, checks) and Skilldex (skills) | the contracts every layer speaks, and the procedures every agent loads |
| L4 implementations | stagecraft's sets, stagehand, the loop and CI agents, the engines | how much a run may spend, and every binding to a specific engine, stack or runtime |

L1, L2 and L4 depend on a pinned L3; L2 selects its L4 set through `toolkit.lock`. Where every
artifact goes, and how the repositories moved there, is [LAYERS.md](LAYERS.md).

## Use it

**A machine (dotfiles).** Pin promptbook and Skilldex by commit; render the standards block from
`standards/engineering.md` into the global instruction file; write `agent-policy.yaml` against
`schemas/policy.schema.json` (tiers per machine profile, `deny_read`, `forbid`, `ask`, `egress`,
budgets) and compile it per engine with `promptbook compile-policy`, which refuses a tier that
disables hooks and a bypass tier that names no `requires` (the preconditions it relies on, such as
production being unreachable from the host). Install Skilldex's `personal` set, never the whole
library: `promptbook lint --budget-set personal --sets <skilldex>/skills/SETS.yaml` checks it with
what else loads.

**A project (stagecraft).** A `toolkit.lock` pins promptbook (kind `promptbook`) and Skilldex (kind
`skill-library`, with the install `sets` it copies); `promptbook lock --check` fails CI on drift. The
template sync renders the standards block into `AGENTS.md` and keeps the walls current.
`promptbook validate` checks the queue and product artifacts against the schemas, and
`promptbook trace . --readiness specs --check` the trace graph from brief to test names and the
committed readiness reports. A project that lets changes land on green checks records its trust
profile in `governance.yaml` (`solo`, `team` or `regulated`, with the ADR that chose it): the forge's
risk gate reads it, and the workflow's `auto-land` is the only way a change reaches the protected
branch without a human's approval.

**A runtime (stagehand, the loop, CI agents).** It binds through `adapters/<name>/`. One that adopts
promptbook's formats reads `task` files, writes `task-record` and `run-record`, maps its own signals
to the `attention` machine, honors `grant`s (checked with `promptbook grant verify`), and never
advances workflow status on a runtime signal. stagehand keeps its own task records, which the
`task-record` contract reads as they are, records a delegation as a project note, and follows a
project's own instructions for its queue ([adapters/herdr](adapters/herdr/README.md)). `promptbook simulate --supervisor <module>` runs a runtime's own supervisor against
every invariant; without the flag the simulation runs promptbook's reference coordinator, the
protocol the state machines describe, as code.

**The skills (Skilldex).** `promptbook lint <skilldex>/skills` checks every skill against the
authoring rules and every install set against the 8,000-character always-loaded description budget
with 10% headroom; `promptbook eval-routing` measures routing, `--set <name>` with only that set
installed.

## Core vs optional

The core is what every adopter uses; the rest is for a scale or a moment that not every project
reaches, and stays out until its trigger holds.

| | Core | Optional, and when |
|---|---|---|
| Practice | `standards/engineering.md`; the playbook pages you cite | — |
| Contracts | task, epic, decision, readiness-report; brief, persona, journey, requirement and ux-flow when a product is planned (without a brief the trace check runs as legacy adoption); policy and toolkit-lock; return and run-record; skill and evidence | governance: a project lets some changes land on green checks without a human's approval. grant and task-record: a coordinator runs several agents under delegated authority. agent-setup-review and reflection-report: there are runs to review |
| Tools | `validate` (with `trace` and `--readiness --check`), `compile-policy`, `lock` | `lint` and `eval-routing`: a skill or a set changes. `simulate`: changing the state machines, or checking a runtime's supervisor. `grant`: grants are in use. `import-evals`: once, porting a project's skill to Skilldex. `report`: there are run records to read. `run`, `check-requires`: unattended or bypass profiles |
| Engines | the adapter of the engine you run | every other adapter; only one engine's permissions are measured (Status) |

### Minimum adoption for one developer

1. **Machine.** The dotfiles pin promptbook and Skilldex, render the standards block, compile one
   policy profile per machine (`promptbook compile-policy`) and install Skilldex's `personal` set.
2. **Each repository.** A `toolkit.lock` checked by `promptbook lock` in CI; tasks as
   `specs/<epic>/tasks/<ID>.md` with acceptance criteria, and `promptbook validate` plus
   `promptbook trace . --readiness specs --check` in CI.
3. **Each task.** One writer at a time, with Skilldex's delivery set: implementing-task claims and
   builds it, verifying-work gives the separate verdict, landing-changes lands it after your
   approval, or on green checks and that verdict where the repository's trust profile
   (`governance.yaml`, `trust: solo`) permits it. No coordinator, grants, task records or simulator.

Add the rest when its trigger fires: stagehand and grants when you hand agents a batch of tasks to
run without you; the reflection and review records once there are runs to learn from.

## Repository map

| Path | What |
|---|---|
| [`SUITE.md`](SUITE.md) | the five repositories' mandates, their four interfaces, and the path from a new machine to a first feature |
| [`playbook/`](playbook/00-index.md) | the latest practices, one page each, dated and cited; planning, execution, runtime, learning, methodology |
| [`standards/engineering.md`](standards/engineering.md) | the shared engineering and agent-setup invariants, each with how it is enforced |
| [`LAYERS.md`](LAYERS.md) | where every artifact lives, the precedence rule, and where each repository's pieces moved |
| [`CONTRACTS.md`](CONTRACTS.md) | the contract catalogue, who writes each artifact, ids and the trace graph |
| `schemas/` | JSON Schema 2020-12, one per contract |
| `state-machines/` | `workflow`, `attention` and `authority` |
| `adapters/` | thin, documented mappings to engines, runtimes and CI |
| `tools/` | `validate` (and `trace`), `simulate`, `compile-policy`, `run`, `check-requires`, `lock`, `grant`, `lint`, `eval-routing`, `import-evals`, `report` (Node 22; [TOOLS.md](TOOLS.md)) |
| `tests/`, `fixtures/` | `node --test` suites and valid/invalid examples per contract |
| [`examples/`](examples/tally/WALKTHROUGH.md) | a worked product run through every contract: Tally, from brief to the human merging its integration branch |
| `CHANGELOG.md` | every change, marked additive, behavioral or breaking |

## Status

**Pre-1.0.** The playbook is as of 2026-10-14. Contracts may change between minor versions until 1.0;
each change is logged in `CHANGELOG.md` with its class. Pin a commit, not a branch. Only one engine's
permission behavior has been measured (Claude Code 2.1.296: agentic-template ADR-0021 and
`scripts/permission-probe.mjs` on branch `docs/adr-permission-precedence`, commit `c177fa1`, not yet
on master); the other adapters are written from documentation and marked unverified where it matters.

## Contributing a playbook change

1. Open a pull request that edits the page and adds or updates an **Evidence** line: date, source
   URL, and a tag (controlled, standard, vendor, self-reported, practitioner, secondary, measured,
   practice, recommendation). No source, no change; quotes under 15 words; vendor numbers tagged as vendor.
2. Keep the page under about one printed page and in the six-section shape. Practice text names no
   engine or vendor; bindings go in `adapters/`.
3. If the practice changes a contract, change the schema, fixtures and tests in the same pull request.
4. Add a `CHANGELOG.md` line and bump the playbook's "as of" date. Deleting a practice that no longer
   pays its way is a welcome change; the [agent-setup review](playbook/learning/agent-setup-review.md)
   is how those deletions are found.

A change to a skill is a pull request to Skilldex, a change to coordination one to stagehand. The
research this repo was built from is "Agentic orchestration patterns 2026" (2026-10-12) and its
notes; every page cites the primary sources directly.
