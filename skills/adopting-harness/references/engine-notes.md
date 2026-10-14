# Engine notes for adoption

As of 2026-10-13; the harness adapters (`adapters/claude`, `adapters/codex`, `adapters/gemini`,
`adapters/herdr`, `adapters/ci`) own these mappings. Verify paths on install.

## Skill directories

| Engine | Reads `~/.agents/skills` / `.agents/skills` | Where fan-out must copy |
|---|---|---|
| Claude Code | no (reads `~/.claude/skills`, `.claude/skills`, plugins) | `~/.claude/skills/<name>/`; project skills synced into `.claude/skills/<name>/` |
| Codex | yes (user and repo) | — |
| Gemini CLI | yes (`~/.agents/skills` alias; workspace `.agents/skills` preferred over `.gemini/skills`) | — |
| Antigravity CLI | workspace `.agents/skills`; global `~/.gemini/antigravity-cli/skills/` (documented inconsistently) | the global path, after verifying it |

Precedence on a name collision differs (Claude Code: personal over project; Gemini CLI: workspace over
user; Codex: both shown), so rename instead of shadowing.

## Instruction loaders

| Engine | Personal file | Project loader |
|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` | `CLAUDE.md` containing `@AGENTS.md` (it reads `AGENTS.md` natively only when no `CLAUDE.md` exists) |
| Codex | `~/.codex/AGENTS.md` | `AGENTS.md` natively (32 KiB combined cap) |
| Gemini CLI / Antigravity | `~/.gemini/GEMINI.md` | `.gemini/settings.json` `context.fileName: ["AGENTS.md"]` |

## Policy targets and the switches that matter

| Engine | Personal policy lands in | Never emit | Unattended runs |
|---|---|---|---|
| Claude Code | `~/.claude/settings.json` `permissions` (`defaultMode`, `allow`, `ask`, `deny`), `sandbox` | `disableAllHooks` (user settings or `--settings`) | `--permission-mode dontAsk --allowedTools <list> --max-turns N --max-budget-usd X` |
| Codex | `~/.codex/config.toml` permission profile; `~/.codex/rules/*.rules` (`prefix_rule` allow / prompt / forbidden) | `:danger-full-access` as a default | a profile with `approval_policy = "never"` and allow rules; runner timeout (no documented spend cap) |
| Gemini CLI | `~/.gemini/settings.json`; `~/.gemini/policies/*.toml` (`decision = "deny"`) | `hooksConfig.enabled: false` | non-interactive mode (ask becomes deny); YOLO only from the command line; workspace-tier policy currently disabled |

ADR-0021 (agentic-template branch `docs/adr-permission-precedence`, commit `c177fa1`, not yet on
master; Claude Code 2.1.296) is the measurement behind the walls matrix; its
`scripts/permission-probe.mjs --run`, on the same branch, re-runs it on a machine.

## Lock and runtime examples

- A Claude Code plugin marketplace entry can pin a 40-character `sha`; set auto-update off for
  third-party mirrors.
- Herdr: pin with the tool manager (`herdr = "<exact>"`); plugins declare `min_herdr_version`;
  `herdr api schema --json` prints the protocol schema to compare across bumps.
- CI: the validator runs as `node harness/tools/validate.mjs specs DECISIONS.md` and
  `--trace . --tests "<globs>"` after installing the harness's pinned dependencies.
