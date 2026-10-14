# Adapter: OpenAI Codex

Where each harness contract lands when the engine is Codex (CLI, IDE, app), and how
`agent-policy.yaml` compiles to `config.toml` plus execpolicy rules. Verified against the docs on
2026-10-13. Codex docs moved from `developers.openai.com/codex/*` to `learn.chatgpt.com/docs/*`
(302 redirects); citations use the current host. Some pages could not be fetched (sandbox and
approvals, the full config reference); those claims are marked *unverified*.

## Where artifacts land

| Contract / artifact | Codex location | Notes |
|---|---|---|
| Instructions | `~/.codex/AGENTS.md` (or `AGENTS.override.md`), project `AGENTS.md` per directory from the git root down | Concatenated root to cwd; `project_doc_max_bytes` caps the total (32 KiB default). [AGENTS.md][agents-md] |
| `skill` | `.agents/skills/<name>/SKILL.md` (repo, cwd up to root), `~/.agents/skills/`, `/etc/codex/skills` | Duplicate names both appear. Codex-only settings go in a sidecar `agents/openai.yaml` next to SKILL.md (`interface`, `policy.allow_implicit_invocation`, `dependencies.tools`), never in L3 frontmatter. [skills][skills] |
| Subagents | `~/.codex/agents/*.toml`, `.codex/agents/*.toml` | TOML, one per file; required `name`, `description`, `developer_instructions`; optional `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, `skills.config`. [subagents][subagents] |
| Walls (`forbid`) | execpolicy `prefix_rule(decision = "forbidden")` in `~/.codex/rules/*.rules` (L1) or `<repo>/.codex/rules/*.rules` (L2, trusted projects only) | Most restrictive decision wins (`forbidden` > `prompt` > `allow`). Experimental. [rules][rules] |
| Walls (`deny_read`) | permission profile `[permissions.<p>.filesystem.":workspace_roots"] "<glob>" = "deny"` | Globs are fully supported only for `deny`. [permissions][perm] |
| Hooks | `~/.codex/hooks.json`, `<repo>/.codex/hooks.json`, or `[hooks]` in `config.toml`; plugins may bundle hooks | Events include `PreToolUse`, `PermissionRequest`, `PostToolUse`, `SessionStart`, `Stop`. A `PreToolUse` deny is `hookSpecificOutput.permissionDecision: "deny"` or exit 2 — the same protocol as Claude Code, so agentic-template's hooks run on both. Project hooks load only when trusted. [hooks][hooks] |
| `return` | `codex exec --output-schema <schema>` *(unverified: the non-interactive page could not be fetched)* | Otherwise a JSON file the subagent writes under `.agent/returns/`. |
| `run-record` | a runner around `codex exec` writes the same JSONL line; `subtype` holds the run's terminal event | No Codex-native run log is assumed. |
| Plugin packaging | portable root `plugin.json` + `skills/`, with `.codex-plugin/plugin.json` as the compatibility manifest | Skeleton below. [build plugins][plugins] |

## Policy compilation (`agent-policy.yaml` → `config.toml` + `rules/harness.rules`)

| Policy field | Codex key | Mapping |
|---|---|---|
| `tier: read-only` | `default_permissions = ":read-only"` | Built-in profile. [config basics][config] |
| `tier: ask` | `default_permissions = ":workspace"`, `approval_policy = "on-request"` | `untrusted` is retired, `on-failure` deprecated. [config reference][config-ref] |
| `tier: auto-edit` | `default_permissions = ":workspace"`, `approval_policy = "on-request"` | Codex has no separate "edits free, commands ask" mode: workspace writes are already sandbox-allowed; commands outside the sandbox prompt. Same output as `ask`; documented degradation. |
| `tier: auto` | `default_permissions = ":workspace"`, `approval_policy = "on-request"` | Codex has no classifier-reviewed mode in the docs read; the closest stricter mode is the workspace sandbox with on-request approvals: sandboxed work runs without asking, anything outside it prompts. Compiled with a `degraded` warning (never an error: it asks more, it does not loosen a wall). |
| `tier: autonomous` | `default_permissions = "harness"` (extends `:workspace`), `approval_policy = "never"` | Never `:danger-full-access`; requirements may forbid `never`, in which case the compile fails. [managed config][managed] |
| `tier: unattended` | profile file `~/.codex/<profile>.config.toml` with `approval_policy = "never"` | Every command runs in the sandbox and nothing prompts; `allow` rules are emitted only as the `allow` row below says. |
| `deny_read: [glob]` | `[permissions.harness.filesystem.":workspace_roots"] "<glob>" = "deny"` for relative globs; `[permissions.harness.filesystem] "<abs or ~ path>" = "deny"` for home/absolute | Unbounded `**` may need `glob_scan_max_depth` on Linux/WSL/Windows. Applies to sandboxed commands. [permissions][perm] |
| `forbid: {command: [...]}` | `prefix_rule(pattern = [...], decision = "forbidden", justification = reason, match = examples)` | Alternatives tokens map 1:1 (`["git", "push", ["--force", "-f"]]`). A `bash -lc` with redirection or substitution is matched as one whole invocation, so a forbid can be evaded by wrapping — pair it with a hook. [rules][rules] |
| `forbid: {write: glob}` | filesystem `"<glob>" = "read"` inside the writable roots | Downgrades the path to read-only for sandboxed commands; the `apply_patch` tool is not covered by a documented rule. **Partial**: error unless `accept_gaps` names `{engine: codex, field: forbid}`. |
| `forbid: {tool: web-fetch, domain}` | `[permissions.harness.network.domains] "<d>" = "deny"` with `[features] network_proxy = true` | Domain rules are not enforced while the proxy is off. [permissions][perm] |
| `forbid: {tool: "mcp:..."}` | `mcp_servers.<id>.disabled_tools = [...]`, or omit the server | [config reference][config-ref] |
| `ask: {command}` | `prefix_rule(decision = "prompt")`; unattended `decision = "forbidden"` | Unattended nobody answers, so an ask is a denial (ADR-0021) and is compiled as one. |
| `ask: {write}` / `ask: {tool}` | interactive: — ; unattended: what the matching `forbid` compiles to | **Interactive: no equivalent.** An interactive ask is a convenience, so the compiler drops it with a warning (dropping one cannot loosen a wall when a human is asked about nothing else either). **Unattended: never dropped**, since dropping it turns a denial into an allow (the workspace is `"." = "write"`): a write ask downgrades the path to `"read"` for sandboxed commands, which leaves `apply_patch` uncovered, so it is an error unless `accept_gaps` names `{engine: codex, field: ask}` for the profile; a `web-fetch` domain ask becomes a domain deny and an MCP tool ask a `disabled_tools` entry; an ask with no Codex key fails closed the same way. |
| `allow: {command}` | `prefix_rule(decision = "allow")`, only with `accept_gaps {engine: codex, field: allow}` for the profile | An allow rule "runs outside the sandbox without prompting", and deny_read and egress are enforced by the sandbox alone, so an emitted allow voids both for that command. Without the accepted gap the allow is dropped with an `allow-unsandboxed` warning and the command runs sandboxed (the policy schema requires a non-empty `deny_read`, so there is always a sandbox wall to lose). An interpreter is never emitted, gap or not (`allow-interpreter`): `sh`, `bash`, `zsh`, `dash`, `fish`, `node`, `deno`, `bun`, `python*`, `ruby`, `perl`, `php`, `npx`, `env`, `xargs`, `sudo`, and `pnpm`/`npm`/`yarn` bare or with `exec`/`dlx`/`x`. `npm run`, `make` and `pnpm test` run project-defined code too: accepting the gap for them accepts that escape. |
| `allow: {write}` | `[permissions.harness.workspace_roots] "<dir>" = true` or filesystem `"write"` | |
| `egress.allow_domains` / `deny_domains` | `[permissions.harness.network.domains] "<d>" = "allow"` (or `"deny"`), `network.enabled = true` | `**.host` and `*.host` have the same meaning as the policy. Requires the network proxy feature. |
| `egress.default: deny` | `network.enabled = true` with only the allow list | |
| `sandbox.*` | the permission profile is the sandbox | `fail_if_unavailable`: no documented key — **no equivalent**; error unless accepted. |
| `sandbox.credentials` (masks) | — | **No equivalent**: sandboxed commands would read the credential unmasked; error unless `accept_gaps` names `{engine: codex, field: sandbox}`. |
| `budgets` | runner flags/timeouts around `codex exec` | No documented turn or spend cap key *(unverified)*; the runner enforces a wall-clock timeout, and `max_turns`/`max_usd` fail the compile unless `accept_gaps` names `{engine: codex, field: budgets}`. |

**Degradation (fail closed).** An unrepresentable `forbid` or `deny_read` is a compile error, never a
silent drop; the only way past it is an `accept_gaps` entry with a reason, which the compiler prints.
Unrepresentable `ask` rules are dropped with a warning. Each compiled rule carries its
`justification` and `match` examples so `codex execpolicy check --rules <file> -- <cmd>` proves it.

## Plugin manifest skeleton

[`plugin.json`](plugin.json) is the `.codex-plugin/plugin.json` compatibility manifest: `name`,
`version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, an explicit
`skills: "./skills/"` (Codex needs it, Claude does not), and an `interface` block with the fields the
build guide lists. The portable root `plugin.json` (schema
`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`) is the newer entry point; when it has an
`extensions["com.openai"]` object the compatibility manifest is ignored, not merged — so ship one or
the other for Codex, not both. A repo marketplace lives at `.agents/plugins/marketplace.json` with
`policy.installation`, `policy.authentication` and `category` per entry. [build plugins][plugins];
the `.codex-plugin` field set follows a working port of a Claude plugin
([Classmethod, 2026-08-26](https://dev.classmethod.jp/articles/publish-claude-code-plugin-to-codex/)).

[agents-md]: https://learn.chatgpt.com/docs/agent-configuration/agents-md
[skills]: https://learn.chatgpt.com/docs/build-skills
[subagents]: https://learn.chatgpt.com/docs/agent-configuration/subagents
[rules]: https://learn.chatgpt.com/docs/agent-configuration/rules
[perm]: https://learn.chatgpt.com/docs/permissions
[hooks]: https://learn.chatgpt.com/docs/hooks
[config]: https://learn.chatgpt.com/docs/config-file/config-basic
[config-ref]: https://learn.chatgpt.com/docs/config-file/config-reference
[managed]: https://learn.chatgpt.com/docs/enterprise/managed-configuration
[plugins]: https://developers.openai.com/plugins/build/plugins
