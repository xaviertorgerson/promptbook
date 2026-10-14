# Adapter: Gemini CLI and Antigravity CLI

Where each harness contract lands for Google's agents, and how `agent-policy.yaml` compiles to Gemini
CLI settings and policy-engine TOML. Verified against geminicli.com and antigravity.google on
2026-10-13. Gemini CLI was replaced by Antigravity CLI (`agy`) for unpaid and Google One users on
2026-06-18; paid API-key and enterprise users may still run Gemini CLI
([migration][migrate]). This adapter targets Gemini CLI's documented surfaces and notes where `agy`
differs; Antigravity's own policy and hook surfaces were not documented on the pages read.

## Where artifacts land

| Contract / artifact | Gemini CLI | Antigravity CLI (`agy`) |
|---|---|---|
| Instructions | `GEMINI.md` by default; set `context.fileName: ["AGENTS.md", "GEMINI.md"]` in `.gemini/settings.json` | `GEMINI.md` and `AGENTS.md` are still read [migration][migrate] |
| `skill` | `.agents/skills/` (workspace alias, preferred over `.gemini/skills/`), `~/.agents/skills/` or `~/.gemini/skills/` (user) | workspace `.agents/skills/`; global `~/.gemini/antigravity-cli/skills/` [migration][migrate] |
| Subagents | `.gemini/agents/*.md`, `~/.gemini/agents/*.md`: frontmatter `name`, `description` (required), `kind`, `tools`, `mcpServers`, `model`, `temperature`, `max_turns`, `timeout_mins` [subagents][subagents] | not documented on the pages read |
| Walls | policy-engine TOML `[[rule]] decision = "deny"` in `~/.gemini/policies/*.toml` (user) or the admin directory | not covered by the migration guide |
| Hooks | `hooks` in `settings.json`, keyed by event (`BeforeTool`, `AfterTool`, `SessionStart`, ...); `hooksConfig.enabled` is the master switch. A `BeforeTool` hook blocks with `{"decision": "deny"}` on stdout (exit 0) or exit 2 [hooks][hooks] [configuration][config] | "Not covered" by the migration guide |
| MCP | `mcpServers` in settings.json | `~/.gemini/config/mcp_config.json`, `.agents/mcp_config.json`, URL key `serverUrl` |
| `return`, `run-record` | a runner around `gemini -p` writes them | — |
| Plugin packaging | extensions (`gemini-extension.json`); not shipped by the harness | `agy plugin import gemini` converts extensions to plugins |

## Policy compilation (`agent-policy.yaml` → `~/.gemini/settings.json` + `~/.gemini/policies/harness.toml`)

