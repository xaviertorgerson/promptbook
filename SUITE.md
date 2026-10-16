# The suite

Five repositories, one job each, so that no procedure is written twice. Each README opens with its
mandate in the shape below; this page holds all five, the rules that decide where a thing goes and
which file to edit to change it, the four ways they touch each other, the path from a new machine to
a first feature, how to read what happened, and the 2026 practice each mandate follows. The steps,
from a new machine to a release and back up to the libraries, are [docs/getting-started.md](docs/getting-started.md). As of
2026-10-15. Herdr and Heeler are third-party: dotfiles pins and installs them, and no repository of
the suite holds them.

## In one sentence

Two repositories you fork and make your own (**dotfiles** for the machine, **Skilldex** for the
skills); one shared language everything else speaks (**promptbook**: the file formats, the checks
that read them, the standards); one starter that is copied into each project and then belongs to it
(**stagecraft**); and one runtime installed beside projects, never into them (**stagehand**). The
forks carry opinions you chose; the language carries none it can avoid; the starter carries the
opinions a kind of project needs; the runtime carries Quentin's proven way of running many agents.

## Mandates

| Repo | One job | Owns | Must not contain | Interface it exposes | Versioning | Consumed by |
|---|---|---|---|---|---|---|
| **promptbook** | The master copy: the shared file formats, the engineering standards, the playbook, and the tools that check them | `standards/`, `playbook/`, `schemas/`, `state-machines/`, `adapters/`, `tools/` (validate, trace, lint, compile-policy, lock, install-sets, run, check-requires, report, simulate, eval-routing, import-evals, grant), `examples/`, `SUITE.md` | Skills (all live in Skilldex), runtime coordination, any stack | JSON Schemas + the `promptbook` CLI (npm-style `bin`), SUITE.md | semver tags, pre-1.0 (pin a commit); each schema's `x-version` and each machine's `version`; every change classed additive, behavioral or breaking in `CHANGELOG.md` | stagecraft (gates, lock), dotfiles (policy compile, standards block), Skilldex (lint + routing evals run against it); it reads stagehand's task records, and stagehand depends on none of it |
| **Skilldex** | Every portable skill, with evals, in one library | `skills/<gerund-name>/` (agentskills.io SKILL.md + references + evals), install sets (`SETS.yaml`), routing results, plugin marketplace manifests that package the sets | Engine or stack specifics in a SKILL.md body (engine notes go in `references/engine-notes.md`), coordination runtime, project rules | Agent Skills folders; install sets; `.claude-plugin/marketplace.json` (+ Codex `.agents/plugins/marketplace.json` if documented) | untagged: consumers pin commit + tree (`0.0.0+<sha>`); each skill's `metadata.version`; a deprecated skill keeps a stub one release | dotfiles (personal set), stagecraft projects (planning + delivery sets, pinned in toolkit.lock), stagehand (roles use review/PR/findings skills) |
| **stagehand** | Run many agents at once on Herdr: one coordinator, an author and an independent reviewer per task, each in its own worktree and pane; humans keep merge authority unless delegated | the orchestrating-development skill + references, Herdr plugins (agent-wake, status-board), the coordinator setup for Codex (rules) and Claude Code (settings), its task-record template and project-delegation practice | General-purpose procedures (uses Skilldex), project rules | Herdr runtime; follows a project's own instructions for its task queue; keeps its own task records (promptbook's `task-record` contract reads them unchanged) and records a delegation as a project note | pinned by commit (plugins installed at a ref); each plugin's `min_herdr_version` floor against dotfiles' Herdr pin | the user (via dotfiles install), any stagecraft project |
| **stagecraft** | What a new project starts with: AGENTS.md map, walls (hooks + deny rules), the `specs/` queue and planning templates, the sequential loop and CI agents, gates, and one opinionated stack pack per kind of project ("sets") | `AGENTS.md`, `.claude/` walls and hooks, `specs/`, `docs/` templates, `scripts/` gates, `.github/workflows/`, `toolkit.lock`, `sets/webapp-saas/` (a manifest naming the stack-owned rules, docs, ops and stack skills where engines read them; a gate keeps the always-loaded core free of the set's terms) | Generic skills (pins Skilldex), generic checking tools (pins promptbook) | `toolkit.lock` (pins promptbook + Skilldex + install sets, which `scripts/skills-sync.mjs` installs through `promptbook install-sets`), template sync to children (the `stagecraft` plugin or the sync manifest) | a child records the stagecraft commit it last synced; the pins it hands down are its `toolkit.lock` entries, bumped by reviewed pull requests | each product repo |
| **dotfiles** | Set up a machine and how agents behave for this user everywhere | autonomy policy per profile, personal taste, installs and pins (agent CLIs, Herdr; on the devbox, stagehand's control workspace and wake relay), the pinned checkouts, personal skill set from Skilldex | project rules, skill sources | chezmoi | each machine applies its branch's head; everything it installs is pinned in `toolkit.yaml` and the mise config | the user's machines |

## Where a thing goes

The walls between the repositories are rules, not taste. Apply them in order; the first that
decides, decides.

1. **Owner.** A different maintainer means a different repository. The suite integrates through
   its published interface and never reshapes its workflow (Skilldex and stagehand are Quentin's).
2. **Scope of effect.** What affects only me, on my machines, invisible to collaborators and CI, is
   dotfiles'. What affects everyone who works in one project is that project's (started from
   stagecraft).
3. **Copied or pinned.** A starter is copied and then owned by the copy (fork and own); a library is
   pinned at a version and upgraded (depend and bump). A copied thing and a pinned thing never share
   a repository, or a reader cannot tell what is theirs to edit.
4. **Shared by independent consumers.** What two repositories that must not depend on each other
   both need lives in its own repository that depends on neither: dotfiles must not depend on a
   project starter, and Quentin's repositories must not depend on mine.
5. **Opinion gradient.** Neutral pieces never import opinionated ones. A library holds neutral or
   opt-in content; opinionated assemblies (stagecraft and its sets) compose them.
6. **Change rate.** Contracts change slowly, each change classed additive, behavioral or breaking;
   templates change often.

| Repo | Owner | Scope | Mode | Opinion | Holds |
|---|---|---|---|---|---|
| dotfiles | Xavier | my machines | applied (chezmoi) | personal | agent CLIs and their pins, autonomy per machine, the personal skill set, connectors at user scope, taste |
| Skilldex | Quentin | any repo, any machine | installed by set (copy or plugin) | procedures, pick and choose | portable skills with evals; install sets; third-party skills are pinned beside it, not inside it |
| stagehand | Quentin | a control workspace | installed runtime | his proven orchestration | the parallel coordinator on Herdr |
| promptbook | Xavier | any repo, any machine | pinned library | neutral, opt-in | file formats, the tools that check them (validate, trace, lint, compile-policy, lock, report), the always-on engineering standards, the dated playbook |
| stagecraft | Xavier | one project | copied starter | opinionated by design | the project map, walls, spec-driven queue, gates, CI/CD, trust profiles, and one stack per kind of project (`sets/`) |

promptbook exists because of rule 4: dotfiles, stagecraft projects and Skilldex's maintainers all
use its formats and tools, and none of them may depend on another. So it never holds a skill, a
stack, or anything that forces a process: its workflow formats are opt-in (`trace` reports an
adoption level), a project's trust profile is that project's choice, and its lint gives its own
style as advice to a library that has not asked for it.

### To change X, edit Y

| To change | Edit | Where | Then |
|---|---|---|---|
| a skill (a procedure an agent loads) | `skills/<gerund-name>/` (SKILL.md, references, evals) | Skilldex, by a pull request in its maintainer's voice; a project's own domain skill stays in its `.agents/skills/` | consumers bump the Skilldex pin (`toolkit.lock`, or dotfiles' `toolkit.yaml`) |
| a stack convention (a framework's rules) | the set's rules and nested `AGENTS.md` | stagecraft `sets/<stack>/` | children take it at their next template sync |
| a personal preference (taste, platforms, tools) | the shared instructions template; packages or the mise config | dotfiles `home/.chezmoitemplates/AGENTS.md`, `home/.chezmoidata/packages.yaml`, `home/dot_config/mise/` | `chezmoi apply` on each machine |
| autonomy (how often an agent asks on a machine) | `agent-policy.yaml` (`policy` contract) | dotfiles | `promptbook compile-policy`, then commit the compiled settings |
| a wall (what is never allowed in a project) | the hooks and deny rules | the project's walls, from stagecraft's template | a human's reviewed commit; a grant never changes policy (`change-policy`) |
| what lands without a human | `governance.yaml` (the trust profile) and the ADR that chose it | the project | a human's commit to a protected path; the forge's rulesets follow it |
| a file format | its schema, fixtures and tests, or a state machine | promptbook `schemas/`, `state-machines/` | a CHANGELOG line with its class; consumers bump the pin |
| a check | the tool and its tests | promptbook `tools/`; a stack's gate in stagecraft `scripts/` or its set | the same |
| the standards | the block in `standards/engineering.md`, raising its `v<n>` | promptbook | dotfiles re-vendors the block (`scripts/compile-agent-policy.sh`); stagecraft's sync re-renders it into `AGENTS.md` |
| a CI job | the workflow | the project's `.github/workflows/`, from stagecraft; a stack's jobs in `sets/<stack>/` | the template sync carries it to children |
| a deploy step | the set's deploy workflow, scripts and runbook | stagecraft `sets/<stack>/`; a product's own steps in the product | rehearse it before it is trusted (ENG-14) |
| the coordinator | orchestrating-development, its references, plugins and setup | stagehand, by a pull request in its maintainer's voice | dotfiles bump the stagehand pin |
| a practice | its page and an Evidence line | promptbook `playbook/` | the playbook's "as of" date |

## The operator: a sixth concern, outside the suite

A product that takes money has an operator: the entity that holds it, banks for it, keeps its books
and chooses its vendors. Those are one operator's answers, decided once for every product it holds,
so they live in the operator's own private repository and never in the suite: stagecraft ships the
mechanism (the vendor-table shape, `ENABLE_*` toggles, spend caps, the attribution contract, the gate
that an entity and a business bank exist before money is taken) and a one-page `docs/holdco.md` each
product fills with its operator's name and playbook. Dependencies flow specific → generic only: a
product points up to its operator as a breadcrumb, nothing public depends on the private repository,
and the operator holds no skills, agent definitions or per-product jobs, which stay in Skilldex,
stagecraft and stagehand. A project that takes no money (an embedded controller, an in-house tool)
has no operator and never sees the business layer.

## What depends on what

Two kinds of edge. A **pin** is a commit and tree id in a lockfile, verified by `promptbook lock
--check`, moved only by a pull request: nothing changes under a consumer by accident. A **mention** is
text: a skill that says "run `promptbook lint` if present", an adapter that knows another tool's
record shape. Nothing fetches on a mention, and nothing fails when the mentioned repository is absent.

```
promptbook ── pins nothing          Skilldex ── pins nothing          stagehand ── pins nothing
     ▲     ▲                           ▲    ▲
     │     │                           │    │
     │     └──── stagecraft ───────────┘    │        stagecraft: toolkit.lock (project scope)
     │                │ copied into         │
     │                ▼                     │
     │            a product ── its own toolkit.lock ── pins promptbook + Skilldex
     │                │ breadcrumb (text)
     │                ▼
     │          the operator's private repo ── pins nothing; nothing depends on it
     │                                              │
dotfiles ───────────────────────────────────────────┘  dotfiles: toolkit.yaml (machine scope): promptbook, Skilldex, stagehand
```

No pin cycle exists: the three leaves pin nothing, and everything below them pins upward only. The one
two-way *mention* is promptbook ↔ Skilldex (promptbook defines and lints the `SETS.yaml` format;
22 Skilldex skills name promptbook's CLI as an optional tool); Skilldex installs and runs with
promptbook absent, and promptbook's tests need no Skilldex. Two lockfiles because a machine and a
project are upgraded by different people at different times: a laptop moving to a new Skilldex must
not change what a project's CI runs. A bump is `promptbook lock --update <name>` (project) or an
edit to `toolkit.yaml` plus `scripts/compile-agent-policy.sh` (machine), then a pull request.

## Interfaces: the only ways the repositories touch

| # | Interface | What crosses it | Pinned by |
|---|---|---|---|
| 1 | Skills | Agent Skills folders. A consumer copies the install set it chose into `.agents/skills/` and `.claude/skills/` (Claude Code reads only `.claude/skills` and plugins) | Skilldex commit + tree in `toolkit.lock`, the sets named there |
| 2 | Formats and checks | the promptbook schemas and the `promptbook` CLI | promptbook commit + tree in `toolkit.lock` |
| 3 | Runtime | the Herdr socket and CLI (stagehand); headless CLI JSON (the loop, CI); run records in promptbook's format, and task records (stagehand's own, which promptbook reads) | Herdr version in dotfiles; the format's `x-version` |
| 4 | Instructions | AGENTS.md (the Agentic AI Foundation standard) with one-line `CLAUDE.md` shims; promptbook's standards block rendered into dotfiles' global file and stagecraft's `AGENTS.md` | the block version in `standards/engineering.md`'s markers |

## New machine → new project → first feature

1. **Machine.** `chezmoi init --apply` the dotfiles. One apply installs the agent CLIs and Herdr at
   their pins, clones each pinned checkout a machine lacks (Skilldex; stagehand on the devbox) at
   its commit and refuses one at another commit, copies Skilldex's `personal` set into
   `~/.agents/skills/` and `~/.claude/skills/`, renders the global instructions with promptbook's
   standards block, and writes each engine's settings. Those settings are compiled from
   `agent-policy.yaml` by `promptbook compile-policy` when the policy or a pin changes and committed,
   so applying needs no Node; promptbook itself is cloned by hand until it is published. On the
   devbox, stagehand's `.local/AGENTS.md` is seeded and its wake relay linked; open Claude Code in
   the checkout once to trust it, and bind the coordinator's pane. Heeler is paired by hand.
2. **Project.** Start it from stagecraft and run its bootstrap. Its `toolkit.lock` pins promptbook
   (kind `promptbook`) and Skilldex (kind `skill-library`, sets `planning` and `delivery`);
   `node scripts/skills-sync.mjs` copies those sets into `.claude/skills/` and `.agents/skills/`,
   and `node scripts/check.mjs` runs every gate, promptbook's lock, validate and readiness trace
   among them, wherever a promptbook checkout sits at the pin (CI too, once promptbook is published).
3. **First feature.** Plan with the planning set, brief to tasks; the generated readiness report goes
   to **gate 1**, the human approving the spec. One task: implementing-task builds it on its own
   branch and worktree, verifying-work gives the separate verdict, and a pull request whose required
   checks pass reaches **gate 2**: the human's approval, or, where the project's trust profile
   (`governance.yaml`) permits it for the task's risk and paths, auto-merge on those checks and that
   verdict; the merge role lands it and records `merged`. Several at once: stagehand runs an
   author and a reviewer per task, under a delegation the human gives it (its project note). The release reaches
   **gate 3**, the human's production approval, on stagecraft's train.

## How to read what happened

Nothing is kept only in a session; each question has a durable answer.

| Question | Read | How |
|---|---|---|
| what changed and why | the default branch's history | `git log`: one Conventional Commit per logical change, its body the why, kept by merge commits (never squash); `git log --grep <id>`, `git log -- <path>` |
| what a task was and how it went | `specs/<epic>/tasks/<ID>.md` | its status and owner, its acceptance criteria and its agent log, appended newest last; in flight, the task branch holds the live copy (`workflow.yaml` `status_authority`) |
| who judged and approved it | the pull request | its reviews and the evaluator's verdicts, each bound to the head it judged, the checks, the approval or the auto-merge, and the evidence attached |
| why the system is the way it is | `DECISIONS.md` | each ADR's decision, why, the options rejected and what would reverse it; the trust profile's ADR among them |
| what the agents ran and spent | run records (`.agent/loop-runs.jsonl`) and a coordinator's task records (`.orchestrator/tasks/`) | `promptbook report`: runs, outcomes, turns, cost, tokens, cache hit and denied calls per task and role, the costliest runs with their session ids |

## Decided: what is combined, what is separate, and the shortest path

Three tiers, by how much of each is ours:

| Tier | What | Examples | Rule |
|---|---|---|---|
| **Standard, older than agents** | tools everyone already uses; we install and configure, never rebuild | git, GitHub rulesets and auto-merge, chezmoi, mise, lefthook, Biome, Playwright, Docker, cloud-init, Cloudflare, Hetzner, PostHog, Stripe, Resend | pinned in dotfiles or a set; opinions about them live in a set or the operator, never in promptbook |
| **Exists for agents, we adopt** | the engines' own mechanisms and other people's libraries | Claude Code / Codex / Gemini skills, plugins and marketplaces, hooks and deny rules, MCP servers, Herdr and Heeler, third-party skill libraries | used as published; pinned by commit; a library is turned on only after the routing evals pass with it installed |
| **Ours, because nothing else does it** | the thin layer that makes the first two compose | the file formats and checks (promptbook), the install sets and evals (Skilldex), the project starter with its walls, gates, trust profiles and sets (stagecraft), the coordinator on Herdr (stagehand), the machine policy compiled per engine (dotfiles) | kept as small as the evals and the model releases allow; each piece names the gap it fills, and is deleted when a tier above fills it |

Combined, separate, and why, in one line each:

- **dotfiles and Skilldex stay forks.** Content you own; the structure (policy file, install sets,
  pins, evals) is what someone else copies. Their shared manager logic (resolve a set, copy it into
  the engine paths, record the tree ids, check the budget) is one promptbook command,
  `install-sets`, that a project's `skills-sync` and a machine's policy compile both call; neither
  keeps a copy of the logic. That was the only planned structural change, and it is done.
- **promptbook stays separate while two independent repositories speak it.** The day dotfiles and
  Skilldex stop using its formats and checks, it folds into stagecraft's `toolkit/`.
- **stagecraft and stagehand never merge.** One is copied into a project and then owned by it; the
  other is installed beside projects and never into them. A skill ships with one of them only when
  it is useless without that repository's scripts or runtime; every other skill is Skilldex's.
- **The operator is outside the suite**, private, referenced by a breadcrumb, and holds choices only.
- **Sets and packs are the expansion seam**: a set per kind of project (web app today; embedded,
  CLI, library later), a pack per domain that cuts across kinds (advertising, marketing site,
  business-in-a-box). Each is a manifest of the paths it owns plus a gate that keeps its terms out
  of the core, so the core stays generic and the opinions come out of the box for those who want them.
- **No sixth "suite" repository.** This page and `docs/getting-started.md` are the suite's home; each
  README opens with its mandate so it reads alone. A repository of symlinks and pointers would be one
  more copy to drift, and a dotfiles apply already places every pinned checkout side by side in `~/src`.
- **Quentin's and Xavier's concepts meet at two files**: the task-file format (stagehand reads a
  project's `specs/`) and the install set (`SETS.yaml`). Nothing else crosses, so neither workflow
  constrains the other.

What was cut, and what would be cut next (each with the trigger that brings it back or takes it):

- **Done:** one set installer (`install-sets`) instead of a copy in stagecraft and one in dotfiles; a
  sixth "suite" repository, not made; the stagecraft plugin path, demoted until headless runs load it.
- **Next, when `compile-policy` is next touched:** the Gemini emitter goes unless a machine in
  `toolkit.yaml` runs Gemini CLI; the `simulate` command folds into the state-machine tests; the
  `autoUpdate` tiers in `toolkit.lock` go (bump by hand) once promptbook is tagged 1.0 and semver
  ranges carry the same meaning. None of these changes the five-repository shape.

The 80/20: a solo developer uses dotfiles, a stagecraft project with the `solo` profile and the
loop, and Skilldex's planning and delivery sets. stagehand, packs, Codex, Gemini and third-party
libraries are additions that cost nothing when unused.

## 2026 practice each mandate follows

| Practice | Where it binds | Sources |
|---|---|---|
| AGENTS.md is a short map (stagecraft caps it at 230 lines); `docs/` is the system of record | stagecraft's `AGENTS.md`, dotfiles' global file, each README | [OpenAI, harness engineering](https://openai.com/index/harness-engineering/); [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md); [Claude Code memory](https://code.claude.com/docs/en/memory) |
| Skills disclose progressively: a description that says what and when, a short SKILL.md, detail in references; routed by evals; budgeted against the smallest always-loaded list (Claude Code's ~1% of context, Codex's 2%) | Skilldex; `promptbook lint` and `eval-routing` | [agentskills.io](https://agentskills.io/specification); [Claude Code skills](https://code.claude.com/docs/en/skills); [Codex skills](https://learn.chatgpt.com/docs/build-skills); [SkillsBench](https://arxiv.org/html/2602.12670v1); [Anthropic, evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) |
| Plugin marketplaces distribute, pinned by commit | Skilldex's marketplace; dotfiles and stagecraft pin it | [marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference); [plugins in an organization](https://code.claude.com/docs/en/plugins/org); [plugin security](https://code.claude.com/docs/en/plugins/security); [a Claude plugin published to Codex](https://dev.classmethod.jp/articles/publish-claude-code-plugin-to-codex/) |
| A single writer, a separate evaluator, fan-out only for independent reads | stagehand's author and reviewer; promptbook's `workflow` machine and simulator; stagecraft's loop | [Anthropic, multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system); [Google, scaling agent systems](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/); [Cognition](https://cognition.com/blog/multi-agents-working) |
| Walls are denies, an ask is a human checkpoint, an unattended run pins `dontAsk` plus an allowlist | promptbook's `policy` contract and compiler; stagecraft's hooks; dotfiles' profiles | agentic-template ADR-0021, measured on branch `docs/adr-permission-precedence` at `c177fa1` ([DECISIONS.md](https://github.com/xaviertorgerson/agentic-template/blob/c177fa1/DECISIONS.md)); [Claude Code settings](https://code.claude.com/docs/en/settings) |
| A recorded trust profile decides which changes land on green checks; a human keeps what checks cannot see | promptbook's `governance` contract and `auto-land`; stagecraft's ADR and rulesets | heirloom D-159 ([DECISIONS.md](https://github.com/xaviertorgerson/heirloom/blob/74104b0/DECISIONS.md)) |
| Code owns the workflow graph; models fill the ambiguous nodes | promptbook's state machines; stagecraft's loop and CI agents; stagehand's coordinator | [Google, ADK 2.0](https://developers.googleblog.com/why-we-built-adk-20/); [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/multi_agent/) |
| State lives in files and git, not the context window: an initializer sets the environment up, each later session reads the log and the progress record, smoke-tests, takes one unit of work, and leaves it clean; the agent may mark a feature passing but never edit the test | stagecraft's task files (criteria, agent log), `/bootstrap`, the session-start hook, `implementing-task`; `risk-gate`'s criteria-unchanged guard; `ears-coverage` holds criterion ids to test names | [Anthropic, effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); [Anthropic, harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| The repository is the system of record; AGENTS.md is the map; rules are linters whose errors say how to fix; background agents garden docs and debt; gates stay few where throughput is high | stagecraft's `docs/`, `check.mjs` gates that print the fix, `nightly-audit`, `decision-drift`, auto-land under a trust profile | [OpenAI, harness engineering](https://openai.com/index/harness-engineering/) |
| Spec before code, in stages a human approves: principles → requirements → design → tasks, with open questions marked rather than guessed | Skilldex's planning set; stagecraft's `specs/` and gate 1; promptbook's trace check and readiness report | [GitHub Spec Kit](https://github.com/github/spec-kit); [Kiro specs](https://kiro.dev/docs/specs/concepts); [OpenSpec](https://github.com/Fission-AI/OpenSpec); [Böckeler on SDD tools](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) |
| A loop of fresh sessions, one item each, until the list is done, with a stop when it stalls | stagecraft's `scripts/loop.mjs` (gated: only approved epics, only ready tasks, stop on stall or denial) | [Huntley, Ralph](https://ghuntley.com/ralph/); [Anthropic, a C compiler from parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler) |
| Use the engine's orchestration before building one: subagents (nested three deep), dynamic workflows for wide fan-out with verification, agent teams for peers, cross-session messages as untrusted nudges, pushed events into a live session, a Stop hook or `/goal` to keep one session going until a condition holds | stagecraft's `docs/concurrency.md` ladder; nothing in the suite re-implements them | [Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents); [dynamic workflows](https://code.claude.com/docs/en/workflows); [agent teams](https://code.claude.com/docs/en/agent-teams); [cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging); [channels](https://code.claude.com/docs/en/channels); [/goal](https://code.claude.com/docs/en/goal); [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) |
| Contain at the environment first: a sandbox or container bounds what an allowed command can do, credentials stay outside it, and memory files and other agents' output are untrusted input | stagecraft's CI agents on ephemeral runners, one token per agent; the loop's runs with auto memory off; a sandboxed loop is a stagecraft `FUTURE.md` trigger | [Anthropic, how we contain Claude](https://www.anthropic.com/engineering/how-we-contain-claude); [Claude Code sandboxing](https://code.claude.com/docs/en/sandboxing) |
| Evals come from real failures, are graded on the outcome and run several times; re-run them with each new model and delete the scaffolding that no longer carries weight | Skilldex's routing evals (`eval-routing`) and its scenarios, some run by `claude plugin eval` beside a no-skill baseline (`plugin-evals/`); outcome evals of the loop's tasks are a stagecraft `FUTURE.md` trigger. A tuning loop proposes a description or a body change as a pull request judged on held-out cases; it never lands one itself | [Anthropic, demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents); [infrastructure noise](https://www.anthropic.com/engineering/infrastructure-noise); [harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps); [plugin evals](https://code.claude.com/docs/en/plugin-evals) |
| A personal assistant runtime (OpenClaw, Hermes Agent, Grok Bot) is an engine, not a part of the suite | if one is used, it runs in a container with no production credentials and its gateway on loopback; its marketplace's skills never install into a project, only Skilldex's pinned sets do | [OpenClaw security guide](https://www.bitdoze.com/openclaw-security-guide/); [Grok Bot](https://flaviocopes.com/grok-bot/) |
| Where merges are many, review the intent and route by what a change touches; test after merge and before deploy; people set the constraints | `risk-gate`'s protected paths and trust profile; the train's stages; `nightly-audit` | [Anthropic, redesigning source control](https://www.anthropic.com/engineering/redesigning-source-control) |
| Interoperate at published standards, adopt them when a trigger fires | CONTRACTS.md, "Where each shape comes from": Agent Skills and AGENTS.md adopted; OpenTelemetry GenAI, A2A and Beads mapped, with triggers | [OTel GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai); [A2A 1.0](https://aaif.io/blog/a2a-v1-0-a-builder-s-guide-part-1-discovery-tasks-and-clients); [Beads](https://github.com/steveyegge/beads) |
