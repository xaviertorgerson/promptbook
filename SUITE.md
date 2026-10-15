# The suite

Five repositories, one job each, so that no procedure is written twice. Each README opens with its
mandate in the shape below; this page holds all five, the four ways they touch each other, the path
from a new machine to a first feature, and the 2026 practice each mandate follows. As of
2026-10-14. Herdr and Heeler are third-party: dotfiles pins and installs them, and no repository of
the suite holds them.

## Mandates

| Repo | One job | Owns | Must not contain | Interface it exposes | Versioning | Consumed by |
|---|---|---|---|---|---|---|
| **promptbook** | The master copy: the shared file formats, the engineering standards, the playbook, and the tools that check them | `standards/`, `playbook/`, `schemas/`, `state-machines/`, `adapters/`, `tools/` (validate, trace, lint, compile-policy, lock, run, check-requires, report, simulate, eval-routing, import-evals, grant), `examples/`, `SUITE.md` | Skills (all live in Skilldex), runtime coordination, any stack | JSON Schemas + the `promptbook` CLI (npm-style `bin`), SUITE.md | semver tags, pre-1.0 (pin a commit); each schema's `x-version` and each machine's `version`; every change classed additive, behavioral or breaking in `CHANGELOG.md` | stagecraft (gates, lock), dotfiles (policy compile, standards block), stagehand (task-record/grant formats), Skilldex (lint + routing evals run against it) |
| **Skilldex** | Every portable skill, with evals, in one library | `skills/<gerund-name>/` (agentskills.io SKILL.md + references + evals), install sets (`SETS.yaml`), routing results, plugin marketplace manifests that package the sets | Engine or stack specifics in a SKILL.md body (engine notes go in `references/engine-notes.md`), coordination runtime, project rules | Agent Skills folders; install sets; `.claude-plugin/marketplace.json` (+ Codex `.agents/plugins/marketplace.json` if documented) | untagged: consumers pin commit + tree (`0.0.0+<sha>`); each skill's `metadata.version`; a deprecated skill keeps a stub one release | dotfiles (personal set), stagecraft projects (planning + delivery sets, pinned in toolkit.lock), stagehand (roles use review/PR/findings skills) |
| **stagehand** | Run many agents at once on Herdr: one coordinator, an author and an independent reviewer per task, each in its own worktree and pane; humans keep merge authority unless delegated | the orchestrating-development skill + references, Herdr plugins (agent-wake, status-board), Codex rules, the task-record and delegation-grant practice | General-purpose procedures (uses Skilldex), project rules | Herdr runtime; reads a project's `specs/` tasks; writes task records in the promptbook `task-record` format; delegation grants in the promptbook `grant` format | pinned by commit (plugins installed at a ref); each plugin's `min_herdr_version` floor against dotfiles' Herdr pin | the user (via dotfiles install), any stagecraft project |
| **stagecraft** | What a new project starts with: AGENTS.md map, walls (hooks + deny rules), the `specs/` queue and planning templates, the sequential loop and CI agents, gates, and one opinionated stack pack per kind of project ("sets") | `AGENTS.md`, `.claude/` walls and hooks, `specs/`, `docs/` templates, `scripts/` gates, `.github/workflows/`, `toolkit.lock`, `sets/webapp-saas/` (Angular/NestJS/… mandate, stack rules, ops, stack skills) | Generic skills (pins Skilldex), generic checking tools (pins promptbook) | `toolkit.lock` (pins promptbook + Skilldex + install sets), template sync to children | a child records the stagecraft commit it last synced; the pins it hands down are its `toolkit.lock` entries, bumped by reviewed pull requests | each product repo |
| **dotfiles** | Set up a machine and how agents behave for this user everywhere | autonomy policy per profile, personal taste, installs and pins (agents, herdr, Heeler plugin, stagehand plugins), personal skill set from Skilldex | project rules, skill sources | chezmoi | each machine applies its branch's head; everything it installs is pinned in `toolkit.yaml` and the mise config | the user's machines |

## Interfaces: the only ways the repositories touch

