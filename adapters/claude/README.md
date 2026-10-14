# Adapter: Claude Code

Where each harness contract lands when the engine is Claude Code, and how an engine-neutral
`agent-policy.yaml` compiles to Claude Code settings. Verified against the docs on 2026-10-13
(Claude Code 2.1.29x); every claim cites the page it came from. Nothing in L3 depends on this file;
L1 (dotfiles) and L4 (agentic-template's `.claude/` plugin) implement it.

## Where artifacts land

| Contract / artifact | Claude Code location | Notes |
|---|---|---|
| Instructions (L1/L2 AGENTS.md) | `~/.claude/CLAUDE.md`, project `CLAUDE.md` containing `@AGENTS.md` | Claude reads AGENTS.md natively only when no CLAUDE.md exists (v2.1.277+); the one-line import is the safe shim. [memory][mem] |
| `skill` (L3 skills) | plugin `skills/<name>/SKILL.md`, or `.claude/skills/<name>/SKILL.md`, `~/.claude/skills/<name>/SKILL.md` | Claude Code does not read `.agents/skills/`; ship skills in the plugin or fan them out. [skills][skills] |
| Skill extensions | adapter-only frontmatter: `disable-model-invocation`, `user-invocable`, `context`, `agent`, `hooks`, `paths`, `model`, `effort`, `allowed-tools`, `argument-hint`, `when_to_use` | Never in an L3 SKILL.md (the `skill` schema rejects them). An L4 pack that needs one keeps its own copy of the skill. [skills][skills] |
| Subagents (reviewer, coder, ...) | `.claude/agents/<name>.md`, `~/.claude/agents/`, plugin `agents/` | Frontmatter `name`, `description` required; `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `isolation: worktree`, ... `permissionMode`, `hooks`, `mcpServers` are ignored for plugin subagents. [sub-agents][agents] |
| Walls (policy `forbid`, `deny_read`) | `permissions.deny` in `.claude/settings.json` (L2) or `~/.claude/settings.json` (L1), plus a `PreToolUse` hook returning `deny` | Deny beats ask beats allow; a deny holds in every mode including bypass (ADR-0021). [permissions][perm] [hooks][hooks] |
| Hooks | `hooks` in settings, or plugin `hooks/hooks.json` | `PreToolUse` denies with `hookSpecificOutput.permissionDecision: "deny"` or exit 2. [hooks][hooks] |
| `return` | `claude -p --output-format json --json-schema schemas/return.schema.json` → `.structured_output` | A subagent hand-back can also be a JSON file under `.agent/returns/`. [headless][headless] |
| `run-record` | one line per `claude -p` run, from the result JSON: `session_id`, `subtype`, `num_turns`, `total_cost_usd`, `permission_denials` | Exactly what agentic-template's `scripts/loop.mjs` writes to `.agent/loop-runs.jsonl`. [agent loop][loop] |
| Attention from runs | result `subtype` (`success`, `error_max_turns`, `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries`) | Mapped in `state-machines/attention.yaml` (`claude-headless`). [agent loop][loop] |
| `budget` | `--max-turns`, `--max-budget-usd` | Spend can overshoot by one response. [agent loop][loop] |
| `task-record`, `grant`, `toolkit-lock` | not read by Claude Code | Runtime and L2 files; Claude only sees them as files. |
| Plugin packaging | `.claude-plugin/plugin.json` at the plugin root; components in `skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json` | Skeleton below. [plugins reference][plug] |

## Policy compilation (`agent-policy.yaml` → settings.json)

The compiler (`tools/compile-policy.mjs`, a later deliverable) emits a user-scope settings fragment for
L1 and never touches project settings. Rules:

| Policy field | Claude Code key | Mapping |
|---|---|---|
| `profiles.<p>.tier: read-only` | `permissions.defaultMode: "plan"` | Plan mode never edits source files. [permissions][perm] |
| `tier: ask` | `permissions.defaultMode: "default"` | Prompts before edits and commands. |
| `tier: auto-edit` | `permissions.defaultMode: "acceptEdits"` | Edits and common filesystem commands in the workspace without asking. |
| `tier: auto` | `permissions.defaultMode: "auto"` (user scope only) | Auto mode: "everything, with background safety checks": a classifier reviews each action, ask rules still prompt, deny rules block in every mode; where auto mode is unavailable (model, plan, a `disableAutoMode` setting) the session starts in Manual, the stricter side. Like bypass, `auto` "doesn't take effect from project or local settings". With `egress.default: deny`, WebFetch outside `allow_domains` is the classifier's call, not a denial: an `egress` gap unless `forbid {tool: web-fetch}` removes the tool. [permission modes][modes] |
| `tier: autonomous` | `permissions.defaultMode: "bypassPermissions"` (user scope only) | `defaultMode` `auto` and `bypassPermissions` "don't take effect from project or local settings"; bypass refuses to run as root outside a sandbox. Walls still hold (ADR-0021). |
| `tier: unattended` | no settings key: the runner passes `--permission-mode dontAsk --allowedTools <allow>` | Under a user bypass default `--allowedTools` is not a boundary; under `dontAsk` it is, and every ask becomes a denial in `permission_denials` (ADR-0021). [headless][headless] |
| `deny_read: [glob]` | `permissions.deny: ["Read(<glob>)"]` and `sandbox.filesystem.denyRead` | `**/.env` stays relative; `~/x` stays `~/x`; an absolute `/etc/x` becomes `//etc/x` (a single leading `/` is relative to the settings file). Read rules reach Grep/Glob best-effort and the file commands Claude recognizes in Bash (`cat`, `head`, `sed`, `tee`, redirections), "not ... a Python or Node script that opens files itself"; only the sandbox binds every process. So without `sandbox.enabled: true` the compile fails with a `sandbox` gap until it is accepted (no inert `sandbox.filesystem` is emitted then), and with `fail_if_unavailable` not true it warns `sandbox-may-fall-back`. [permissions][perm] [sandboxing][sbx] |
| `forbid: {command: [a, b, ...]}` | `permissions.deny: ["Bash(a b *)"]` | One rule per expansion of an alternatives token. A space before `*` is the prefix boundary (`Bash(git diff *)` does not match `git diff-index`). |
| `forbid: {write: glob}` | `permissions.deny: ["Edit(<glob>)"]` | `Edit` rules apply to every built-in tool that edits files and to Bash redirection targets, not to a script that writes files itself: partial without the sandbox, the same `sandbox` gap as `deny_read`. |
| `forbid: {tool: web-fetch, domain: d}` | `permissions.deny: ["WebFetch(domain:<d>)"]` | `**.host` → two rules, `host` and `*.host` (Claude's `*.host` excludes the apex). |
| `forbid: {tool: "mcp:server[:tool]"}` | `permissions.deny: ["mcp__server"]` / `["mcp__server__tool"]` | No parenthesized MCP parameters (skipped at load). |
| `ask: [...]` | `permissions.ask` | Same syntax as deny. Interactive only; never protection. |
| `allow: [...]` | `permissions.allow` | Same syntax. No effect under `bypassPermissions`; is the boundary under `dontAsk`. |
| `egress.allow_domains` | `sandbox.network.allowedDomains` and `permissions.allow: ["WebFetch(domain:...)"]` | Sandbox domains "start empty". [sandboxing][sbx] |
| `egress.deny_domains` | `sandbox.network.deniedDomains` and `permissions.deny: ["WebFetch(domain:...)"]` | |
| `egress.default: deny` | `sandbox.network.strictAllowlist: true` (with `sandbox.enabled: true`) | Without it, bypass mode lets sandboxed commands reach hosts outside the list. [sandboxing][sbx] |
| `sandbox.enabled` | `sandbox.enabled` | Linux, macOS, WSL2; native Windows runs unsandboxed. |
| `sandbox.fail_if_unavailable` | `sandbox.failIfUnavailable` | |
| `sandbox.writable_roots` | `sandbox.filesystem.allowWrite` | |
| `tier: autonomous` with the profile's own (merged) `sandbox.enabled: true` | `sandbox.allowUnsandboxedCommands: false` | Under `bypassPermissions` a command the sandbox blocked may be retried with `dangerouslyDisableSandbox` and "the retry runs without a prompt"; with the key `false` "Claude Code ignores the `dangerouslyDisableSandbox` parameter" (strict sandbox mode). Decided from that profile's sandbox alone: another profile's accepted `sandbox` gap never removes it. [sandboxing][sbx] |
| `sandbox.credentials: [{path, extract?, inject_hosts?}]` | `sandbox.credentials.files: [{path, mode: "mask", extract, injectHosts}]` and `sandbox.network.tlsTerminate: {}` | Sandboxed commands read a sentinel copy and the sandbox proxy restores the real value on requests to `injectHosts`, which must also be in `network.allowedDomains` (a warning names any that is not). Masking needs the proxy to terminate TLS, and Claude honors `mask` entries and `tlsTerminate` only from user, managed or `--settings` scope, which is where this fragment goes. Requires Claude Code v2.1.221+. On macOS a masked file is blocked, not masked. A glob or directory falls back to `deny`, so the policy takes one file per entry. [sandboxing][sbx] |
| `sandbox.credentials: [{env, inject_hosts?}]` | `sandbox.credentials.envVars: [{name, mode: "mask", injectHosts}]` | Commands and their logs never hold the real value; a `deny` for the same variable in any scope wins. [sandboxing][sbx] |
| `profiles.<p>.sandbox`, `profiles.<p>.egress` | as above, for that profile | Merged key by key over the top-level `sandbox` and `egress` before compiling. |
| `budgets.<tier>` | runner flags `--max-turns`, `--max-budget-usd` | No settings key; the runner reads the policy. `max_minutes` and `max_tokens` have no flag: the runner enforces them with a timeout, or the compile fails. |
| `accept_gaps` | — | Only consulted when a field cannot be represented. An entry covers the `profiles` it names; one without `profiles` covers every profile except a bypass-tier one, so the devbox's `sandbox` and `egress` gaps are accepted for it by name. |

**Credential masks are not read denies.** Claude merges `Read(...)` deny rules into the sandbox's
filesystem denies ("paths and domains from both sandbox settings and permission rules are merged"),
and a deny only ever narrows, so a file cannot be denied to Claude's file tools and masked for
sandboxed commands at once: the policy rejects a mask on a path `deny_read` names
(`credential-not-denied`), and a compile with a file mask warns that Claude's Read tool can read that
file (`mask-not-a-read-deny`). Mask a credential the sandboxed tools must use (`~/.npmrc`, gh's
`hosts.yml`) instead of denying it, and keep a project's secret guard hook for the Read tool if the
model must not see it either.

**Never emitted:** `disableAllHooks` (removes every hook wall; ADR-0021), `skipDangerousModePermissionPrompt`
outside the `autonomous` tier, any project-scope `defaultMode`.

**Degradation (fail closed).** A Claude compile fails on input it cannot express exactly:

- `deny_read` or a `forbid.write` without `sandbox.enabled: true` — a `sandbox` gap: the permission
  rules bind the file tools and recognized file commands, and a script the agent runs reads past
  them; accept it (`accept_gaps: {engine: claude, field: sandbox, profiles: [...]}`) only where the
  machine itself holds no secret the policy denies;

- a `forbid` or `deny_read` glob the permission syntax cannot anchor (for example a Windows drive path
  on a POSIX profile) — error, unless `accept_gaps` names `{engine: claude, field: forbid|deny_read}`;
- a `forbid.command` whose first token is an alternatives list is expanded into one deny per
  alternative, never dropped;
- `budgets.max_minutes` / `max_tokens` on a tier whose runner has no timeout — error.

## Plugin manifest skeleton

[`plugin.json`](plugin.json) packages the harness skills for Claude Code. Every field is one the
plugin reference documents and `name` is the only required one. It declares no `skills` key: the
default `skills/` directory is scanned anyway, and `skills` only adds directories to that scan.
`version` pins installs until it changes; bump it with each harness release. Copy it to
`.claude-plugin/plugin.json` at the root of the package that holds `skills/` (this repository's root),
and run `claude plugin validate --strict .` in CI. The plugin name `harness` avoids the reserved
`claude-`/`anthropic-` prefixes. No `hooks`, `agents` or `mcpServers`: walls belong to L2 projects
and L1 policy, not to a skills package.

[mem]: https://code.claude.com/docs/en/memory
[skills]: https://code.claude.com/docs/en/skills
[agents]: https://code.claude.com/docs/en/sub-agents
[perm]: https://code.claude.com/docs/en/permissions
[hooks]: https://code.claude.com/docs/en/hooks
[headless]: https://code.claude.com/docs/en/headless
[loop]: https://code.claude.com/docs/en/agent-sdk/agent-loop
[sbx]: https://code.claude.com/docs/en/sandboxing
[plug]: https://code.claude.com/docs/en/plugins-reference
[modes]: https://code.claude.com/docs/en/permission-modes
