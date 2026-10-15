# promptbook

The engine-neutral layer of a four-layer toolkit for agent-driven software work: a dated,
evidence-cited **playbook**, the **standards** every project and every personal setup share, the
**contracts** (schemas and state machines) that let engines, runtimes and methods be swapped, and
the **tools** that check all of it, skills included (the skills themselves live in Skilldex). The
practices and the standards name no engine, runtime, forge or stack. Names appear only where a
binding or a fact needs them: `adapters/`, evidence lines that cite a vendor, the signal vocabularies
`state-machines/attention.yaml` maps, optional contract fields that record which engine or runtime
ran, and the policy compiler's per-engine emitters. Promptbook depends on nothing.

The thesis, from the research behind it: make the harness, not the swarm, do the work. Keep one writer
per change, parallel readers, and a separate judge. Keep state in files and git, load context only
when needed, enforce rules with walls instead of prose, and shrink the harness as models improve.

## The four layers

| Layer | Lives in | Decides |
|---|---|---|
| L1 personal | your dotfiles (private) | how often an agent asks: autonomy tier per machine, taste, installed agents, user-scope skills, secrets wiring |
| L2 project | each product repo | what is never allowed: walls, the task queue, product docs, ADRs, `toolkit.lock` |
| **L3 promptbook** | **this repo** | the contracts every layer speaks |
| L4 implementations | stack packs, runtimes, vendor packs | how much a run may spend, and every binding to a specific engine, stack or vendor |

L1, L2 and L4 depend on a pinned L3; L2 selects L4 packs through `toolkit.lock`. The full guide,
including where every artifact goes and how existing repos move, is [LAYERS.md](LAYERS.md).

## Adopt it

**L1, your machines.** In the chezmoi source:

1. Pin this repo (and any upstream skill sources) in `home/.chezmoiexternal.toml.tmpl` at a release tag
   and commit, cloned into `~/.agents/sources/`.
2. Render the standards block from `standards/engineering.md` into the shared personal instruction
   template; keep only taste around it.
3. Write `home/.chezmoidata/agent-policy.yaml` against `schemas/policy.schema.json`: tiers per machine
   profile, `deny_read`, `forbid`, `ask`, `egress`, budgets. Compile it per engine with
   `tools/compile-policy.mjs` from a chezmoi run script. The compiler's contract is to refuse a tier
   that disables hooks, and a bypass tier that names no `requires` (the preconditions it relies on,
   such as production being unreachable from the host).
4. A run script fans Skilldex's `personal` install set (its `SETS.yaml`, never the whole library)
   into `~/.agents/skills/` and copies it for engines that do not read that directory
   (`adapters/<engine>/README.md` says which).

**L2, a project.** From the template, or by adoption into an existing repo:

1. Add `toolkit.lock` pinning this promptbook and the L4 packs the project uses
   (`schemas/toolkit-lock.schema.json`); `tools/lock.mjs` checks it in CI and fails on drift.
2. The template sync renders the standards block into `AGENTS.md` and keeps the walls (hooks and deny
   rules) current; the template check fails a project whose managed copies drift.
3. Validate the queue and product artifacts with `tools/validate.mjs`: frontmatter against the
   schemas, the trace graph from brief to test names, and the readiness report.

**Runtimes.** A runtime (a CLI loop, forge-event CI agents, a terminal multiplexer with a coordinator,
a hosted agent service) binds to promptbook through `adapters/<name>/`. It reads `task` files, writes
`task-record` and `run-record`, maps its own signals to the `attention` machine, honors `grant`s, and
never advances workflow status on a runtime signal. `promptbook simulate --supervisor <module>` runs a
runtime's own supervisor (its dispatch and authority decisions, written against the simulator's api)
in the runtime-neutral simulation and checks it against every invariant; without the flag the
simulation runs the `orchestrating-work` protocol as code.

## Core vs optional

The core is what every adopter uses; the rest is for a scale or a moment that not every project
reaches, and stays out until its trigger holds.

| | Core | Optional, and when |
|---|---|---|
| Practice | `standards/engineering.md`; the playbook pages you cite | — |
| Contracts | task, epic, decision, readiness-report; brief, persona, journey, requirement and ux-flow when a product is planned (without a brief the trace check runs as legacy adoption); policy and toolkit-lock; return and run-record; skill and evidence | grant and task-record: a coordinator runs several agents under delegated authority. agent-setup-review and reflection-report: there are runs to review |
| Tools | `validate` (with `trace` and `--readiness --check`), `lint`, `compile-policy`, `lock` | `simulate`: changing the state machines, or checking a runtime's supervisor. `grant`: grants are in use. `eval-routing`: a description changes. `import-evals`: once, migrating an agentic-template project. `report`: there are run records to read |
| Skills | in Skilldex: lint them with `promptbook lint <skilldex>/skills` | `eval-routing` when a description changes |
| Engines | the adapter of the engine you run | every other adapter; only one engine's permissions are measured (Status) |

Skilldex's `SETS.yaml` names its install sets; `promptbook lint <skilldex>/skills` checks each
installable set against the 8,000-character always-loaded description budget with 10% headroom, and
`promptbook lint --budget-set <set> --sets <skilldex>/skills/SETS.yaml` prints one.

### Minimum adoption for one developer

1. **Machine.** Pin this repo, render the standards block into your personal instructions, write
   `agent-policy.yaml` with one profile per machine and compile it (`promptbook compile-policy`), and
   install Skilldex's `personal` set into `~/.agents/skills/` (`promptbook lint --budget-set personal
   --sets <skilldex>/skills/SETS.yaml` checks it with what else you install).
2. **Each repository.** A `toolkit.lock` pinning promptbook, checked by `promptbook lock` in CI; tasks
   as `specs/<epic>/tasks/<ID>.md` with acceptance criteria, and `promptbook validate` plus
   `promptbook trace . --readiness specs --check` in CI.
3. **Each task.** One writer at a time: Skilldex's implementing-task claims and builds it,
   verifying-work gets the separate verdict, landing-changes lands it after your approval. No coordinator, grants,
   task-records or simulator.

Add the rest when its trigger fires: a coordinator and grants when you hand agents a batch of tasks
to run without you; the reflection and review contracts once there are runs to learn from.

## Repository map

| Path | What |
|---|---|
| [`playbook/`](playbook/00-index.md) | the latest practices, one page each, dated and cited; planning, execution, runtime, learning, methodology |
| [`standards/engineering.md`](standards/engineering.md) | the shared engineering and agent-setup invariants, each with how it is enforced |
| [`LAYERS.md`](LAYERS.md) | where every artifact lives, the precedence rule, and the move from today's repos |
| [`CONTRACTS.md`](CONTRACTS.md) | the contract catalogue, ids and the trace graph |
| `schemas/` | JSON Schema 2020-12, one per contract |
| `state-machines/` | `workflow`, `attention` and `authority` |
| `adapters/` | thin, documented mappings to engines, runtimes and CI |
| `tools/` | `validate` (and `trace`), `simulate`, `compile-policy`, `run`, `check-requires`, `lock`, `grant`, `lint-skills`, `eval-routing`, `import-evals`, `report` (Node 22; [TOOLS.md](TOOLS.md)) |
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
   pays its way is a welcome change; [agent-setup-review](playbook/learning/agent-setup-review.md) is how
   those deletions are found.

The research this repo was built from is "Agentic orchestration patterns 2026" (2026-10-12) and its
notes; every page cites the primary sources directly.
