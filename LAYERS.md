# Layers

Where each piece of an agent setup lives, why, and how the user's repos move there. As of
2026-10-13. Practices are in [playbook/](playbook/00-index.md); shared rules are in
[standards/engineering.md](standards/engineering.md); contract names are defined in
[CONTRACTS.md](CONTRACTS.md).

## The four layers

| Layer | Lives in | Holds | Seen by |
|---|---|---|---|
| **L1 personal** | the user's chezmoi dotfiles (private) | taste, the autonomy tier per machine profile, installed agents and runtimes, user-scope skill fan-out, secrets wiring, personal MCP | the user's own sessions on the user's machines, every repo |
| **L2 project** | each product repo, generated and synced from the template | a thin `AGENTS.md` map, walls (hook denies, permission deny rules), `specs/` queue, product docs, `DECISIONS.md`, `knowledge/`, `toolkit.lock`, read-only MCP config | every agent, collaborator, cloud session and CI job on that repo |
| **L3 harness** | this repo, tagged releases | playbook, standards, contracts (schemas, state machines), portable skills, evals, validator, simulator, policy compiler, adapters | whoever pins it |
| **L4 implementations** | agentic-template's core and stack packs; runtimes (the CLI loop and forge-event CI agents; stagehand on Herdr with Heeler); vendor packs mirrored at a pin | bindings of L3 to an engine, stack, runtime or vendor | whoever selects it in `toolkit.lock` |

**Precedence, in one line: L1 decides how often an agent asks, L2 decides what is never allowed, L4
decides how much a run may spend; L3 defines the contracts all three speak.** No layer can loosen a
layer that decides something else: a personal bypass cannot lift a project deny, and a runtime budget
cannot authorize what a wall forbids.

Dependencies point one way. L1, L2 and L4 depend on a pinned L3; L2 selects L4 packs through
`toolkit.lock`; L3 depends on nothing.

## The decision test

Ask two questions of any artifact: **who must see it, and does it name an engine or stack?**

1. Must every agent, collaborator, cloud session and CI job on one repo obey it? → **L2**. If the same
   rule holds for every repo, its text is an L3 standard rendered into L2.
2. Does it apply only to you, in every repo, and to nobody else? → **L1**.
3. Is it reusable across projects and free of engine, runtime, stack and vendor names? → **L3**.
4. Does it bind something to a specific engine, runtime, stack or vendor? → **L4**, or a thin mapping
   in L3 `adapters/`.

Tie-breakers: a rule about *how often to ask* is L1; about *what is never allowed* is L2; about *how
much to spend* is L4. A file that names Claude, Codex, Gemini or Herdr is not L3 practice; it is an
adapter or an L4 pack.

## Artifact map

Engine columns give the concrete path the artifact lands at. `~` is the user's home; other paths
are relative to the repo root. "Unverified" marks a path documented inconsistently or not measured;
`adapters/<engine>/README.md` records the current check.

### Instructions, rules, policy

| Artifact | Layer | Source of truth | Claude Code | Codex | Gemini CLI / Antigravity |
|---|---|---|---|---|---|
| Personal instructions (taste, platforms) | L1 | `home/.chezmoitemplates/AGENTS.md` | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | `~/.gemini/GEMINI.md` (Antigravity still reads it) |
| Engineering invariants | L3 text, rendered into L1 and L2 | `standards/engineering.md` (block between the markers) | inside both files above and below | same | same |
| Project instructions (the map) | L2 | `AGENTS.md`, under ~120 lines | `CLAUDE.md` containing `@AGENTS.md` | `AGENTS.md` (native; 32 KiB combined cap) | `.gemini/settings.json` `context.fileName: ["AGENTS.md"]` |
| Stack guardrails by directory | L4 pack, installed into L2 | the pack | `apps/<x>/AGENTS.md` plus a `CLAUDE.md` shim (loads on demand) | nested `AGENTS.md` (read when launched there) | nested `AGENTS.md` (just in time) |
| Autonomy tier per machine profile | L1 | `home/.chezmoidata/agent-policy.yaml` (`policy` schema), compiled by `tools/compile-policy.mjs` | `~/.claude/settings.json` `permissions.defaultMode`, `autoMode` | `~/.codex/config.toml` permission profile; `~/.codex/rules/*.rules` | `~/.gemini/settings.json` (Antigravity path unverified) |
| Walls | L2 | hook scripts plus deny rules, delivered by the core pack | `.claude/settings.json` `PreToolUse` hooks and `permissions.deny` | `.codex/rules/*.rules` (`forbidden`); hooks via `hooks.json` (project path unverified); trusted projects only | `.gemini/settings.json` (hooks format unverified) |
| Personal deny rules (secrets, credentials) | L1, added on top of L2 | `agent-policy.yaml` `deny_read`, `forbid` | `~/.claude/settings.json` `permissions.deny`; sandbox `filesystem.denyRead` | `~/.codex/rules/*.rules` | `~/.gemini/settings.json` |
| Egress allowlist | L1 per profile; L2 may narrow | `agent-policy.yaml` `egress` | sandbox `network.allowedDomains` | config permission profile | unverified |

