# harness

The engine-neutral layer of a four-layer toolkit for agent-driven software work: a dated,
evidence-cited **playbook**, the **standards** every project and every personal setup share, the
**contracts** (schemas and state machines) that let engines, runtimes and methods be swapped, and
portable **skills**, **evals** and **tools** that check all of it. No file outside `adapters/` names an
engine, runtime, forge or stack, and the harness depends on nothing.

The thesis, from the research behind it: make the harness, not the swarm, do the work. Keep one writer
per change, parallel readers, and a separate judge. Keep state in files and git, load context only
when needed, enforce rules with walls instead of prose, and shrink the harness as models improve.

## The four layers

| Layer | Lives in | Decides |
|---|---|---|
| L1 personal | your dotfiles (private) | how often an agent asks: autonomy tier per machine, taste, installed agents, user-scope skills, secrets wiring |
| L2 project | each product repo | what is never allowed: walls, the task queue, product docs, ADRs, `toolkit.lock` |
| **L3 harness** | **this repo** | the contracts every layer speaks |
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
   that disables hooks.
4. A run script fans pinned skills into `~/.agents/skills/` and copies them for engines that do not
   read that directory (`adapters/<engine>/README.md` says which).

**L2, a project.** From the template, or by adoption into an existing repo:

1. Add `toolkit.lock` pinning this harness and the L4 packs the project uses
   (`schemas/toolkit-lock.schema.json`); `tools/lock.mjs` checks it in CI and fails on drift.
2. The template sync renders the standards block into `AGENTS.md` and keeps the walls (hooks and deny
   rules) current; the template check fails a project whose managed copies drift.
3. Validate the queue and product artifacts with `tools/validate.mjs`: frontmatter against the
   schemas, the trace graph from brief to test names, and the readiness report.

**Runtimes.** A runtime (a CLI loop, forge-event CI agents, a terminal multiplexer with a coordinator,
a hosted agent service) binds to the harness through `adapters/<name>/`. It reads `task` files, writes
`task-record` and `run-record`, maps its own signals to the `attention` machine, honors `grant`s, and
never advances workflow status on a runtime signal. `tools/simulate.mjs` drives a runtime-neutral
simulation of the workflow for testing a binding.

## Repository map

| Path | What |
|---|---|
| [`playbook/`](playbook/00-index.md) | the latest practices, one page each, dated and cited; planning, execution, runtime, learning, methodology |
| [`standards/engineering.md`](standards/engineering.md) | the shared engineering and harness invariants, each with how it is enforced |
| [`LAYERS.md`](LAYERS.md) | where every artifact lives, the precedence rule, and the move from today's repos |
| [`CONTRACTS.md`](CONTRACTS.md) | the contract catalogue, ids and the trace graph |
| `schemas/` | JSON Schema 2020-12, one per contract |
| `state-machines/` | `workflow`, `attention` and `authority` |
| `adapters/` | thin, documented mappings to engines, runtimes and CI |
| `skills/` | portable skills (gerund names, core frontmatter only) with `evals/` |
| `tools/` | `validate`, `simulate`, `compile-policy`, `lock`, `lint-skills` (Node 22) |
| `tests/`, `fixtures/` | `node --test` suites and valid/invalid examples per contract |
| `examples/` | a worked product run through every contract |
| `CHANGELOG.md` | every change, marked additive, behavioral or breaking |

## Status

**Pre-1.0.** The playbook is as of 2026-10-13. Contracts may change between minor versions until 1.0;
each change is logged in `CHANGELOG.md` with its class. Pin a commit, not a branch. Only one engine's
permission behavior has been measured (Claude Code 2.1.296, ADR-0021 in agentic-template); the other
adapters are written from documentation and marked unverified where it matters.

## Contributing a playbook change

1. Open a pull request that edits the page and adds or updates an **Evidence** line: date, source
   URL, and a tag (controlled, vendor, self-reported, practitioner, secondary, measured, practice,
   recommendation). No source, no change; quotes under 15 words; vendor numbers tagged as vendor.
2. Keep the page under about one printed page and in the six-section shape. Practice text names no
   engine or vendor; bindings go in `adapters/`.
3. If the practice changes a contract, change the schema, fixtures and tests in the same pull request.
4. Add a `CHANGELOG.md` line and bump the playbook's "as of" date. Deleting a practice that no longer
   pays its way is a welcome change; [harness-review](playbook/learning/harness-review.md) is how
   those deletions are found.

The research this repo was built from is "Agentic orchestration patterns 2026" (2026-10-12) and its
notes; every page cites the primary sources directly.
