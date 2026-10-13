# Repos today → target (generic checklist)

Fill one table per repository. "Today" is what the inventory found; "Move" is stay, move, render,
generate, add, pin or delete; "Target" is where it ends up and why. Show it to the owner before
acting.

| Today | Move | Target |
|---|---|---|

## The personal config repository (L1)

| Today | Move | Target |
|---|---|---|
| one personal instruction template with taste, platforms, git and safety rules | split | keep taste; delete git and safety rules and duplicated code rules; render the standards block from the pinned harness in their place; "act, don't pause" becomes the policy tier |
| per-engine renderers of that template | stay | add a renderer for every installed engine that lacks one |
| an engine's user settings written by hand (default mode, allow and deny lists, hooks) | generate | permissions and mode compiled from `agent-policy.yaml`; never a "disable all hooks" switch; non-permission keys (hooks the multiplexer installs, attribution) stay |
| no config for some installed engines | add | settings and rules compiled from the same policy |
| no user-scope skills | add | pinned external sources into `~/.agents/sources/`; a fan-out script into `~/.agents/skills/` and copies for engines that do not read it |
| no policy, no lock | add | `agent-policy.yaml`, a per-role model file, a lock data file |
| runtimes installed as "latest" | pin | exact versions; bumps by reviewed change against plugin floors |
| install scripts for agents and runtime integrations | stay | L1 installs agents |
| secrets wiring from a password manager | stay | L1; never on an always-on box without need |
| a network rule keeping production unreachable from the agent machine | stay | the precondition of that profile's bypass tier, named in its `requires` |
| an advisor model of the same strength as the main model | drop | unless an eval shows a gain (routing-models) |
| the repo's own `AGENTS.md` | stay | it is that repository's L2 |

## The project template (L2 source plus L4 packs)

| Today | Move | Target |
|---|---|---|
| a long `AGENTS.md` mixing generic and domain blocks | trim | the L2 map (~120 lines) with the rendered standards block; stack rules to the stack pack; the agent-model table to the runtime's docs |
| loader shims (one-line imports) | stay | add one per supported engine |
| style and taste rule files | delete | L1 taste or a standards invariant |
| stack rule files | move | the stack pack, as nested `AGENTS.md` beside the code |
| safety hooks | move to the core pack | L2 walls; asks documented as conveniences; add a deny for redirects into protected paths; port to each engine's hook format |
| `specs/` and its templates | stay | validated by the `task` contract (a superset; adds touches, risk, inputs, evaluator, budget, sessions, mode, Working notes) |
| workflow, roles, concurrency and observability docs | move to the core pack | implementations of the harness contracts; link the playbook |
| loop and agent-workflow docs | move | the CLI runtime's docs |
| ADRs | split | generic ones to the core pack; stack ones to the stack pack; each child keeps its own |
| vendor and pricing knowledge | move | the stack pack's `knowledge/`; children keep their own |
| the loop script and forge-event agent workflows | move | the CLI runtime; pinned no-prompt mode, allowlist and caps |
| stack-neutral gate scripts | move to the core pack | — |
| criteria lint and coverage scripts | to the core pack now | delete once the validator runs the same checks in CI |
| a template version file | replace | `toolkit.lock` |
| the generic skills | promote | harness skills (renamed, gerund form); template copies deleted in the same change |
| subagent definitions | move | packs, generated per engine from one role list with explicit models |
| one marketplace with one plugin | change | core and stack packs as separate plugins; third-party mirrors pinned by commit |

## A runtime coordinator (L4)

| Today | Move | Target |
|---|---|---|
| its coordinator skill and references | stay upstream, pinned | the runtime's coordinator; its record, attention states, wake rules and grants are the harness `task-record`, `attention` and `grant` |
| a local config overlay | L1 | rendered by the dotfiles into the control workspace |
| its runtime state directory | stay | untracked; records validate against `task-record` |
| its plugins | stay | installed by L1 at a pinned commit |

## A terminal multiplexer and mobile client (L4, installed by L1)

| Today | Move | Target |
|---|---|---|
| the multiplexer, installed by the tool manager | pin | exact version; bumps checked against plugin floors and the API schema |
| engine integrations | stay | installed by an L1 script |
| its agent skill | add | user-scope, for the coordinator only, pinned |
| its agent states and events | map | through the harness attention machine; never advance workflow status |
| a mobile client's host plugin | pin | installed by tag, not a branch |

## A third-party portable skill library

| Today | Move | Target |
|---|---|---|
| skills consumed from the default branch | pin | lock entries by commit and tree hash; fanned out by L1; never vendored into the harness |
| no versions or manifest | none needed | the lock entry is the version |
| its own authoring workspace files | not consumed | — |
