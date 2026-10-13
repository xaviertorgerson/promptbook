# Playbook

**As of 2026-10-13.** The latest practices for agent-driven software work. Each page states one
practice, the dated evidence behind it, and the contracts it uses. The playbook is meant to shrink:
a practice that no longer pays its way is deleted, not kept for completeness.

## How to read a page

Every page fits on about one printed page and has the same six sections:

| Section | Holds |
|---|---|
| Problem | the failure the practice prevents |
| Practice | what to do, engine-neutral |
| Evidence | dated, cited sources, each tagged (below) |
| Contracts used | the schemas in `schemas/` and machines in `state-machines/` the practice relies on ([CONTRACTS.md](../CONTRACTS.md)) |
| Anti-patterns | what it looks like when the practice is missing |
| Revisit when | the trigger that reopens the page |

Practice text names no engine, runtime, stack or vendor. Those names appear only as the source of a
measurement under Evidence, or in a pointer to `adapters/`, where each binding lives.

| Evidence tag | Meaning |
|---|---|
| controlled | a study with a comparison or ablation |
| vendor | a vendor measuring or documenting its own product or model |
| self-reported | a method's authors or customers, no comparison |
| practitioner | a named third party's hands-on evaluation, no comparison |
| secondary | a summary of a source that was not read directly |
| measured | a measurement the user ran on their own setup, with the method recorded |
| practice | the user's repos: what is done and why, not a measurement |
| recommendation | this playbook's judgement, derived from the lines above it |

## Review cadence

- **On every major model release** from a lab the toolkit routes to, run [harness review](learning/harness-review.md).
- **Quarterly** otherwise. Next review: 2027-01-13.
- **When a page's "Revisit when" trigger fires**, whatever the calendar says.

## How a page changes

1. A pull request edits the page and adds or updates an Evidence line with a date, a source URL and a
   tag. No source, no change. Quotes stay under 15 words; vendor numbers carry the vendor tag.
2. A change that alters a contract changes its schema in the same pull request.
3. The reviewer checks that each source says what the page claims and that Practice stays neutral.
4. The merge bumps the "as of" date above and adds a `CHANGELOG.md` line marked additive, behavioral
   or breaking. Deleting a practice is a valid, expected change.

## Principles

- **The repo is the memory.** State lives in files and git; a session is a cache.
- **Code owns the graph; models own the ambiguous nodes.** Scheduling, routing and gates are code.
- **One writer, parallel readers, a separate judge.**
- **Walls are denies.** A rule that matters is a hook, a type, a test or a gate; prose says why.
- **Events, not polling.** Work starts when something becomes actionable.
- **Load only what the task needs.** The cheapest token is the one never loaded.
- **Every component is an assumption.** Each model release is a chance to delete one.

## Pages

| Section | Page | One line |
|---|---|---|
| Planning | [proportional-planning](planning/proportional-planning.md) | The nine-stage pipeline, entered at the depth size and risk require |
| | [framing-and-personas](planning/framing-and-personas.md) | A one-page brief and decision-relevant personas, written before anything else |
| | [journeys-and-requirements](planning/journeys-and-requirements.md) | CUJs, then EARS requirements and measurable NFRs that become stopping conditions |
| | [ux-before-code](planning/ux-before-code.md) | Flows with four states and a prototype walked against every CUJ |
| | [architecture-and-stack](planning/architecture-and-stack.md) | Quality attributes, options, an ADR with door type and reversal trigger; a pack or a deviation |
| | [walking-skeleton](planning/walking-skeleton.md) | The thinnest real end-to-end slice, riskiest assumption first |
| | [plan-readiness](planning/plan-readiness.md) | A task graph with touches, size and risk, checked by a generated trace report |
| Execution | [single-writer](execution/single-writer.md) | One writer per change set; helpers read |
| | [worktree-per-task](execution/worktree-per-task.md) | Isolated checkout plus derived resources, with audited cleanup |
| | [landing-changes](execution/landing-changes.md) | Merge authority as explicit, revocable tiers; humans merge by default |
| | [credentials](execution/credentials.md) | No long-lived keys in an agent's reach; one identity per role |
| | [releasing](execution/releasing.md) | One immutable artifact promoted by digest; agents never deploy to production |
| | [verification](execution/verification.md) | A separate, different evaluator judging an objective artifact |
| Runtime | [topologies](runtime/topologies.md) | When fan-out pays, and why most coding stays single-threaded |
| | [return-contract](runtime/return-contract.md) | A short summary plus artifact paths; raw artifacts forwarded, never paraphrased |
| | [dormancy-and-wakes](runtime/dormancy-and-wakes.md) | Sleep until an event; a wake is a hint, never a state change |
| | [durable-checkpoints](runtime/durable-checkpoints.md) | Workflow state in tracked files, runtime facts in a task record |
| | [budgets-and-routing](runtime/budgets-and-routing.md) | Effort first, route at boundaries, cache the prefix, cap every run |
| | [permissions-and-autonomy](runtime/permissions-and-autonomy.md) | The measured precedence matrix and the rule it produced |
| | [observability](runtime/observability.md) | Run records, open telemetry, and three numbers to watch |
| Learning | [evals-and-evidence](learning/evals-and-evidence.md) | Routing and scenario evals, pass^k, evidence from real failures |
| | [promotion-and-deprecation](learning/promotion-and-deprecation.md) | trial → project → pack → user, with gates, renames and pins |
| | [reflection-loop](learning/reflection-loop.md) | Generator, reflector, curator; deltas as reviewed pull requests |
| | [harness-review](learning/harness-review.md) | Effort sweep and ablation on each model release; delete what isn't load-bearing |
| Methodology | [modes](methodology/modes.md) | Spec-driven, research-plan-implement, Ralph loop, ICM pipeline as swappable modes |

Related: [LAYERS.md](../LAYERS.md) says where each artifact lives;
[standards/engineering.md](../standards/engineering.md) holds the invariants every page assumes.
