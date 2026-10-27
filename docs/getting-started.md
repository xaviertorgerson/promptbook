# Getting started with the suite

How to use the five repositories, in the order a person meets them. What each one is and why the
walls sit where they do is [`../SUITE.md`](../SUITE.md); this page is the steps. Each repository's
own `README.md` opens with its mandate and says what it needs from the others, so any one of them
can be read alone.

## What you need

- A GitHub account with `gh` signed in. Every repository is a git repository; nothing else is shared.
- Node 22 for promptbook's checks and stagecraft's scripts (dotfiles installs it through mise).
- One of the agent CLIs: Claude Code, Codex or Gemini. The skills and the standards are engine-neutral;
  dotfiles writes each engine's settings from one policy file.

The repositories, and what you do with each:

| Repository | You | Use alone? |
|---|---|---|
| [dotfiles](https://github.com/xaviertorgerson/dotfiles) | apply it to a machine (chezmoi) | yes: a machine setup that happens to install agents under a compiled policy |
| [promptbook](https://github.com/xaviertorgerson/promptbook) | pin it; run its checks | yes: formats, standards and checks for any repository that keeps work items as files |
| [Skilldex](https://github.com/QuentinTorg/skilldex) | pin it; copy an install set | yes: a skills library with evals, by set |
| [stagecraft](https://github.com/xaviertorgerson/agentic-template) | copy it to start a project; sync releases down | yes: a project starter; it pins the two above |
| [stagehand](https://github.com/QuentinTorg/stagehand) | install it once, beside projects, on the box that runs several agents | yes: a coordinator for Herdr; needs no other repository |

Together they are one path: machine → project → first feature → release.

## Day 0: a machine

```sh
gh repo clone xaviertorgerson/dotfiles ~/.local/share/chezmoi && ~/.local/share/chezmoi/install.sh
```

One apply installs the agent CLIs and Herdr at their pins, clones each pinned checkout into `~/src`
(promptbook, Skilldex; stagehand on the devbox) at its commit, copies Skilldex's `personal` set into
the engines' skill paths, renders the global instructions with promptbook's standards block, and
writes each engine's settings from `home/.chezmoidata/agent-policy.yaml`. The pins are
`home/.chezmoidata/toolkit.yaml`. Verify with the checklist in dotfiles' README ("Start here").

The machine's policy is yours alone: how often an agent asks, which connectors are on, which
tokens `with-token` may mint. Nothing in it reaches a collaborator or CI.

## Day 1: a project

New:

```sh
npx degit xaviertorgerson/agentic-template my-project
cd my-project && git init && git add -A && git commit -m "chore: scaffold from stagecraft"
```

then open the agent CLI in it and run `/bootstrap`: it asks about the domain, confirms the set
(today `webapp-saas`; a project with no stack keeps the core only), chooses the trust profile
(`governance.yaml`: `solo`, `team` or `regulated`, with the trigger that moves it), and writes the
`AGENTS.md` domain blocks and the first epic in `specs/`.

Existing: `/adopting-stagecraft` in the repository lays the same files over what is there, marking
what it kept.

Either way the project then owns its copy. Its `toolkit.lock` pins promptbook and Skilldex;
`node scripts/skills-sync.mjs` copies the `planning` and `delivery` sets into `.claude/skills/` and
`.agents/skills/`; `node scripts/check.mjs` runs every gate (the lock, `validate`, the readiness
trace, the sets gate, doc links) and is what CI runs. `node scripts/next.mjs` always prints the
next step.

## Daily: a feature

1. **Plan.** A brief becomes a spec and Critical User Journeys, then task files with EARS criteria
   and `depends_on` (the planning set). `promptbook trace` writes the readiness report. **Gate 1:**
   a human approves the spec.
2. **Build.** One task at a time: `implementing-task` claims it on its own branch and worktree, builds
   it, opens a draft pull request. `verifying-work` gives the separate verdict. Several at once:
   stagehand on the devbox runs an author and a reviewer per task; or `node scripts/loop.mjs` runs
   the queue unattended.
3. **Land.** `/ship`: gates green, docs updated, Conventional Commit with the why, push, pull request.
   **Gate 2:** a human approves, or, where `governance.yaml` permits it for the task's risk and
   paths, the pull request auto-merges on green checks and the independent verdict (`risk-gate`
   decides; merge commits, never squash; `record-merged` writes the status).
4. **Release.** `node scripts/release.mjs` tags and writes notes from the commits; the train promotes
   one image dev → QA → production. **Gate 3:** a human taps production.

Everything is in git afterwards: `git log` for the why, the task file for how it went, the pull
request for who judged it, `DECISIONS.md` for why the system is shaped as it is, `promptbook report`
for what the agents spent (SUITE.md, "How to read what happened").

## More machines, more projects

Each machine: Day 0 again; the pins make it the same machine. Each project: Day 1 again; the
template makes it the same project shape. A laptop and a devbox differ only in
`home/.chezmoi.toml.tmpl`'s profile: the devbox gets stagehand and Herdr, bypass mode once production
is unreachable from it; the laptop gets Codex and the vault.

## When upstream moves

Updates come down as reviewed pull requests, never silently:

| Upstream | Reaches a project by | Reaches a machine by |
|---|---|---|
| promptbook | a `toolkit.lock` bump (`node scripts/promptbook.mjs lock`), classed in its CHANGELOG as additive, behavioral or breaking; `autoUpdate: patch` lets patches move on their own | a `toolkit.yaml` bump, then `scripts/compile-agent-policy.sh` and `chezmoi apply` |
| Skilldex | a `toolkit.lock` bump and `node scripts/skills-sync.mjs`; a third-party library the same way, turned on only when the routing evals pass with it installed | a `toolkit.yaml` bump; the `personal` set follows |
| stagecraft | `node scripts/sync-template.mjs --from ../agentic-template --dry-run`, review, apply; one pull request per `template/vX.Y.Z` release (weekly, once `TEMPLATE_SYNC_ENABLED`). `TEMPLATE-SYNC.md` lists what a sync may touch and what is the project's forever | — |
| stagehand | — | its own release; dotfiles pins the commit |

A project never reaches up into a checkout at run time; it runs what its lock names.

## Pushing a learning up

Sync is one-way, so a thing born in a project travels up on purpose or stays trapped. The
`promoting-learnings` skill (Skilldex) owns the procedure: one stage per change, through gates, under
a name, pinned; and it retires what it replaces. The destination is decided by what kind of thing it
is, and by the placement rules in SUITE.md ("Where a thing goes"):

| A new … | Goes to | As |
|---|---|---|
| procedure any repository can use | Skilldex | a pull request adding a skill with its evals; projects get it as a pin bump |
| format, check or always-on standard | promptbook | a pull request; `x-version` or the standards block version moves |
| third-party integration for the project's kind (a vendor, a queue, a mail path) | stagecraft, the set | `knowledge/<vendor>.md` with the dated facts, the rule or template under `sets/<set>/`, a set ADR; its `ENABLE_*` toggle and spend cap in the vendor table. A deviation two children share becomes the set's decision |
| procedure only stagecraft's machinery uses | stagecraft | `.claude/skills/<name>/`, `origin: template` |
| choice the operator makes for every product (which bank, which processor account, which analytics project) | the operator's private repository | its playbook and `operator.yaml` (the `operator` format); each product keeps only `docs/holdco.md` pointing up |
| product-only fact | the product | `DECISIONS.md`, `DEVIATIONS.yaml` with the trigger that ends it |

The walk for a new vendor, end to end: the product adopts it behind an interface with keys at run
time (`integrating-services`), records the deviation from its set with an ADR and an end trigger;
when a second product wants it, or the first proves it, `promoting-learnings` opens a stagecraft
pull request with the knowledge entry, the set change and the set ADR, and a pull request to the
operator's repository with the account and the choice; the next release syncs down to every product, whose
`DEVIATIONS.yaml` entry is then deleted. Nothing public ever depends on the private repository.

## The operator

A product that takes money names its operator in `docs/holdco.md` (stamped from stagecraft's
`_HOLDCO-TEMPLATE.md` and the operator's `operator.yaml` when the product is spawned): who holds it,
banks for it and chooses its vendors. The operator's repository is private and holds choices only; the mechanism (vendor table, toggles, caps,
attribution, the launch gate that an entity and a bank exist before money is taken) is
stagecraft's. A project that takes no money has no operator and never sees that layer.

## Where the documents live

| Question | Read |
|---|---|
| what the suite is, why five, where a thing goes, what is decided | promptbook `SUITE.md` |
| how to use it | this page |
| one repository's job, interface and versioning | that repository's `README.md`, first section |
| how a project runs day to day | the project's `docs/operating-guide.md`, `docs/workflow.md`, `docs/governance.md`, `docs/ci-cd.md` |
| how a machine is set up and what it installs | dotfiles `README.md` |
| the coordinator | stagehand `README.md` |
| the practices and the evidence behind them | promptbook `playbook/` |
| the operator's choices | its private repository, by its breadcrumb |

There is no sixth "suite" repository of links or symlinks: it would be one more copy to drift, and
`~/src` after a dotfiles apply already holds every pinned checkout side by side.
