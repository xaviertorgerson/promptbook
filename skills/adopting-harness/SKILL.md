---
name: adopting-harness
description: Use when bringing a machine or a repository onto the harness — "set up this laptop for agents", "install the harness skills for every engine", "compile my agent policy", "adopt the harness in this repo", "add a toolkit.lock", "which of these instruction files are duplicates", "our AGENTS.md and personal rules disagree", "make the guardrails real walls", "move this repo to the layered setup" — pinning the harness and packs, fanning skills out to every engine, compiling the operator's policy without ever disabling hooks, pinning runtimes, writing instruction shims, turning guardrails into denies, validating specs/ against the contracts and the trace, and deleting what the layers now own. Do not use for promoting one skill or learning upward (promoting-learnings), for writing grants (delegating-authority), or for reviewing a change for vulnerabilities (reviewing-security).
license: MIT
compatibility: Git and a shell; a dotfiles or config manager for the machine part. Optional - Node 22 and the harness tools (validate, lock, compile-policy).
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Adopting the harness

Put every piece of an agent setup in the one layer that owns it, pin what it depends on, and delete
the copies. **L1 (personal) decides how often an agent asks, L2 (project) decides what is never
allowed, L4 (packs and runtimes) decides how much a run may spend; L3 (the harness) defines the
contracts all three speak.** Adoption is additive and reconciling: never clobber what an owner wrote.

## Inputs

- The layer guide (excerpt in `references/layers.md`): the decision test and the artifact map.
- The machine: installed agents and runtimes, each engine's personal instruction file, user
  settings, user skill directories, the dotfiles or config-manager source.
- The repository: instruction files and loader shims, engine settings and hooks, skills, subagent
  definitions, MCP config, `specs/`, `DECISIONS.md`, docs, CI workflows, runtime state directories.
- Contracts: `toolkit-lock`, `policy`, `task`, `epic`, `journey`, `requirement`, `decision`, `skill`.

## Procedure

### 1. Inventory and classify (both)

1. List every agent-related file. For each, ask: who must see it, and does it name an engine,
   runtime, stack or vendor? Assign a layer and an action: **stay**, **move**, **render** (generated
   from a single source), **generate** (compiled), or **delete** (duplicated elsewhere).
2. Write the result as a table (template in `references/repos-checklist.md`) and show it to the
   owner before anything is moved or deleted.

### 2. A machine (L1)

1. **Pin sources.** Clone the harness at a release tag and any upstream skill sources into
   `~/.agents/sources/<name>/` through the config manager's external-source mechanism. Record each
   as a lock entry (name, layer, source, ref, commit, tree, version, autoUpdate), the same shape as
   `toolkit.lock`. Third-party sources: `autoUpdate: off`, ideally from your own mirror.
2. **Fan out skills.** A run-on-change script links each pinned skill folder into `~/.agents/skills/`
   (read by most engines) and **copies** it into the user skill directory of every installed engine
   that does not read `~/.agents/skills` (`references/engine-notes.md`). Rename on collision; never
   rely on precedence, which differs per engine. Prune entries whose source is gone. Write the script
   in POSIX `sh` so it runs before other tooling exists. Sketch: `references/machine.md`.
3. **Render instructions.** One personal template, rendered to each engine's personal instruction
   file. Render the standards block from the pinned harness between its markers; keep only taste
   around it; delete personal rules the standards now hold.
4. **Write and compile the policy.** `agent-policy.yaml` per the `policy` contract: `profiles` →
   `tier`, a non-empty `deny_read`, `forbid`, `ask`, `allow`, `egress`, `sandbox`, `budgets` (an
   unattended profile requires one), `accept_gaps` only with the operator's reason. Validate:
   `node tools/validate.mjs --contract policy <file>`. Compile per engine with the policy compiler if
   it is available, else by the adapter's mapping table. Rules that hold whatever the tier:
   - **never** set the engine's "disable all hooks" switch, in user settings or a command-line
     settings override; the compile refuses such a tier;
   - add deny rules; never remove or override a project's denies;
   - a bypass or autonomous default only on profiles where production is unreachable at the network
     level and the agent runs non-root in a sandbox or container; name those preconditions in the
     profile's `requires` (`prod-unreachable-from-this-host`, `non-root-container`): the compile
     refuses a bypass tier without them and hands them to the launcher to check;
   - unattended profiles run the engine's no-prompt mode with an explicit allowlist, and a budget.