Policy-engine facts the mapping relies on ([policy engine][policy]): rules carry `toolName`,
`commandPrefix` (shorthand for `run_shell_command`), `commandRegex`, `argsPattern`, `decision`
(`allow` | `deny` | `ask_user`), `priority` 0-999, `modes`, `denyMessage`, `interactive`; tiers are
Default 1 < Extension 2 < Workspace 3 < User 4 < Admin 5, and a higher tier always wins. **The
workspace tier is currently disabled** (issue #18186), so a project's walls cannot be expressed as
Gemini policy today: L2 walls reach Gemini only as hooks or as the operator's L1 policy. In
non-interactive mode `ask_user` is treated as `deny`.

| Policy field | Gemini key | Mapping |
|---|---|---|
| `tier: read-only` | `general.defaultApprovalMode: "plan"` | Strict read-only mode. [configuration][config] |
| `tier: ask` | `general.defaultApprovalMode: "default"` | |
| `tier: auto-edit` | `general.defaultApprovalMode: "auto_edit"` | |
| `tier: auto` | `general.defaultApprovalMode: "auto_edit"` | No classifier-reviewed mode; the closest stricter one edits without asking and asks for commands. Compiled with a `degraded` warning. |
| `tier: autonomous` | no settings key: YOLO "can only be enabled from the command line"; the launcher passes it | Whether an admin- or user-tier `deny` outranks YOLO's auto-approval is not stated on the page read *(unverified)*; until a probe shows it, the compiler refuses `autonomous` for Gemini unless `accept_gaps` names `{engine: gemini, field: tier}`. |
| `tier: unattended` | launcher passes the non-interactive flags; `ask_user` becomes deny | |
| `deny_read` | `[[rule]] toolName = [<the file-reading tools>], argsPattern = "<regex of the glob>", decision = "deny"` | The tool names (`read_file`, `read_many_files`, the search and glob tools) are taken from the installed version's tool list at compile time *(not verified here)*; **partial**, and `run_shell_command` reads (`cat .env`) are not covered without a sandbox. Error unless `accept_gaps` names `{engine: gemini, field: deny_read}` or the profile runs Gemini sandboxed without the files mounted. |
| `forbid: {command: [...]}` | `[[rule]] commandPrefix = "a b", decision = "deny", denyMessage = reason`, priority 900 | One rule per alternatives expansion. |
| `forbid: {write: glob}` | `[[rule]] toolName = [<the file-writing tools>], argsPattern = "<regex>", decision = "deny"` | Same partial caveat as `deny_read`. |
| `forbid: {tool: web-fetch, domain}` | `[[rule]] toolName = "web_fetch", argsPattern = "<domain regex>", decision = "deny"` | |
| `forbid: {tool: "mcp:server[:tool]"}` | `[[rule]] toolName = "mcp_<server>_*"` (or the tool), `decision = "deny"`; or `mcpServers.<s>.excludeTools` | Avoid underscores in server aliases (the engine splits on the first one). |
| `ask` | `[[rule]] ... decision = "ask_user"` | Denied when non-interactive. |
| `allow` | `[[rule]] ... decision = "allow"` and `tools.allowed` | |
| `egress.*` | — | **No equivalent**: the sandbox offers "open" or "proxied" profiles, not a domain list [sandbox][sandbox]. `default: deny` or any `deny_domains` → error unless accepted; with a proxy profile the operator's proxy enforces the list. |
| `sandbox.enabled` | `tools.sandbox: true` (or `docker`, `podman`, ...) | Seatbelt profiles `permissive-open` … `strict-proxied` on macOS. |
| `sandbox.fail_if_unavailable` | — | **No equivalent**; error unless accepted. |
| `sandbox.writable_roots` | — | Container mounts are the launcher's job. |
| `sandbox.credentials` (masks) | — | **No equivalent**: sandboxed commands would read the credential unmasked; error unless `accept_gaps` names `{engine: gemini, field: sandbox}` (a container that mounts no credentials is the usual reason). |
| `budgets` | `settings.json` `model.maxSessionTurns` for `max_turns`; `runner.json` `caps` and `enforcement` for `harness run` | `model.maxSessionTurns` is the session's turn limit ([configuration][config]); headless, exceeding it exits 53, "turn limit exceeded" ([headless][headless]), which `harness run` reports as the engine's own stop. `harness run` enforces `max_minutes` by a hard kill (exit 124). **Not enforced: `max_usd`** — the headless JSON reports tokens, not cost: unattended, a `spend-unmetered` warning and `max_minutes` is required; elsewhere `max_usd` (and `max_tokens` everywhere) is a `budgets` gap. |

**Never emitted:** `hooksConfig.enabled: false`, `security.disableYoloMode: false` overrides on a
shared machine, any `tools.exclude` (deprecated in favour of deny rules).

**Degradation (fail closed).** Gemini is the engine with the most gaps: read-denies and egress are
the usual ones. The compiler errors on each unrepresentable `forbid`, `deny_read` or `egress` entry
and prints the `accept_gaps` stanza that would accept it, with the reason left for the operator to
write. A profile that lists `gemini` in `engines` and cannot compile is not rendered at all.

[migrate]: https://www.antigravity.google/docs/cli/gcli-migration
[subagents]: https://geminicli.com/docs/core/subagents/
[hooks]: https://geminicli.com/docs/hooks/
[config]: https://geminicli.com/docs/reference/configuration
[policy]: https://geminicli.com/docs/reference/policy-engine
[sandbox]: https://geminicli.com/docs/cli/sandbox/
[headless]: https://geminicli.com/docs/cli/headless/
