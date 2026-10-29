# Permissions and autonomy

## Problem

Two layers disagree on how much an agent should ask. A personal layer says "act; don't pause"; a
project layer has hooks that ask before risky commands. Which one wins is engine behavior, not
prose, and an `ask` that nobody answers in an unattended run is not a safeguard at all.

## Practice

The precedence rule: **L1 decides how often to ask, L2 decides what is never allowed, L4 decides how
much a run may spend.**

1. **Walls are denies.** Anything an agent must never do is a project hook that returns `deny` or a
   permission `deny` rule. Denies held in every mode measured.
2. **Asks are human checkpoints only.** An `ask` stops a person at a terminal. Unattended, it is a
   denial; it is never counted as protection and never auto-approved.
3. **Unattended runs pin their mode.** Every unattended run passes the engine's no-prompt mode
   (deny anything that would prompt) plus an explicit tool allowlist, which then is the real boundary.
   A denial is reported as a question for a human.
4. **L1 never disables hooks.** A personal layer may choose a bypass default, add allow and deny
   rules, and set an auto mode. It must not turn hooks off, and adds denies rather than removing the
   project's.
5. **Bypass needs isolation.** Bypass defaults belong only on profiles where production is
   unreachable at the network level and the agent runs as non-root in a sandbox or container. The
   profile names those preconditions (`requires`), each a probe of the host (`promptbook
   check-requires`; `promptbook run` refuses to start until they pass); the compiler refuses a bypass
   tier without them, and without the policy's own sandbox and egress deny unless each gap is
   accepted for that profile by name. A bypass on its own sandbox also forbids a sandbox-blocked
   command's unsandboxed retry, which bypass would run unasked.
6. **Branch protection is the backstop** for anything a hook may miss.

## Evidence

**Measured matrix** (2026-10-13 · measured · agentic-template ADR-0021 on branch
`docs/adr-permission-precedence`, commit `c177fa1`; Claude Code 2.1.296, about 100 headless runs). User layer: a bypass
default with deny rules; project layer: hook and rule `deny`/`ask`. "no-prompt" is `dontAsk`.

| probe | user bypass | default | bypass flag | auto | no-prompt |
|---|---|---|---|---|---|
| control | ran | ran | ran | ran | ran |
| needs approval | ran | denied | ran | ran | denied |
| hook `deny` | blocked | blocked | blocked | blocked | blocked |
| hook `ask` | denied | denied | denied | denied | denied |
| project deny rule | blocked | blocked | blocked | blocked | blocked |
| project ask rule | denied | denied | denied | denied | denied |
| user deny rule | blocked | blocked | blocked | blocked | blocked |

Also measured: a user or command-line "disable all hooks" removed the hook wall (deny rules still
held); a project lock on bypass removed bypass even against the flag; a tool allowlist did not narrow
a user bypass default, but did under the no-prompt mode. The interactive prompt was not measured.

- 2026-10-13 · practice · ADR-0021 ships `scripts/permission-probe.mjs` to re-run the matrix on any
  machine; every measured cell agreed with the vendor docs (both on branch
  `docs/adr-permission-precedence` at commit `c177fa1`, not yet on master:
  [DECISIONS.md](https://github.com/xaviertorgerson/agentic-template/blob/c177fa1/DECISIONS.md),
  [permission-probe.mjs](https://github.com/xaviertorgerson/agentic-template/blob/c177fa1/scripts/permission-probe.mjs)).
- 2026-03-25 · vendor · auto mode: 0.4% false positives, 17% false negatives on real overeager actions
  ([Anthropic](https://www.anthropic.com/engineering/claude-code-auto-mode)).
- 2025-10-20 · vendor · sandboxing reduced permission prompts by 84% internally
  ([Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing)).
- 2026-10 · vendor · skip-permissions is acceptable only as non-root with egress restrictions
  ([devcontainer](https://code.claude.com/docs/en/devcontainer)); deny rules merge across scopes and apply
  before trust ([settings](https://code.claude.com/docs/en/settings)).
- 2026-10-04 · practice · the user's tailnet ACL keeps production unreachable from the devbox where
  agents run unattended ([dotfiles README](https://github.com/xaviertorgerson/dotfiles/blob/main/README.md)).
- unsourced · a deviation, not a counterexample: heirloom (2026-10-28), pre-launch with no customer
  data, runs a project-local, uncommitted bypass default with deny rules for database clients and
  dumps, volume removal and force-push, chosen because auto mode's classifier kept blocking the merges
  and release dispatches its trust profile allows. Production is reachable from that host, so rule 5
  still holds; the deviation names its revert trigger (the first real customer). The settings file is
  uncommitted; treat it as recommendation.
- Other engines: not measured. `adapters/` records each engine's equivalent and marks it unverified
  until a probe runs.

## Contracts used

`policy` (tiers per machine profile, `auto` among them, with their `requires` and their own
`sandbox` and `egress` overrides; `forbid`, `ask`, `deny_read`, `egress`, sandbox credential masks,
budgets, `accept_gaps`), compiled per
engine by `tools/compile-policy.mjs`; `grant`; `run-record` (permission denials per run).

## Anti-patterns

- A guardrail implemented as an `ask`.
- Auto-approving asks inside a loop.
- A personal setting that disables hooks "because they're slow".
- Treating an allowlist as a boundary under a bypass default.
- Bypass on a machine that can reach production.

## Revisit when

An engine lets a project lock a stricter mode or force hooks on without managed settings, a probe on
a new engine version shows a hook `deny` not blocking or an `ask` auto-approved, or a second engine is
measured.
