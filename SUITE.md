# The suite

Five repositories, one job each, so that no procedure is written twice. Each README opens with its
mandate in the shape below; this page holds all five, the four ways they touch each other, the path
from a new machine to a first feature, and the 2026 practice each mandate follows. As of
2026-10-14. Herdr and Heeler are third-party: dotfiles pins and installs them, and no repository of
the suite holds them.

## Mandates

| Repo | One job | Owns | Must not contain | Interface it exposes | Versioning | Consumed by |
|---|---|---|---|---|---|---|
| **promptbook** | The master copy: the shared file formats, the engineering standards, the playbook, and the tools that check them | `standards/`, `playbook/`, `schemas/`, `state-machines/`, `adapters/`, `tools/` (validate, trace, lint, compile-policy, lock, run, check-requires, report, simulate, eval-routing, import-evals, grant), `examples/`, `SUITE.md` | Skills (all live in Skilldex), runtime coordination, any stack | JSON Schemas + the `promptbook` CLI (npm-style `bin`), SUITE.md | semver tags, pre-1.0 (pin a commit); each schema's `x-version` and each machine's `version`; every change classed additive, behavioral or breaking in `CHANGELOG.md` | stagecraft (gates, lock), dotfiles (policy compile, standards block), Skilldex (lint + routing evals run against it); it reads stagehand's task records, and stagehand depends on none of it |
| **Skilldex** | Every portable skill, with evals, in one library | `skills/<gerund-name>/` (agentskills.io SKILL.md + references + evals), install sets (`SETS.yaml`), routing results, plugin marketplace manifests that package the sets | Engine or stack specifics in a SKILL.md body (engine notes go in `references/engine-notes.md`), coordination runtime, project rules | Agent Skills folders; install sets; `.claude-plugin/marketplace.json` (+ Codex `.agents/plugins/marketplace.json` if documented) | untagged: consumers pin commit + tree (`0.0.0+<sha>`); each skill's `metadata.version`; a deprecated skill keeps a stub one release | dotfiles (personal set), stagecraft projects (planning + delivery sets, pinned in toolkit.lock), stagehand (roles use review/PR/findings skills) |
| **stagehand** | Run many agents at once on Herdr: one coordinator, an author and an independent reviewer per task, each in its own worktree and pane; humans keep merge authority unless delegated | the orchestrating-development skill + references, Herdr plugins (agent-wake, status-board), the coordinator setup for Codex (rules) and Claude Code (settings), its task-record template and project-delegation practice | General-purpose procedures (uses Skilldex), project rules | Herdr runtime; follows a project's own instructions for its task queue; keeps its own task records (promptbook's `task-record` contract reads them unchanged) and records a delegation as a project note | pinned by commit (plugins installed at a ref); each plugin's `min_herdr_version` floor against dotfiles' Herdr pin | the user (via dotfiles install), any stagecraft project |
| **stagecraft** | What a new project starts with: AGENTS.md map, walls (hooks + deny rules), the `specs/` queue and planning templates, the sequential loop and CI agents, gates, and one opinionated stack pack per kind of project ("sets") | `AGENTS.md`, `.claude/` walls and hooks, `specs/`, `docs/` templates, `scripts/` gates, `.github/workflows/`, `toolkit.lock`, `sets/webapp-saas/` (a manifest naming the stack-owned rules, docs, ops and stack skills where engines read them; a gate keeps the always-loaded core free of the set's terms) | Generic skills (pins Skilldex), generic checking tools (pins promptbook) | `toolkit.lock` (pins promptbook + Skilldex + install sets, which `scripts/skills-sync.mjs` copies in and checks), template sync to children (the `stagecraft` plugin or the sync manifest) | a child records the stagecraft commit it last synced; the pins it hands down are its `toolkit.lock` entries, bumped by reviewed pull requests | each product repo |
| **dotfiles** | Set up a machine and how agents behave for this user everywhere | autonomy policy per profile, personal taste, installs and pins (agent CLIs, Herdr; on the devbox, stagehand's control workspace and wake relay), the pinned checkouts, personal skill set from Skilldex | project rules, skill sources | chezmoi | each machine applies its branch's head; everything it installs is pinned in `toolkit.yaml` and the mise config | the user's machines |

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
   branch and worktree, verifying-work gives the separate verdict, a reviewed pull request reaches
   **gate 2**, the human's approval, and the merge agent lands it. Several at once: stagehand runs an
   author and a reviewer per task, under a delegation the human gives it (its project note). The release reaches
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