### Skills, subagents, tools

| Artifact | Layer | Source of truth | Claude Code | Codex | Gemini CLI / Antigravity |
|---|---|---|---|---|---|
| Portable skills (engine- and stack-neutral) | L3 | `skills/<gerund-name>/` here, or an upstream pinned in `toolkit.lock` (Skilldex) | copied to `~/.claude/skills/` or `.claude/skills/` (Claude does not read `.agents/skills`) | `~/.agents/skills/`, `.agents/skills/` | `~/.agents/skills/` alias, `.agents/skills/`; Antigravity global `~/.gemini/antigravity-cli/skills/` (verify on install) |
| Stack and vendor pack skills | L4 | the pack, published as a plugin | plugin from `.claude-plugin/marketplace.json`, pinned by `sha` | `.codex-plugin/plugin.json`; marketplace `.agents/plugins/marketplace.json` | Antigravity plugin (unverified) |
| Project domain skills | L2 | `.agents/skills/<name>/` | synced copy in `.claude/skills/<name>/` | read natively | read natively |
| Personal skills | L1 | a skill source repo pinned in the dotfiles | `~/.claude/skills/` (fan-out copy) | `~/.agents/skills/` | `~/.agents/skills/` |
| Trial skills | trial (no layer yet) | an untracked folder | the engine's personal or project skills dir, never committed | same | same |
| Coordinator skill (e.g. stagehand's) | L4 runtime | the runtime's control workspace only | that workspace's skills dir | `.codex/skills/` in that workspace | same |
| Subagent role contract (purpose, return shape) | L3 | `return` schema; role notes in `adapters/` | — | — | — |
| Subagent definitions (model, effort, tools, isolation) | L4 pack, installed into L2 | generated per engine from the pack | `.claude/agents/<role>.md` | `.codex/agents/<role>.toml` | `.gemini/agents/<role>.md` |
| Project MCP servers (read-only, `${VAR}` credentials) | L2 | one list in the pack's config | `.mcp.json` | `.codex/config.toml` `[mcp_servers]` | `.gemini/settings.json`; Antigravity `.agents/mcp_config.json` |
| Personal MCP servers (keychain-backed) | L1 | `agent-policy.yaml` or a run script | `~/.claude.json` via `claude mcp add --scope user` (the file is tool-written; never template it) | `~/.codex/config.toml` | Antigravity `~/.gemini/config/mcp_config.json` (documented inconsistently; verify) |

### Runtime, state, secrets

| Artifact | Layer | Where |
|---|---|---|
| Installed agents and runtimes, pinned | L1 | `home/.chezmoidata/packages.yaml`; `home/dot_config/mise/config.toml.tmpl` (`herdr = "0.9.3"`); install scripts in `home/.chezmoiscripts/` |
| Per-role model and effort for personal sessions | L1 | `home/.chezmoidata/agents.yaml` (new), compiled into each engine's settings |
| Runtime config for unattended runs (mode, allowlist, caps, model per role) | L4 | the runtime: the CLI loop's flags and `AGENT_MAX_*` env; CI workflow env; stagehand's `.local/AGENTS.md` |
| Task queue | L2 | `specs/<epic>/tasks/*.md`, validated against L3 `task` |
| Runtime task records | L4, untracked in L2 checkout or control workspace | `.orchestrator/tasks/<id>.yaml` (`task-record`) |
| Run records | L4 writes; L3 schema | `.agent/loop-runs.jsonl` (gitignored), one `run-record` per run |
| Authority grants | L4 runtime, issued by a human | the runtime's project note, as `grant` documents |
| CI agents (planner, coder, reviewer, merge) | L4 runtime, installed into L2 | `.github/workflows/agent-*.yml`; engine binding in `adapters/ci` |
| Secrets, personal | L1 | Bitwarden note rendered to `~/.config/shell/secrets.sh` (mode 600) at apply time |
| Secrets, CI and stages | L2 names them, the forge holds them | forge environments and secrets; never a file |
| Environment rules (what each stage may touch) | L2 walls plus L4 pack workflows; L1 network isolation | deny rules and `.env.example` (generated) in L2; per-stage environments in the forge; tailnet ACL keeping production unreachable from the devbox |
| Product docs | L2 | `docs/product/brief.md`, `docs/product/personas/`, `docs/ux/<epic>.md`, `docs/` chapters |
| ADRs | L2 per project; L4 for a pack's own decisions | `DECISIONS.md` |
| Knowledge (verified vendor and pricing learnings) | L2 per project; L4 pack when cross-project | `knowledge/<topic>.md` with source and verification headers |
| Lockfile | L2 and L1 | L2 `toolkit.lock`; L1 `home/.chezmoidata/toolkit.yaml` (the same entries under one key) feeding `home/.chezmoiexternal.toml.tmpl` |
| Telemetry export | L1 per machine, L4 per runtime; L3 schema | engine telemetry env (Claude: `CLAUDE_CODE_ENABLE_TELEMETRY=1`); OTel GenAI spans to a backend chosen in L4 |

## What ADR-0021 means for L1 and L2

The measured matrix (Claude Code 2.1.296, 2026-10-13; agentic-template ADR-0021 on branch
`docs/adr-permission-precedence`, commit `c177fa1`, not yet on master) is in
[permissions-and-autonomy](playbook/runtime/permissions-and-autonomy.md). Its consequences per layer:

| Layer | May | Must not | Must |
|---|---|---|---|
| L1 | choose `bypassPermissions` on the devbox profile and `auto` with the sandbox on workstations; add allow rules, auto-mode rules and deny rules | set `disableAllHooks` in user settings or `--settings`; remove or override a project deny | keep bypass to profiles where production is unreachable by network ACL and the agent runs non-root in a sandbox or container |
| L2 | ship `ask` hooks as conveniences for interactive users | rely on an `ask` as protection; rely on a project `defaultMode` (the flag and user defaults outrank it) | express every guardrail behind ENG-3, ENG-4 and ENG-5 as a hook `deny` or a `permissions.deny` rule; keep branch protection as the backstop; deny Bash redirects into protected paths |
| L4 | set caps per run and per grant | auto-approve asks; run unattended without a pinned mode | launch every unattended run with `--permission-mode dontAsk` plus `--allowedTools` and turn and budget caps; report `permission_denials` as questions for a human |

The policy compiler's contract (`tools/compile-policy.mjs`) is to refuse an L1 tier that sets
`disableAllHooks` or drops a project deny (HAR-2). Only managed settings can force hooks on; on a shared machine, put the bypass and hook locks
there. Codex and Gemini were not measured: their adapters compile the same intent (forbidden prefix
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

## Your repos today → target

### dotfiles (L1)

| Today | Move | Target |
|---|---|---|
| `home/.chezmoitemplates/AGENTS.md`: How I work, Platforms, Code, Git, Safety | split | keep taste (match surrounding code, no comments, least abstraction, dead code, line-level notes, platforms, pnpm/uv/mise); **delete** Git and Safety and the duplicated Code rules; render the standards block from the pinned harness in their place; "Act; don't pause for approval" becomes the policy tier |
| `home/dot_claude/CLAUDE.md.tmpl`, `home/dot_codex/AGENTS.md.tmpl` | stay | renderers of the shared template; **add** `home/dot_gemini/GEMINI.md.tmpl` |
| `home/dot_claude/settings.json.tmpl`: bypass default, allow and deny lists, `autoMode`, herdr hook, `attribution`, `extraKnownMarketplaces.agentic` | generate | permissions, mode and `autoMode` compiled from `agent-policy.yaml`; never `disableAllHooks`; herdr hook and `attribution` stay; the marketplace entry pinned by `sha`; drop `advisorModel: opus` over an Opus main model unless an eval shows a gain |
| no Codex `config.toml` or rules | add | `home/dot_codex/config.toml.tmpl` and `home/dot_codex/rules/*.rules`, compiled from the same policy |
| no Gemini/Antigravity config | add | `home/dot_gemini/settings.json.tmpl`; verify the Antigravity path on install |
| no user-scope skills | add | `home/.chezmoiexternal.toml.tmpl` cloning the pinned harness, Skilldex and the herdr skill into `~/.agents/sources/`; `run_onchange_after_27-agent-skills.sh.tmpl` linking them into `~/.agents/skills/` and copying into `~/.claude/skills/` |
| no policy or lock | add | `home/.chezmoidata/agent-policy.yaml`, `agents.yaml`, `toolkit.yaml` |
| `home/dot_config/mise/config.toml.tmpl` (`herdr = "0.9.3"`) | stay | already pinned; mirrored as a lock entry so bumps are reviewed with the stagehand and Heeler floors |
| `run_once_after_25-claude-code`, `run_once_after_26-herdr-integrations` | stay | L1 installs agents and Herdr integrations |
| `private_secrets.sh.tmpl`, `private_dot_ssh/config.tmpl` | stay | L1 secrets wiring; no vault on always-on boxes |
| `README.md` network section (tailnet ACL: prod unreachable from the devbox) | stay | the precondition of the devbox's bypass tier, named in `agent-policy.yaml` `requires` |
| `ADOPT.md` | extend | also inventory `~/.agents/skills`, Codex rules and Gemini config |
| the repo's own `AGENTS.md` and `CLAUDE.md` | stay | they are the dotfiles repo's L2 |

### agentic-template (L2 source plus L4 packs)

The template splits into two plugins from one marketplace: **agentic-core** (stack-neutral
machinery) and **agentic-saas** (the mandate's stack). Its CLI loop and forge-event agents become the
**claude-cli runtime**, a peer of stagehand. Children keep their L2 files and pin both packs.

| Today | Move | Target |
|---|---|---|
| `AGENTS.md` (195 lines, GENERIC and DOMAIN blocks) | trim to ~120 lines | L2 map: north star, commands, pointers, domain rules, the rendered standards block. Hard rules 2, 3, 5, 6, 7 and 9 become ENG-3, 4, 1, 6, 8 and 5; rule 8 is L1 taste; rule 4 (`/ship`) stays as core's Definition of Done; the guardrail "failure is explicit" becomes ENG-7; rules 1 and 10, the other engineering guardrails and the stack block move to agentic-saas; the agent-model table moves to the runtime's docs |
| `CLAUDE.md` (`@AGENTS.md`), `.github/copilot-instructions.md` | stay | L2 loaders; add `.gemini/settings.json` |
| `.claude/rules/style.md` | delete | every line is L1 taste or an ENG invariant |
| `.claude/rules/stack.md`, `angular.md`, `contracts.md`, `drizzle.md`, `nestjs.md`, `testing.md` | move | agentic-saas; delivered as nested `apps/*/AGENTS.md` with `CLAUDE.md` shims for portability |
| `.claude/hooks/pre-tool-safety.mjs`, `guard-secrets.mjs`, `post-edit-check.mjs`, `verify-done.mjs` | move to core | L2 walls delivered by agentic-core; ask tier documented as convenience (ADR-0021); add a deny for Bash redirects into protected paths; port to `.codex/hooks.json` |
| `.claude/settings.json` | stay | L2 walls and project wiring |
| `specs/`, `_TASK-TEMPLATE.md`, `_SPEC-TEMPLATE.md`, `_CUJ-TEMPLATE.md` | stay | L2 queue; task frontmatter validated by L3 `task` (a superset: adds `requirements`, `touches`, `risk`, `inputs`, `evaluator`, `budget`, `sessions`, `mode`, `lands_to`, a Working notes section); the epic's `spec.md` may set the default `mode` |
| `docs/workflow.md`, `roles.md`, `interjection.md`, `concurrency.md`, `observability.md`, `ears.md` | move to core | implementations of L3 state machines and contracts; link the playbook instead of restating it |
| `CONTRIBUTING-agents.md`, `LOOPING.md` | move | the claude-cli runtime's docs; generic doctrine now lives in the playbook |
| `docs/mandate.md`, `operating-guide.md`, `ci-cd.md`, `app-classes.md`, `data-views.md`, design and readiness templates | move | agentic-saas |
| `DECISIONS.md` | split | ADR-0002, 0010, 0020, 0021 → core; mandate ADRs 0003–0019 → agentic-saas; each child keeps its own as L2 |
| `knowledge/` (7 vendor and pricing entries) | move | agentic-saas `knowledge/`; children keep their own |
| `FUTURE.md`, `PORTFOLIO.md` | move | agentic-saas (the umbrella's trigger table and inventory) |
| `scripts/loop.mjs` | move | claude-cli runtime (with the `fix/agent-run-caps` changes) |
| `scripts/board.mjs`, `next.mjs`, `check.mjs`, `protected-paths.mjs`, `secret-scan.mjs`, `conflict-classify.mjs`, `runlog.mjs`, `release.mjs`, `sync-template.mjs`, `decision-drift.mjs` (on `fix/stack-drift`) | move to core | stack-neutral gates |
| `scripts/ears-lint.mjs`, `ears-coverage.mjs` | to core now | superseded by `tools/validate.mjs` once it runs the same checks; delete then |
| `scripts/deploy-check.mjs`, `ci-config.mjs`, `launch-check.mjs`, `dev-server.mjs`, `drift-check.mjs` | move | agentic-saas |
| `scripts/skill-evals.mjs` | move | claude-cli runtime (it shells the CLI); the eval file format is L3 `evidence`; each skill's `evals.md` converts with `harness import-evals` |
| `.github/workflows/agent-coder.yml`, `agent-merge.yml`, `agent-planner.yml`, `agent-reviewer.yml`, `nightly.yml` | move | claude-cli runtime; pin `--permission-mode dontAsk`, allowlist and caps |
| `app-ci.yml`, `train.yml`, `preview.yml`, `probe.yml`, `canary-watch.yml`, `backup-check.yml`, `restore-drill.yml`, `scrub.yml` | move | agentic-saas |
| `template-check.yml`, `template-sync.yml`, `skill-evals.yml` | move | core (turn skill evals on) |
| `.claude-plugin/marketplace.json` (one plugin, `agentic`) | change | two plugins plus SHA-pinned third-party mirrors; add `.agents/plugins/marketplace.json` for Codex |
| `template-update/` | land or delete | its content is now ADRs 0011–0020, the playbook and the packs |
| `.agent/` (gitignored) | stay | L4 runtime state in the checkout |

**The 19 skills.** Planned L3 names are gerunds; a promoted skill is renamed and its template copy
deleted in the same change.

| Skill today | Target | Why |
|---|---|---|
| `feature-planning` | L3 `writing-requirements` | frame → journeys → requirements → UX is engine- and stack-neutral |
| `planner` | L3 `planning-work` | decomposition and readiness against the `task` contract |
| `task-next` | L3 `implementing-task` | claim, worktree, implement against criteria, verify; the CLI specifics go to the adapter |
| `test-author` | L3 `writing-tests` | criterion ids in test names is a contract rule |
| `debug-forensics` | L3 `debugging-failures` | reproduce, isolate, fix, regression test |
| `commit-history` | L3 `writing-commit-history` | git only |
| `security-review` | L3 `reviewing-security` | secrets, authn/z, injection, the lethal trifecta |
| `promote-to-template` | L3 `promoting-learnings`, plus a core reference for the template's registration steps | the generic test and homes by kind are neutral; the manifest steps are not |
| `code-review` | reconcile with Skilldex `reviewing-code` | keep one by eval, deprecate the other |
| `conflict-resolver` | core now; L3 `resolving-merge-conflicts` once the classifier is a portable reference | depends on `conflict-classify.mjs` |
| `ship` | core | the template's Definition of Done; the invariants it enforces are ENG-1 to ENG-6 |
| `reviewer` | claude-cli runtime | the forge-event reviewer; it calls the L3 review skill |
| `nightly-audit` | claude-cli runtime | a scheduled audit |
| `adopt-template`, `bootstrap` | core | template machinery |
| `deploy-readiness`, `launch-readiness`, `landing-page`, `migration-safety` | agentic-saas | stack- or domain-specific |

**The 4 subagents** move to the packs as per-engine definitions generated from one role list, with
explicit models (no `inherit` for cost-sensitive roles):

| Subagent | Target | Change |
|---|---|---|
| `explorer` (read-only, sonnet, low effort) | core | a cheaper model at low effort; returns `path:line` per the `return` contract |
| `reviewer` (findings only) | core | the evaluator role; a different model family where the runtime allows; mandatory before `human-review` for `risk` medium and up |
| `test-runner` (failures only) | core | unchanged role; explicit model |
| `coder` (worktree isolation) | core | explicit model and effort by task `size`; budget caps |

### stagehand (L4 runtime)

| Today | Move | Target |
|---|---|---|
| `skills/orchestrating-development/` and references | stay upstream, pinned | the Herdr runtime's coordinator; its record, attention states, wake rules and grants are generalized as L3 `task-record`, `attention`, `grant` |
| `templates/AGENTS.local.md` → `.local/AGENTS.md` | L1 | rendered by the dotfiles into the control workspace (stagehand allows a symlink to a private config repo) |
| `.orchestrator/` (task records, wake state) | stay | L4 runtime state, untracked; records validate against `task-record` |
| `plugins/agent-wake`, `plugins/status-board` | stay | Herdr plugins; installed by L1 at a pinned commit |
| `.codex/rules/herdr.rules` | stay | the reference for how the policy compiler emits Codex `prefix_rule` tiers |
| `docs/design/*` | stay | cited by the playbook |

### Herdr and Heeler (L4 runtime, installed by L1)

| Today | Move | Target |
|---|---|---|
| Herdr via mise, `herdr = "0.9.3"` | stay | pinned; bumps by PR, checked against `min_herdr_version` floors (agent-wake 0.8.2, status board 0.9.0, Heeler 0.7.5) and the `herdr api schema --json` output |
| `herdr integration install claude` / `codex` | stay | L1 run script |
| `herdr` skill | add | user-scope skill for the coordinator only, pinned |
| Herdr states and events | map | `adapters/herdr`: `blocked` → `needs-human`; `working`; `idle`/`done` reconcile only, never advance status |
| Heeler app on the iPhone | stay | personal device; nothing in a repo |
| Heeler host plugin (`heeler` 0.6.0) | pin | installed with `--ref <tag>`, not `main`; choose the push relay (developer-hosted by default) as an L1 decision |

### Skilldex (portable skills, consumed at a pin)

| Today | Move | Target |
|---|---|---|
| `preparing-pull-requests`, `reviewing-code`, `resolving-findings`, `writing-specifications`, `building-skills` | pin | `toolkit.lock` entries `layer: L3, kind: skill-library` by commit and tree hash, versioned `0.0.0+<sha>` while untagged; fanned out by L1; the harness does not vendor them |
| no versions, manifest or lock | none needed | the lock entry is the version; deprecations follow Skilldex's own retire-outright practice |
| `.gemini/skills/*`, `epiphany_knowledge/` | not consumed | Skilldex's own authoring workspace |
| `skills/.specs/` | stay upstream | design specs, not packaged |

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
  requests against L2 knowledge, L3 skills or L4 packs, never auto-merged. → [reflection-loop](playbook/learning/reflection-loop.md)
- **Harness review** on each model release runs an effort sweep and deletes components that are no
  longer load-bearing, in whichever layer they live. → [harness-review](playbook/learning/harness-review.md)