| # | Interface | What crosses it | Pinned by |
|---|---|---|---|
| 1 | Skills | Agent Skills folders. A consumer copies the install set it chose into `.agents/skills/` and `.claude/skills/` (Claude Code reads only `.claude/skills` and plugins) | Skilldex commit + tree in `toolkit.lock`, the sets named there |
| 2 | Formats and checks | the promptbook schemas and the `promptbook` CLI | promptbook commit + tree in `toolkit.lock` |
| 3 | Runtime | the Herdr socket and CLI (stagehand); headless CLI JSON (the loop, CI); task records and run records in promptbook formats | Herdr version in dotfiles; the format's `x-version` |
| 4 | Instructions | AGENTS.md (the Agentic AI Foundation standard) with one-line `CLAUDE.md` shims; promptbook's standards block rendered into dotfiles' global file and stagecraft's `AGENTS.md` | the block version in `standards/engineering.md`'s markers |

## New machine → new project → first feature

1. **Machine.** `chezmoi init --apply` the dotfiles. They install the agents, Herdr, the Heeler and
   stagehand plugins at their pins, check out promptbook and Skilldex at the commits in
   `toolkit.yaml`, compile `agent-policy.yaml` per engine with `promptbook compile-policy`, render
   the standards block into the global instructions, and copy Skilldex's `personal` set into
   `~/.agents/skills/` and `~/.claude/skills/`.
2. **Project.** Start it from stagecraft and run its bootstrap. Its `toolkit.lock` pins promptbook
   (kind `promptbook`) and Skilldex (kind `skill-library`, sets `planning` and `delivery`);
   `promptbook lock --check`, `promptbook validate` and `promptbook trace . --readiness specs --check`
   run in CI from the first commit.
3. **First feature.** Plan with the planning set, brief to tasks; the generated readiness report goes
   to **gate 1**, the human approving the spec. One task: implementing-task builds it on its own
   branch and worktree, verifying-work gives the separate verdict, a reviewed pull request reaches
   **gate 2**, the human's approval, and the merge agent lands it. Several at once: stagehand runs an
   author and a reviewer per task, under a grant if the human delegates. The release reaches
   **gate 3**, the human's production approval, on stagecraft's train.

## 2026 practice each mandate follows

| Practice | Where it binds | Sources |
|---|---|---|
| AGENTS.md is a short map (about 100 lines); `docs/` is the system of record | stagecraft's `AGENTS.md`, dotfiles' global file, each README | [OpenAI, harness engineering](https://openai.com/index/harness-engineering/); [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md); [Claude Code memory](https://code.claude.com/docs/en/memory) |
| Skills disclose progressively: a description that says what and when, a short SKILL.md, detail in references; routed by evals; budgeted against Codex's 8,000-character always-loaded list | Skilldex; `promptbook lint` and `eval-routing` | [agentskills.io](https://agentskills.io/specification); [Claude Code skills](https://code.claude.com/docs/en/skills); [Codex skills](https://learn.chatgpt.com/docs/build-skills); [SkillsBench](https://arxiv.org/html/2602.12670v1); [Anthropic, evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) |
| Plugin marketplaces distribute, pinned by commit | Skilldex's marketplace; dotfiles and stagecraft pin it | [marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference); [plugins in an organization](https://code.claude.com/docs/en/plugins/org); [plugin security](https://code.claude.com/docs/en/plugins/security); [a Claude plugin published to Codex](https://dev.classmethod.jp/articles/publish-claude-code-plugin-to-codex/) |
| A single writer, a separate evaluator, fan-out only for independent reads | stagehand's author and reviewer; promptbook's `workflow` machine and simulator; stagecraft's loop | [Anthropic, multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system); [Google, scaling agent systems](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/); [Cognition](https://cognition.com/blog/multi-agents-working) |
| Walls are denies, an ask is a human checkpoint, an unattended run pins `dontAsk` plus an allowlist | promptbook's `policy` contract and compiler; stagecraft's hooks; dotfiles' profiles | agentic-template ADR-0021, measured on branch `docs/adr-permission-precedence` at `c177fa1` ([DECISIONS.md](https://github.com/xaviertorgerson/agentic-template/blob/c177fa1/DECISIONS.md)); [Claude Code settings](https://code.claude.com/docs/en/settings) |
| Code owns the workflow graph; models fill the ambiguous nodes | promptbook's state machines; stagecraft's loop and CI agents; stagehand's coordinator | [Google, ADK 2.0](https://developers.googleblog.com/why-we-built-adk-20/); [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/multi_agent/) |
