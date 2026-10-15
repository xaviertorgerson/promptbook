# Layers

Where each piece of an agent setup lives, why, and which of the suite's five repositories holds it.
As of 2026-10-14. The repositories' mandates are in [SUITE.md](SUITE.md); practices are in
[playbook/](playbook/00-index.md); shared rules are in [standards/engineering.md](standards/engineering.md);
contract names are defined in [CONTRACTS.md](CONTRACTS.md).

## The four layers, on five repositories

| Layer | Repositories | Holds | Seen by |
|---|---|---|---|
| **L1 personal** | **dotfiles** (chezmoi, private) | taste, the autonomy tier per machine profile, installed agents and runtimes (Herdr; on the devbox, stagehand's control workspace and its wake relay) at their pins, the pinned checkouts cloned, Skilldex's personal set, secrets wiring, personal MCP | the user's own sessions on the user's machines, every repo |
| **L2 project** | **each product repo, started from stagecraft** and kept in step by its template sync | a thin `AGENTS.md` map, walls (hook denies, permission deny rules), the trust profile (`governance.yaml`: what lands without a human), the `specs/` queue, product docs, `DECISIONS.md`, `knowledge/`, `toolkit.lock`, read-only MCP config | every agent, collaborator, cloud session and CI job on that repo |
| **L3 shared** | **promptbook** (the formats, standards, playbook and the tools that check them) and **Skilldex** (every portable skill, with its evals and install sets) | engine- and stack-neutral contracts and procedures | whoever pins them |
| **L4 implementations** | **stagecraft's sets** (`sets/webapp-saas/`, one per kind of project), **stagehand** (parallel coordination on Herdr), stagecraft's sequential loop and CI agents, and the engines and runtimes themselves (Claude Code, Codex, Gemini; Herdr, Heeler) | bindings of L3 to an engine, stack or runtime | whoever selects them in `toolkit.lock` or installs them in L1 |

**Precedence, in one line: L1 decides how often an agent asks, L2 decides what is never allowed, L4
decides how much a run may spend; L3 defines the contracts all three speak.** No layer can loosen a
layer that decides something else: a personal bypass cannot lift a project deny, and a runtime budget
cannot authorize what a wall forbids. What may land without a human's approval is L2 too, the
project's trust profile: no personal setting and no runtime grant makes green checks the merge gate.

Dependencies point one way. L1, L2 and L4 depend on a pinned L3; L2 selects its L4 set through
`toolkit.lock`; L3 depends on nothing (Skilldex is checked by promptbook's tools, and depends on
none of its code).

## The decision test

Ask two questions of any artifact: **who must see it, and does it name an engine or stack?**

1. Must every agent, collaborator, cloud session and CI job on one repo obey it? → **L2**. If the same
   rule holds for every repo, its text is a promptbook standard rendered into L2.
2. Does it apply only to you, in every repo, and to nobody else? → **L1** (dotfiles).
3. Is it reusable across projects and free of engine, runtime, stack and vendor names? → **L3**: a
   format, a standard, a practice or a check is promptbook's; a procedure an agent loads is a
   Skilldex skill.
4. Does it bind something to a specific engine, runtime, stack or vendor? → **L4** (a stagecraft set,
   stagehand), or a thin mapping in promptbook's `adapters/`.

Tie-breakers: a rule about *how often to ask* is L1; about *what is never allowed* is L2; about *how
much to spend* is L4. A file that names Claude, Codex, Gemini or Herdr is not L3 practice; it is an
adapter, an engine note in a skill's `references/engine-notes.md`, or L4.

## Artifact map

Engine columns give the concrete path the artifact lands at. `~` is the user's home; other paths
are relative to the repo root. "Unverified" marks a path documented inconsistently or not measured;
`adapters/<engine>/README.md` records the current check.

### Instructions, rules, policy

| Artifact | Layer | Source of truth | Claude Code | Codex | Gemini CLI / Antigravity |
|---|---|---|---|---|---|
| Personal instructions (taste, platforms) | L1 | `home/.chezmoitemplates/AGENTS.md` | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | `~/.gemini/GEMINI.md` (Antigravity still reads it) |
| Engineering invariants | L3 text (promptbook), rendered into L1 and L2 | promptbook `standards/engineering.md` (block between the markers) | inside both files above and below | same | same |
| Project instructions (the map) | L2 | `AGENTS.md`, under ~120 lines, from stagecraft's template | `CLAUDE.md` containing `@AGENTS.md` | `AGENTS.md` (native; 32 KiB combined cap) | `.gemini/settings.json` `context.fileName: ["AGENTS.md"]` |
| Stack guardrails by directory | L4 set, installed into L2 | stagecraft `sets/<set>/` | `apps/<x>/AGENTS.md` plus a `CLAUDE.md` shim (loads on demand) | nested `AGENTS.md` (read when launched there) | nested `AGENTS.md` (just in time) |
| Autonomy tier per machine profile | L1 | dotfiles `home/.chezmoidata/agent-policy.yaml` (`policy` schema), compiled by `promptbook compile-policy` | `~/.claude/settings.json` `permissions.defaultMode`, `autoMode` | `~/.codex/config.toml` permission profile; `~/.codex/rules/*.rules` | `~/.gemini/settings.json` (Antigravity path unverified) |
| Walls | L2 | hook scripts plus deny rules, delivered by stagecraft's template sync | `.claude/settings.json` `PreToolUse` hooks and `permissions.deny` | `.codex/rules/*.rules` (`forbidden`); hooks via `hooks.json` (project path unverified); trusted projects only | `.gemini/settings.json` (hooks format unverified) |
| Personal deny rules (secrets, credentials) | L1, added on top of L2 | `agent-policy.yaml` `deny_read`, `forbid` | `~/.claude/settings.json` `permissions.deny`; sandbox `filesystem.denyRead` | `~/.codex/rules/*.rules` | `~/.gemini/settings.json` |
| Egress allowlist | L1 per profile; L2 may narrow | `agent-policy.yaml` `egress` | sandbox `network.allowedDomains` | config permission profile | unverified |
| Trust profile (what lands without a human's approval) | L2 | `governance.yaml` (`governance` schema), with the ADR that chose it; one of its own protected paths | none: the forge enforces it (required checks with the risk gate, auto-merge, code owners) | same | same |

### Skills, subagents, tools

| Artifact | Layer | Source of truth | Claude Code | Codex | Gemini CLI / Antigravity |
|---|---|---|---|---|---|
| Portable skills (engine- and stack-neutral) | L3 | Skilldex `skills/<gerund-name>/`, pinned by commit + tree in `toolkit.lock` with the install `sets` copied | copied to `~/.claude/skills/` or `.claude/skills/` (Claude does not read `.agents/skills`) | `~/.agents/skills/`, `.agents/skills/` | `~/.agents/skills/` alias, `.agents/skills/`; Antigravity global `~/.gemini/antigravity-cli/skills/` (verify on install) |
| Stack skills | L4 | stagecraft `sets/<set>/` (`sets/webapp-saas/`: deploy-readiness, launch-readiness, landing-page, migration-safety); vendor packs mirrored at a pin | plugin from `.claude-plugin/marketplace.json`, pinned by `sha` | `.codex-plugin/plugin.json`; marketplace `.agents/plugins/marketplace.json` | Antigravity plugin (unverified) |
| Project domain skills | L2 | `.agents/skills/<name>/`; stagecraft's own (bootstrap, adopting-stagecraft, ship, nightly-audit, reviewer) arrive by the template sync | synced copy in `.claude/skills/<name>/` | read natively | read natively |
| Personal skills | L1 | Skilldex's `personal` set, pinned in the dotfiles | `~/.claude/skills/` (fan-out copy) | `~/.agents/skills/` | `~/.agents/skills/` |
| Trial skills | trial (no layer yet) | an untracked folder | the engine's personal or project skills dir, never committed | same | same |
| Coordinator skill | L4 runtime | stagehand `skills/orchestrating-development/`, in its control workspace only | that workspace's skills dir | `.codex/skills/` in that workspace | same |
| Subagent role contract (purpose, return shape) | L3 | promptbook `return` schema; role notes in `adapters/` | — | — | — |
| Subagent definitions (model, effort, tools, isolation) | L2, from stagecraft | generated per engine from one role list | `.claude/agents/<role>.md` | `.codex/agents/<role>.toml` | `.gemini/agents/<role>.md` |
| Project MCP servers (read-only, `${VAR}` credentials) | L2 | one list in the set's config | `.mcp.json` | `.codex/config.toml` `[mcp_servers]` | `.gemini/settings.json`; Antigravity `.agents/mcp_config.json` |
| Personal MCP servers (keychain-backed) | L1 | `agent-policy.yaml` or a run script | `~/.claude.json` via `claude mcp add --scope user` (the file is tool-written; never template it) | `~/.codex/config.toml` | Antigravity `~/.gemini/config/mcp_config.json` (documented inconsistently; verify) |

### Runtime, state, secrets

| Artifact | Layer | Where |
|---|---|---|
| Installed agents and runtimes, pinned | L1 | dotfiles `home/.chezmoidata/packages.yaml`; `home/dot_config/mise/config.toml.tmpl` (`herdr = "0.9.3"`); install scripts in `home/.chezmoiscripts/` |
| Per-role model and effort for personal sessions | L1 | `home/.chezmoidata/agents.yaml` (new), compiled into each engine's settings |
| Runtime config for unattended runs (mode, allowlist, caps, model per role) | L4 | stagecraft's loop flags and `AGENT_MAX_*` env, its CI workflow env; stagehand's `.local/AGENTS.md`, rendered by the dotfiles; caps from a role's `runner.json` (`promptbook run`) |
| Task queue | L2 | `specs/<epic>/tasks/*.md`, validated against promptbook's `task` |
| Runtime task records | L4, untracked in L2 checkout or control workspace | `.orchestrator/tasks/<id>.yaml`: stagehand's own records, which promptbook's `task-record` reads as they are |
| Run records | L4 writes; promptbook schema | `.agent/loop-runs.jsonl` (gitignored), one `run-record` per run, written by stagecraft's loop and CI agents; `promptbook report` totals them |
| Authority grants | issued by a human; L4 runtimes read them | `.orchestrator/grants/GRANT-n.yaml`: in a project, committed by the granting human on a CODEOWNERS-protected path, agents writing only `.orchestrator/grants/drafts/`, `promptbook grant verify --git` before acting; a runtime with an untracked control root drafts one from the human's words and checks it with `promptbook grant verify --owners`; stagehand records a delegation as a project note there instead |
| CI agents (planner, coder, reviewer, merge) | L4 runtime, installed into L2 by stagecraft | `.github/workflows/agent-*.yml`; engine binding in promptbook `adapters/ci` |
| Secrets, personal | L1 | Bitwarden note rendered to `~/.config/shell/secrets.sh` (mode 600) at apply time |
| Secrets, CI and stages | L2 names them, the forge holds them | forge environments and secrets; never a file |
| Environment rules (what each stage may touch) | L2 walls plus L4 set workflows; L1 network isolation | deny rules and `.env.example` (generated) in L2; per-stage environments in the forge; tailnet ACL keeping production unreachable from the devbox |
| Product docs | L2 | `docs/product/brief.md`, `docs/product/personas/`, `docs/ux/<epic>.md`, `docs/` chapters |
| ADRs | L2 per project; stagecraft and each set for their own decisions | `DECISIONS.md` |
| Knowledge (verified vendor and pricing learnings) | L2 per project; a stagecraft set when cross-project | `knowledge/<topic>.md` with source and verification headers |
| Lockfile | L2 and L1 | L2 `toolkit.lock` (promptbook, Skilldex with its `sets`, the stagecraft set); L1 dotfiles `home/.chezmoidata/toolkit.yaml` (the same entries under one key), rendered to `~/.config/agents/toolkit.yaml` and read by the checkout and skills scripts |
| Telemetry export | L1 per machine, L4 per runtime; promptbook schema | engine telemetry env (Claude: `CLAUDE_CODE_ENABLE_TELEMETRY=1`); OTel GenAI spans to a backend chosen in L4 |

## What ADR-0021 means for L1 and L2

The measured matrix (Claude Code 2.1.296, 2026-10-13; agentic-template ADR-0021 on branch
`docs/adr-permission-precedence`, commit `c177fa1`, not yet on master) is in
[permissions-and-autonomy](playbook/runtime/permissions-and-autonomy.md). Its consequences per layer:

| Layer | May | Must not | Must |
|---|---|---|---|
| L1 | choose `bypassPermissions` on the devbox profile and `auto` with the sandbox on workstations; add allow rules, auto-mode rules and deny rules | set `disableAllHooks` in user settings or `--settings`; remove or override a project deny | keep bypass to profiles where production is unreachable by network ACL and the agent runs non-root in a sandbox or container |
| L2 | ship `ask` hooks as conveniences for interactive users | rely on an `ask` as protection; rely on a project `defaultMode` (the flag and user defaults outrank it) | express every guardrail behind ENG-3, ENG-4 and ENG-5 as a hook `deny` or a `permissions.deny` rule; keep branch protection as the backstop; deny Bash redirects into protected paths |
| L4 | set caps per run and per grant | auto-approve asks; run unattended without a pinned mode | launch every unattended run with `--permission-mode dontAsk` plus `--allowedTools` and turn and budget caps; report `permission_denials` as questions for a human |

L1 cannot remove an L2 deny: deny rules merge across scopes and a deny wins in every mode, and
project hooks run in every mode, so the one thing L1 could do to a wall is turn hooks off (ADR-0021).
The policy compiler (`tools/compile-policy.mjs`) refuses a policy whose `x-` extension disables
hooks and checks every compiled output's keys for `disableAllHooks` and its equivalents (HAR-2); it
reads no L2 input, so it neither sees nor could drop a project's denies. Only managed settings can
force hooks on; on a shared machine, put the bypass and hook locks there. Codex and Gemini were not measured: their adapters compile the same intent (forbidden prefix
rules, hooks) and stay marked unverified until a probe runs.

## Cloud sessions and CI see only L2

A cloud session or CI job clones the repo and nothing else. It reads the project's settings, hooks,
instructions, skills and workflows. It does not read `~`: no personal instructions, no user
settings, no locally installed plugins, no personal skills, no dotfiles policy. Claude Code cloud
sessions read the clone's `.claude/settings.json` but not user or local settings
([settings](https://code.claude.com/docs/en/settings)), and do not load local plugins
([plugins](https://code.claude.com/docs/en/plugins)); device policy does not reach them either.

So:

- **Anything that must hold in CI is L2**, or an L3/L4 artifact pinned in `toolkit.lock` and present
  in the checkout (synced files, or a plugin enabled in project settings and pinned by commit).
- **Engineering invariants reach CI** because the standards block is rendered into L2 `AGENTS.md` and
  enforced by L2 hooks and CI gates.
- **Taste does not reach CI.** That is deliberate. A project that wants a taste rule in CI writes it
  as its own L2 rule or, better, enforces it with a linter.
- **Autonomy in CI comes from the runtime**, not from L1: the workflow's mode, allowlist and caps.
- Collaborators are in the same position as CI: they see L2 and their own L1.

## Where each repository's pieces live

Every piece lives in exactly one repository; "Today" is the state before the suite's split, and a
row that moves names its one target.

### promptbook (L3)

| Today | Move | Target |
|---|---|---|
| `skills/`: 28 portable skills with their evals, `SETS.yaml`, the routing results | move | Skilldex `skills/` (adopting the suite and reviewing it under new names: setting-up-the-suite, reviewing-agent-setup) |
| the coordination skills orchestrating-work, delegating-authority, reporting-state | retire | the simulator keeps their protocol as its reference coordinator; stagehand's orchestrating-development stays its maintainer's own and takes none of it |
| `adapters/claude/plugin.json`, `adapters/codex/plugin.json` (packaged those skills) | move | Skilldex's marketplace, one plugin per install set; the adapters keep the field notes |
| `schemas/`, `state-machines/`, `standards/`, `playbook/`, `adapters/`, `tools/`, `examples/` | stay | promptbook; `lint`, `eval-routing` and `import-evals` run against a Skilldex checkout |
| the review record | rename | the `agent-setup-review` contract, which Skilldex's reviewing-agent-setup writes |

### Skilldex (L3)

| Today | Move | Target |
|---|---|---|
| `building-skills`, `preparing-pull-requests`, `resolving-findings`, `reviewing-code`, `writing-specifications` | stay | the library's own; building-skills authors a skill and evaluating-skills measures one |
| promptbook's skills | add | `skills/<gerund-name>/`; writing-requirements (an epic's requirements traced to journeys) beside writing-specifications (one change's spec) |
| stagecraft's generic skills | merge | the stack-neutral, proven detail goes into the matching Skilldex skill (the table below); the rest stays in stagecraft |
| no install sets, manifest or lock | add | `skills/SETS.yaml` (`personal`, `planning`, `delivery`, `maintainer`; `full`, the library, never installed) and a marketplace plugin per set; consumers pin by commit and tree, `0.0.0+<sha>` while untagged, with the `sets` they install; a retired skill keeps a stub one release |
| `.gemini/skills/*`, `epiphany_knowledge/`, `skills/.specs/` | stay | Skilldex's own authoring workspace and design specs, not packaged |

### stagecraft (L2 source plus L4 sets; formerly agentic-template)

What a new project starts with, and one opinionated stack pack per kind of project under `sets/`.
Children keep their L2 files, pin promptbook and Skilldex in `toolkit.lock`, and sync the rest.

| Today | Move | Target |
|---|---|---|
| `AGENTS.md` (195 lines, GENERIC and DOMAIN blocks) | trim to ~120 lines | the L2 map: north star, commands, pointers, domain rules, the rendered standards block. Hard rules 2, 3, 5, 6, 7 and 9 become ENG-3, 4, 1, 6, 8 and 5; rule 8 is L1 taste; rule 4 (`/ship`) stays as the Definition of Done; "failure is explicit" becomes ENG-7; rules 1 and 10, the other engineering guardrails and the stack block move to `sets/webapp-saas/` |
| `CLAUDE.md` (`@AGENTS.md`), `.github/copilot-instructions.md` | stay | L2 loaders; add `.gemini/settings.json` |
| `.claude/rules/style.md` | delete | every line is L1 taste or an ENG invariant |
| `.claude/rules/stack.md`, `angular.md`, `contracts.md`, `drizzle.md`, `nestjs.md`, `testing.md` | move | `sets/webapp-saas/`, delivered as nested `apps/*/AGENTS.md` with `CLAUDE.md` shims |
| `.claude/hooks/pre-tool-safety.mjs`, `guard-secrets.mjs`, `post-edit-check.mjs`, `verify-done.mjs` | stay | the walls; the ask tier documented as a convenience (ADR-0021); add a deny for Bash redirects into protected paths; port to `.codex/hooks.json` |
| `.claude/settings.json` | stay | L2 walls and project wiring |
| `specs/`, `_TASK-TEMPLATE.md`, `_SPEC-TEMPLATE.md`, `_CUJ-TEMPLATE.md` | stay | the L2 queue; task frontmatter validated by promptbook's `task` (a superset: `requirements`, `touches`, `risk`, `inputs`, `evaluator`, `budget`, `sessions`, `mode`, `lands_to`, a Working notes section) |
| `docs/workflow.md`, `roles.md`, `interjection.md`, `concurrency.md`, `observability.md`, `ears.md` | stay | stagecraft's implementation of promptbook's state machines and contracts; link the playbook instead of restating it |
| `CONTRIBUTING-agents.md`, `LOOPING.md` | stay | the sequential loop's and the CI agents' docs; generic doctrine is promptbook's playbook |
| `docs/mandate.md`, `operating-guide.md`, `ci-cd.md`, `app-classes.md`, `data-views.md`, design and readiness templates | move | `sets/webapp-saas/` |
| `DECISIONS.md` | split | ADR-0002, 0010, 0020, 0021 stay at the root; the mandate ADRs 0003–0019 → `sets/webapp-saas/`; each child keeps its own |
| `knowledge/`, `FUTURE.md`, `PORTFOLIO.md` | move | `sets/webapp-saas/`; children keep their own knowledge |
| `scripts/loop.mjs` | stay | the sequential loop (with the `fix/agent-run-caps` changes); its run records are promptbook `run-record` lines |
| `scripts/board.mjs`, `next.mjs`, `check.mjs`, `protected-paths.mjs`, `secret-scan.mjs`, `conflict-classify.mjs`, `runlog.mjs`, `release.mjs`, `sync-template.mjs`, `decision-drift.mjs` (on `fix/stack-drift`) | stay | the stack-neutral gates; `check.mjs` runs the pinned `promptbook` CLI from the lock's `kind: promptbook` entry |
| `scripts/ears-lint.mjs`, `ears-coverage.mjs` | delete once replaced | `promptbook validate` and `promptbook trace` run the same checks |
| `scripts/skill-evals.mjs` | replace | `promptbook eval-routing --runner "<cli>"`; each skill's `evals.md` converts once with `promptbook import-evals` |
| `scripts/deploy-check.mjs`, `ci-config.mjs`, `launch-check.mjs`, `dev-server.mjs`, `drift-check.mjs` | move | `sets/webapp-saas/` |
| `.github/workflows/agent-coder.yml`, `agent-merge.yml`, `agent-planner.yml`, `agent-reviewer.yml`, `nightly.yml` | stay | the CI agents; pin `--permission-mode dontAsk`, an allowlist and caps |
| `app-ci.yml`, `train.yml`, `preview.yml`, `probe.yml`, `canary-watch.yml`, `backup-check.yml`, `restore-drill.yml`, `scrub.yml` | move | `sets/webapp-saas/` |
| `template-check.yml`, `template-sync.yml`, `skill-evals.yml` | stay | the template's own checks (turn skill evals on) |
| `.claude-plugin/marketplace.json` (one plugin, `agentic`) | change | the stack skills' plugin for `sets/webapp-saas/`; generic skills come from Skilldex's marketplace, pinned by `sha` |
| no `toolkit.lock` | add | pins promptbook (`kind: promptbook`) and Skilldex (`kind: skill-library`, `sets: [planning, delivery]`); `promptbook lock --check` in CI |
| `template-update/` | land or delete | its content is now ADRs 0011–0020, the playbook and the sets |
| `.agent/` (gitignored) | stay | L4 runtime state in the checkout |

**The 19 skills.** Each one ported keeps only what is stack-neutral and proven in its Skilldex
target, and its stagecraft copy is deleted in the same change; stack or template specifics stay in
stagecraft as a short reference or in `sets/webapp-saas/`.

| Skill today | Target |
|---|---|
| `task-next` | Skilldex implementing-task |
| `planner` | Skilldex planning-work |
| `feature-planning` | Skilldex framing-products, mapping-journeys, writing-requirements, designing-flows, choosing-architecture |
| `test-author` | Skilldex writing-tests |
| `debug-forensics` | Skilldex debugging-failures |
| `commit-history` | Skilldex writing-commit-history |
| `security-review` | Skilldex reviewing-security |
| `code-review` | Skilldex reviewing-code |
| `promote-to-template` | Skilldex promoting-learnings; the template's registration steps stay as a stagecraft reference |
| `conflict-resolver` | Skilldex landing-changes (its classifier table) |
| `bootstrap`, `ship`, `nightly-audit` | stay in stagecraft |
| `adopt-template` | stays, renamed adopting-stagecraft |
| `reviewer` | stays: the CI wrapper, which calls Skilldex reviewing-code |
| `deploy-readiness`, `launch-readiness`, `landing-page`, `migration-safety` | `sets/webapp-saas/` |

**The 4 subagents** stay in stagecraft as per-engine definitions generated from one role list, with
explicit models (no `inherit` for cost-sensitive roles):

| Subagent | Change |
|---|---|
| `explorer` (read-only, sonnet, low effort) | a cheaper model at low effort; returns `path:line` per the `return` contract |
| `reviewer` (findings only) | the evaluator role; a different model family where the runtime allows; a verdict before `human-review` on every task (risk sets its trials) |
| `test-runner` (failures only) | unchanged role; explicit model |
| `coder` (worktree isolation) | explicit model and effort by task `size`; budget caps |

### stagehand (L4 runtime)

| Today | Move | Target |
|---|---|---|
| `skills/orchestrating-development/` and references | stay | the suite's one coordinator skill, as its maintainer keeps it; promptbook's former orchestrating-work, delegating-authority and reporting-state survive as the simulator's reference coordinator, the protocol the state machines describe, which stagehand need not follow |
| `templates/AGENTS.local.md` → `.local/AGENTS.md` | L1 | done: the dotfiles seed it from the template at the pin when absent, on the devbox; the user fills it in (stagehand allows a symlink to a private config repo) |
| `.orchestrator/` (task records, the project note, wake state) | stay | L4 runtime state, untracked, in stagehand's own formats; promptbook's `task-record` reads the records as they are |
| `plugins/agent-wake`, `plugins/status-board` | stay | Herdr plugins; the dotfiles link agent-wake from the pinned checkout on the devbox; the status board is optional and installed by hand |
| `.codex/rules/herdr.rules` | stay | the reference for how `promptbook compile-policy` emits Codex `prefix_rule` tiers |
| no Claude Code setup | done | `CLAUDE.md` imports `AGENTS.md`; `.claude/skills/orchestrating-development` links the skill; `.claude/settings.json` mirrors `herdr.rules` (its allow entries apply once the workspace is trusted) |
| `docs/design/*` | stay | cited by the playbook |

### dotfiles (L1)

| Today | Move | Target |
|---|---|---|
| `home/.chezmoitemplates/AGENTS.md`: How I work, Platforms, Code, Git, Safety | split | keep taste (match surrounding code, no comments, least abstraction, dead code, line-level notes, platforms, pnpm/uv/mise); **delete** Git and Safety and the duplicated Code rules; render the standards block from the pinned promptbook in their place; "Act; don't pause for approval" becomes the policy tier |
| `home/dot_claude/CLAUDE.md.tmpl`, `home/dot_codex/AGENTS.md.tmpl` | stay | renderers of the shared template; **add** `home/dot_gemini/GEMINI.md.tmpl` |
| `home/dot_claude/settings.json.tmpl`: bypass default, allow and deny lists, `autoMode`, herdr hook, `attribution`, `extraKnownMarketplaces.agentic` | generate | permissions, mode and `autoMode` compiled from `agent-policy.yaml`; never `disableAllHooks`; herdr hook and `attribution` stay; the marketplace entry pinned by `sha`; drop `advisorModel: opus` over an Opus main model unless an eval shows a gain |
| no Codex `config.toml` or rules | add | `home/dot_codex/config.toml.tmpl` and `home/dot_codex/rules/*.rules`, compiled from the same policy |
| no Gemini/Antigravity config | deferred | no profile runs Gemini; `promptbook compile-policy` emits its policy when one does |
| no user-scope skills | done | `run_after_24-agent-checkouts.sh.tmpl` cloning each pinned checkout that has a source URL into its path (`~/src/skilldex`, `~/src/stagehand`) at the pinned commit when absent, never touching an existing one (a chezmoi external cannot pin a commit and check its tree); `run_onchange_after_27-agent-skills.sh.tmpl` copying Skilldex's `personal` set (from its `skills/SETS.yaml` at the pin) and the herdr skill into `~/.agents/skills/` and `~/.claude/skills/`; never the whole library, which exceeds the 8,000-character description budget (`promptbook lint --budget-set personal --sets <skilldex>/skills/SETS.yaml`) |
| no policy or lock | done | `home/.chezmoidata/agent-policy.yaml`, compiled by `scripts/compile-agent-policy.sh` (`promptbook compile-policy`) into committed templates that `check-agent-policy.sh` keeps in step, so a machine applies without Node; `toolkit.yaml` (promptbook, Skilldex with `sets: [personal]`, stagehand, herdr, each by commit and tree); `agents.yaml` not yet |
| `home/dot_config/mise/config.toml.tmpl` (`herdr = "0.9.3"`) | stay | already pinned; mirrored as a lock entry so bumps are reviewed with the stagehand and Heeler floors |
| `run_once_after_25-claude-code`, `run_once_after_26-herdr-integrations` | stay | L1 installs agents and Herdr integrations |
| `private_secrets.sh.tmpl`, `private_dot_ssh/config.tmpl` | stay | L1 secrets wiring; no vault on always-on boxes |
| `README.md` network section (tailnet ACL: prod unreachable from the devbox) | stay | the precondition of the devbox's bypass tier, named in `agent-policy.yaml` `requires` |
| `ADOPT.md` | extend | also inventory `~/.agents/skills`, Codex rules and Gemini config |
| the repo's own `AGENTS.md` and `CLAUDE.md` | stay | they are the dotfiles repo's L2 |

### Herdr and Heeler (L4 runtime, installed by L1)

| Today | Move | Target |
|---|---|---|
| Herdr via mise, `herdr = "0.9.3"` | stay | pinned; bumps by PR, checked against `min_herdr_version` floors (agent-wake 0.8.2, status board 0.9.0, Heeler 0.7.5) and the `herdr api schema --json` output |
| `herdr integration install claude` / `codex` | stay | L1 run script |
| `herdr` skill | add | user-scope skill for the coordinator only, pinned |
| Herdr states and events | map | `adapters/herdr`: `blocked` → `needs-human`; `working`; `idle`/`done` reconcile only, never advance status |
| Heeler app on the iPhone | stay | personal device; nothing in a repo |
| Heeler host plugin (`heeler` 0.6.0) | pin, not yet done | installed by hand today; to be installed with `--ref <tag>`, not `main`, once the push relay (developer-hosted by default) is chosen as an L1 decision |

## Evolution

How the layers change over time. Each step has its own page.

- **Promotion** runs trial → project → pack → user, with gates (generic test, routing eval at 100%,
  scenarios at pass^k, three evidence entries, a security read) and a rename on promotion, because
  engines resolve name collisions in opposite directions. → [promotion-and-deprecation](playbook/learning/promotion-and-deprecation.md)
- **Pinning.** Every consumer pins L3 and L4 in a lock; third-party packs are mirrored at a commit with
  auto-update off; bumps arrive as pull requests that run the eval suite. → [promotion-and-deprecation](playbook/learning/promotion-and-deprecation.md)
- **Deprecation** sets `metadata.deprecated` for one minor release, adds a rename entry, and adds an
  eval that fails if the old skill still triggers; then deletes it. → [promotion-and-deprecation](playbook/learning/promotion-and-deprecation.md)
- **Evals** decide every promotion and every bump. → [evals-and-evidence](playbook/learning/evals-and-evidence.md)
- **The reflector** reads evidence logs and run records on a schedule and opens small delta pull
  requests against L2 knowledge, Skilldex skills or stagecraft sets, never auto-merged. → [reflection-loop](playbook/learning/reflection-loop.md)
- **Agent-setup review** on each model release runs an effort sweep and deletes components that are no
  longer load-bearing, in whichever layer they live. → [agent-setup-review](playbook/learning/agent-setup-review.md)