5. **Pin runtimes.** Agents, terminal multiplexers and their plugins at exact versions in the
   package or tool manager; bumps arrive as reviewed changes checked against plugins' minimum-version
   floors and the runtime's published schema.
6. **Verify.** Render and diff before applying; after applying, each engine lists the fanned-out
   skills; a probe shows a project deny still blocks under the machine's default mode and an ask is
   denied in a headless run (`references/walls.md`).

### 3. A repository (L2)

1. **Lock.** Write `toolkit.lock`: exactly one harness entry (L3), one `skill-library` entry (L3)
   per third-party portable skill source, and one L4 entry per pack and runtime binding. Use the
   lock tool if available (`harness lock`, or `node tools/lock.mjs`); otherwise resolve commit and
   tree by hand (`references/repo.md`). Validate: `node tools/validate.mjs toolkit.lock`. CI fails
   on drift.
2. **Instruction map and shims.** `AGENTS.md` is the map (about 120 lines): north star, commands,
   pointers, domain rules, and the standards block rendered from the pinned harness. Each engine gets
   a one-line loader (an import file, or a settings key naming `AGENTS.md`). Stack guardrails live
   beside the code as nested instruction files, delivered by the stack pack.
3. **Walls as denies.** Every guardrail that must hold in any session is a hook that returns deny or
   a permission deny rule, for every engine the project supports. An ask is an interactive
   convenience, never protection. Branch protection, code owners (agents are never owners) and
   required checks are the backstop. Probe each wall: a deny case blocks, a benign case runs.
4. **Skills.** Harness skills come from the pinned harness, not from edited copies. Project-only
   skills live in `.agents/skills/<name>/` with copies synced into engines that do not read it.
5. **Contracts in `specs/`.** Validate as-is: `node tools/validate.mjs specs DECISIONS.md` (existing
   task files are a subset of the `task` contract and should pass unchanged). Then
   `node tools/validate.mjs --trace . --tests "<test globs>"`. Without a product brief the trace runs
   in legacy adoption: missing links are warnings. Fix what it names as tasks are touched (for example
   `requirements: [REQ-2]`), not in a bulk rewrite. Turn on `--strict` once warnings are cleared;
   write readiness reports with `--readiness <dir>`.
6. **CI.** Add the validate and trace steps and the lock drift check. Every unattended agent job pins
   the no-prompt mode, an allowlist, and turn and spend caps.
7. **Delete duplicates** (`references/repo.md`, Deletions): rules now in the standards block;
   personal taste restated in the project without a linter enforcing it; doctrine restated from the
   playbook (link it instead); scripts the validator now supersedes, once CI runs the validator;
   older version pins replaced by `toolkit.lock`; promoted skills' old copies.
8. **Reconcile, never clobber.** Extend an existing hook instead of adding a parallel one; keep the
   owner's domain rules, docs and ADRs; list conflicts for the owner.
9. **Land** as small commits on a branch through a pull request; a human merges.

## Outputs

The classification table; L1: pinned sources, `~/.agents/skills` plus engine copies, rendered
instructions, `agent-policy.yaml` and compiled settings; L2: `toolkit.lock`, the trimmed `AGENTS.md`
with shims, walls as denies, validated `specs/`, CI steps, the deletion list. Examples that validate:
`references/examples/`.

## Gates and stop conditions

Stop and ask the owner (`needs-human`) before: deleting or moving any file someone wrote; any
change to walls, deny rules, hooks or branch protection (policy changes are a human commit, never
delegated); a bypass or autonomous tier on a machine that can reach production; any `accept_gaps`
entry (the operator writes the reason); a conflict between an existing instruction and the
standards; enabling auto-update on a third-party source. Never disable hooks to make adoption pass,
and never weaken a test or a gate to make the validator green.

## References

- `references/layers.md` — the decision test, precedence, and what lives where.
- `references/machine.md` — the L1 procedure in detail, with a fan-out script sketch.
- `references/repo.md` — the L2 procedure in detail: the lock by hand, shims, validation, deletions.
- `references/walls.md` — why walls are denies (the measured matrix) and how to verify them.
- `references/repos-checklist.md` — the "repos today → target" checklist, generic.
- `references/engine-notes.md` — per-engine paths and switches (adapters own the mapping).
- `references/examples/` — a `toolkit.lock` and `operator.policy.yaml` (an `agent-policy.yaml`) that validate.
