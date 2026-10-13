# Layers (excerpt of the harness layer guide, as of 2026-10-13)

| Layer | Lives in | Holds | Seen by |
|---|---|---|---|
| L1 personal | the operator's dotfiles or config manager (private) | taste, the autonomy tier per machine profile, installed agents and runtimes, user-scope skill fan-out, secrets wiring, personal MCP servers | the operator's own sessions on their machines, in every repo |
| L2 project | each product repository | a thin `AGENTS.md` map, walls (hook denies, permission deny rules), the `specs/` queue, product docs, `DECISIONS.md`, `knowledge/`, `toolkit.lock`, read-only MCP config | every agent, collaborator, cloud session and CI job on that repo |
| L3 harness | the harness repository, tagged releases | playbook, standards, contracts, portable skills, evals, validator, simulator, policy compiler, adapters | whoever pins it |
| L4 implementations | stack packs, runtimes, vendor packs mirrored at a pin | bindings of L3 to an engine, stack, runtime or vendor | whoever selects it in `toolkit.lock` |

**Precedence:** L1 decides how often an agent asks; L2 decides what is never allowed; L4 decides
how much a run may spend; L3 defines the contracts. No layer loosens a layer that decides something
else: a personal bypass cannot lift a project deny, and a runtime budget cannot authorize what a wall
forbids. Dependencies point one way: L1, L2 and L4 pin one L3; L2 selects L4 through `toolkit.lock`.

## The decision test

Ask of any artifact: who must see it, and does it name an engine or stack?

1. Every agent, collaborator, cloud session and CI job on one repo must obey it → **L2**. If the same
   rule holds for every repo, its text is an L3 standard rendered into L2.
2. It applies only to you, in every repo → **L1**.
3. Reusable across projects and free of engine, runtime, stack and vendor names → **L3**.
4. Binds something to a specific engine, runtime, stack or vendor → **L4**, or a thin adapter in L3.

Tie-breakers: how often to ask → L1; what is never allowed → L2; how much to spend → L4. A file that
names an engine is not L3 practice.

## What lives where (abridged)

| Artifact | Layer | Source of truth |
|---|---|---|
| personal instructions (taste, platforms) | L1 | one personal template, rendered per engine |
| engineering invariants (ENG-1..8) | L3 text, rendered into L1 and L2 | the harness standards file, between `standards:begin`/`standards:end` markers |
| project instructions (the map) | L2 | `AGENTS.md`, about 120 lines, plus per-engine loader shims |
| stack guardrails by directory | L4 pack, installed into L2 | nested `AGENTS.md` beside the code |
| autonomy tier per machine profile | L1 | `agent-policy.yaml` (`policy` contract), compiled per engine |
| walls | L2 | hook scripts plus deny rules, delivered by the core pack |
| personal deny rules (secrets) | L1, on top of L2 | `agent-policy.yaml` `deny_read`, `forbid` |
| portable skills | L3 | the harness `skills/`, or a pinned upstream |
| project domain skills | L2 | `.agents/skills/<name>/` |
| subagent definitions (model, effort, tools) | L4 pack, installed into L2 | generated per engine from one role list |
| task queue | L2 | `specs/<epic>/tasks/*.md` (`task` contract) |
| runtime task records, run records, grants | L4 runtime state, untracked | `.orchestrator/`, `.agent/` |
| runtime config for unattended runs (mode, allowlist, caps, model per role) | L4 | the runtime's flags and environment |
| lockfile | L2 and L1 | `toolkit.lock`; the same entries in the dotfiles' data |
| secrets | L1 personal; the forge for CI | a password manager rendered at apply time; forge environments; never a file in git |

## Cloud sessions and CI see only L2

A cloud session or CI job clones the repository and nothing else: no personal instructions, user
settings, personal skills or dotfiles policy. Anything that must hold there is L2, or an L3/L4
artifact pinned in `toolkit.lock` and present in the checkout. Autonomy in CI comes from the
runtime's flags, not from L1.
