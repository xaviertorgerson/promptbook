# Adapter: OpenAI Codex

Where each promptbook contract lands when the engine is Codex (CLI, IDE, app), and how
`agent-policy.yaml` compiles to `config.toml` plus execpolicy rules. Verified against the docs on
2026-10-13, and every compiled config and rules file is loaded by Codex 0.162.1 (below). Codex docs
moved from `developers.openai.com/codex/*` to `learn.chatgpt.com/docs/*` (302 redirects); citations
use the current host. Some pages could not be fetched (sandbox and approvals, the full config
reference, refused again on 2026-10-13); those claims are marked *unverified*.

## Where artifacts land

| Contract / artifact | Codex location | Notes |
|---|---|---|
| Instructions | `~/.codex/AGENTS.md` (or `AGENTS.override.md`), project `AGENTS.md` per directory from the git root down | Concatenated root to cwd; `project_doc_max_bytes` caps the total (32 KiB default). [AGENTS.md][agents-md] |
| `skill` | `.agents/skills/<name>/SKILL.md` (repo, cwd up to root), `~/.agents/skills/`, `/etc/codex/skills` | Duplicate names both appear. Codex-only settings go in a sidecar `agents/openai.yaml` next to SKILL.md (`interface`, `policy.allow_implicit_invocation`, `dependencies.tools`), never in L3 frontmatter. [skills][skills] |
| Subagents | `~/.codex/agents/*.toml`, `.codex/agents/*.toml` | TOML, one per file; required `name`, `description`, `developer_instructions`; optional `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, `skills.config`. [subagents][subagents] |
| Walls (`forbid`) | execpolicy `prefix_rule(decision = "forbidden")` in `~/.codex/rules/*.rules` (L1) or `<repo>/.codex/rules/*.rules` (L2, trusted projects only) | Most restrictive decision wins (`forbidden` > `prompt` > `allow`). Experimental. [rules][rules] |
| Walls (`deny_read`) | permission profile `[permissions.<p>.filesystem.":workspace_roots"] "<glob>" = "deny"` | A glob takes `deny` only: "`deny` glob patterns are supported as deny-read rules" ([permissions][perm]), and Codex 0.162.1 refuses to load a glob with `read` or `write` (below). |
| Hooks | `~/.codex/hooks.json`, `<repo>/.codex/hooks.json`, or `[hooks]` in `config.toml`; plugins may bundle hooks | Events include `PreToolUse`, `PermissionRequest`, `PostToolUse`, `SessionStart`, `Stop`. A `PreToolUse` deny is `hookSpecificOutput.permissionDecision: "deny"` or exit 2 — the same protocol as Claude Code, so agentic-template's hooks run on both. Project hooks load only when trusted. [hooks][hooks] |
| `return` | `codex exec --output-schema <schema>` *(unverified: the non-interactive page could not be fetched)* | Otherwise a JSON file the subagent writes under `.agent/returns/`. |
| `run-record` | a runner around `codex exec` writes the same JSONL line; `subtype` holds the run's terminal event | No Codex-native run log is assumed. |
| Plugin packaging | portable root `plugin.json` + `skills/`, with `.codex-plugin/plugin.json` as the compatibility manifest | Below; Skilldex packages its install sets this way. [build plugins][plugins] |

## Policy compilation (`agent-policy.yaml` → `config.toml` + `rules/promptbook.rules`)

| Policy field | Codex key | Mapping |
|---|---|---|
| `tier: read-only` | `default_permissions = ":read-only"` | Built-in profile. [config basics][config] |
| `tier: ask` | `default_permissions = ":workspace"`, `approval_policy = "on-request"` | `untrusted` is retired, `on-failure` deprecated. [config reference][config-ref] |
| `tier: auto-edit` | `default_permissions = ":workspace"`, `approval_policy = "on-request"` | Codex has no separate "edits free, commands ask" mode: workspace writes are already sandbox-allowed; commands outside the sandbox prompt. Same output as `ask`; documented degradation. |
| `tier: auto` | `default_permissions = ":workspace"`, `approval_policy = "on-request"` | Codex has no classifier-reviewed mode in the docs read; the closest stricter mode is the workspace sandbox with on-request approvals: sandboxed work runs without asking, anything outside it prompts. Compiled with a `degraded` warning (never an error: it asks more, it does not loosen a wall). |
| `tier: autonomous` | `default_permissions = "promptbook"` (extends `:workspace`), `approval_policy = "never"` | Never `:danger-full-access`; requirements may forbid `never`, in which case the compile fails. [managed config][managed] |
| `tier: unattended` | profile file `~/.codex/<profile>.config.toml` with `approval_policy = "never"` | Every command runs in the sandbox and nothing prompts; `allow` rules are emitted only as the `allow` row below says. |
| `deny_read: [glob]` | `[permissions.promptbook.filesystem.":workspace_roots"] "<glob>" = "deny"` for relative globs; `[permissions.promptbook.filesystem] "<abs or ~ path>" = "deny"` for home/absolute | Unbounded `**` may need `glob_scan_max_depth` on Linux/WSL/Windows. Applies to sandboxed commands. [permissions][perm] |
| `forbid: {command: [...]}` | `prefix_rule(pattern = [...], decision = "forbidden", justification = reason, match = examples)` | Alternatives tokens map 1:1 (`["git", "push", ["--force", "-f"]]`). A `bash -lc` with redirection or substitution is matched as one whole invocation, so a forbid can be evaded by wrapping — pair it with a hook. [rules][rules] |
| `forbid: {command: [...], flags_anywhere: [...]}` | `prefix_rule(pattern = [<words>, [<literal flags>]], decision = "forbidden")` | The prefix form only: execpolicy matches an argv prefix token by token, so `git push origin main -f`, `git -C . push -f` and a flag ending in `*` (`+*`) are not matched. The rest is covered by the forbid guard (`hooks.forbid_guard`), or is a `forbid` gap that must be accepted. |
| `hooks.forbid_guard: true` | `hooks.json`: `{hooks: {PreToolUse: [{matcher: "Bash", hooks: [{type: "command", command: "node \"$HOME/.codex/hooks/promptbook/forbid-guard.mjs\" \"$HOME/.codex/hooks/promptbook/forbid.json\"", statusMessage}]}]}}`, plus `hooks/` | The documented `hooks.json` shape; shell commands "match as `Bash`", `PreToolUse` receives `tool_input.command`, and exit 2 with the reason on stderr denies ([hooks][hooks], verified 2026-10-13). Install at `~/.codex/hooks.json` and `~/.codex/hooks/promptbook/`. **Trust:** "new or changed hooks are marked for review and skipped until trusted" (`/hooks`), recorded against the hook's hash, so the compile warns `hook-trust`: until the operator trusts it once on the machine, the flags-anywhere forbids hold only in their prefix form. A recompile that changes only `forbid.json` keeps the hook's definition, and so its trust. "Treat tool hooks as a useful guardrail, not a complete enforcement boundary": the project hook and the sandbox stay the wall. |
| `forbid: {write: glob}` | filesystem `"<path>" = "read"` inside the writable roots, where `<path>` is a form Codex takes for `read` | Downgrades the path to read-only for sandboxed commands; the `apply_patch` tool is not covered by a documented rule. **Partial**: error unless `accept_gaps` names `{engine: codex, field: forbid}`. **Only `deny` takes a glob**: Codex 0.162.1 refuses the whole config for `"**/.git/hooks/**" = "read"` ("filesystem glob path … only supports `deny` access; use an exact path or trailing `/**` for `read` subtree access"), and the permissions page offers `"docs/**" = "read"` as the portable form (read and write globs "are less portable on Linux, WSL, and native Windows sandboxing"). So: an exact path or a literal path with one trailing `/**` is emitted as written; `**` is the workspace root `"."`; `**/<literal>/**` and `**/<literal>` are emitted as `<literal>/**` / `<literal>` under `:workspace_roots`, with a `glob-top-level-only` warning, since that holds only the copy at each workspace root (measured with `codex sandbox`: `.git/hooks/` read-only, `pkg/.git/hooks/` writable); any other glob has no read form, so nothing is emitted and it is a `forbid` gap (an unattended write ask: an `ask` gap) that fails the compile until accepted. |
| `forbid: {tool: web-fetch, domain}` | `[permissions.promptbook.network.domains] "<d>" = "deny"` with `[features] network_proxy = true` | Domain rules are not enforced while the proxy is off. [permissions][perm] |
| `forbid: {tool: "mcp:<server>:<tool>"}` | `mcp-restrictions.toml`: `[mcp_servers.<server>] disabled_tools = [...]`, a fragment beside `config.toml`, never in it | `disabled_tools` is a server's "Tool deny list (applied after `enabled_tools`)", and every server table needs its transport: `command` (stdio) or `url` (streamable HTTP) ([MCP][mcp]). Codex 0.162.1 refuses to load a `config.toml` holding `[mcp_servers.prod-db] disabled_tools = ["execute"]` alone ("invalid transport in `mcp_servers.prod-db`"), and the policy defines no servers, so the deny is written to the fragment, whose tables the merge step folds into the entries that define those servers (a server no entry defines has no tool to call; never add a table for it). Because the deny holds only once merged, it is a `forbid` gap (unattended, an MCP tool ask: an `ask` gap): the compile fails until it is accepted, and the report notes the merge. A whole-server forbid (`mcp:<server>`) has no key: omit the server, or accept the gap. |
| `roles.<r>` (unattended) | `roles/<r>/<profile>.config.toml`, `rules/promptbook.rules`, `runner.json` | A role's own config: Codex documents no per-run override of `default_permissions` (`--sandbox` "uses those older sandbox settings instead", dropping the deny entries), so a role whose permissions differ runs from its own `CODEX_HOME`. `read_only`: the `promptbook` profile extends `:read-only` ("keeps local command execution read-only"), with no write root; `apply_patch` is not held to it by a documented rule, so the role's write deny is a `forbid` gap; a read-only role with emitted `allow` rules (which run outside the sandbox) is refused. |
| `ask: {command}` | `prefix_rule(decision = "prompt")`; unattended `decision = "forbidden"` | Unattended nobody answers, so an ask is a denial (ADR-0021) and is compiled as one. |
| `ask: {write}` / `ask: {tool}` | interactive: — ; unattended: what the matching `forbid` compiles to | **Interactive: no equivalent.** An interactive ask is a convenience, so the compiler drops it with a warning (dropping one cannot loosen a wall when a human is asked about nothing else either). **Unattended: never dropped**, since dropping it turns a denial into an allow (the workspace is `"." = "write"`): a write ask downgrades the path to `"read"` for sandboxed commands, which leaves `apply_patch` uncovered, so it is an error unless `accept_gaps` names `{engine: codex, field: ask}` for the profile; a `web-fetch` domain ask becomes a domain deny and an MCP tool ask a `disabled_tools` entry in `mcp-restrictions.toml` (an `ask` gap, as the forbid row says); an ask with no Codex key fails closed the same way. |
| `allow: {command}` | `prefix_rule(decision = "allow")`, only with `accept_gaps {engine: codex, field: allow}` for the profile | An allow rule "runs outside the sandbox without prompting", and deny_read and egress are enforced by the sandbox alone, so an emitted allow voids both for that command. Without the accepted gap the allow is dropped with an `allow-unsandboxed` warning and the command runs sandboxed (the policy schema requires a non-empty `deny_read`, so there is always a sandbox wall to lose). An interpreter is never emitted, gap or not (`allow-interpreter`): `sh`, `bash`, `zsh`, `dash`, `fish`, `node`, `deno`, `bun`, `python*`, `ruby`, `perl`, `php`, `npx`, `env`, `xargs`, `sudo`, and `pnpm`/`npm`/`yarn` bare or with `exec`/`dlx`/`x`. `npm run`, `make` and `pnpm test` run project-defined code too: accepting the gap for them accepts that escape. |
| `allow: {write}`, `sandbox.writable_roots` | filesystem `"<path>" = "write"` (`**` is `"." = "write"`) | Only an exact path or a literal path with one trailing `/**`: any other glob is dropped with a warning (an allow, so dropping it never loosens a wall), since Codex refuses to load a glob with `write`. |
| `egress.allow_domains` / `deny_domains` | `[permissions.promptbook.network.domains] "<d>" = "allow"` (or `"deny"`), `network.enabled = true` | `**.host` and `*.host` have the same meaning as the policy. Requires the network proxy feature. |
| `egress.default: deny` | `network.enabled = true` with only the allow list | |
| `sandbox.*` | the permission profile is the sandbox | `fail_if_unavailable`: no documented key — **no equivalent**; error unless accepted. |
| `sandbox.credentials` (masks) | — | **No equivalent**: sandboxed commands would read the credential unmasked; error unless `accept_gaps` names `{engine: codex, field: sandbox}`. |
| `budgets` | `runner.json` `caps` and `enforcement`, `args: ["--json"]` when `max_turns` is set; enforced by `promptbook run` | The non-interactive page documents no turn, token, time or spend flag for `codex exec` ([non-interactive mode][exec]). `promptbook run` enforces `max_turns` by counting tool actions in the `--json` stream (`item.started` of `command_execution`, `file_change`, `mcp_tool_call`, `web_search`; the page lists those item kinds, the exact type names are *unverified*) and stopping the run as one more starts (exit 125), and `max_minutes` by a hard kill (exit 124). **Not enforced: `max_usd`** — Codex reports tokens (`turn.completed.usage`, recorded in the run report), not cost. Unattended, that is a `spend-unmetered` warning and the compile requires `max_minutes`, so the run has a hard ceiling no `accept_gaps` entry can remove; in other tiers `max_usd` (and `max_tokens` everywhere) is a `budgets` gap. |

**Degradation (fail closed).** An unrepresentable `forbid` or `deny_read` is a compile error, never a
silent drop; the only way past it is an `accept_gaps` entry with a reason, which the compiler prints.
Unrepresentable `ask` rules are dropped with a warning. Each compiled rule carries its
`justification` and `match` examples so `codex execpolicy check --rules <file> -- <cmd>` proves it.

**Loaded by the real CLI.** A key the docs allow can still be one Codex refuses to load, and a
refused `config.toml` loses every wall in it, not only the bad entry. `tests/codex-load.test.mjs`
(`CODEX_BIN=<codex> pnpm test`, or `codex` on `PATH`; skipped otherwise) copies each committed Codex
config (the goldens, the Tally example, the dotfiles' compiled output when present) and each fresh
compile of the fixture policies, as written and with every gap accepted, into a scratch
`CODEX_HOME` as `config.toml` and runs `codex features list` (exit 1, "failed to load
configuration", on a bad one); it runs `codex execpolicy check` on every rules file, which parses
the file and checks each rule's `match` examples, and requires the committed ones to forbid
`git push --force origin main`; and it loads each `mcp-restrictions.toml` merged into a server entry
with a `command`. Measured with Codex 0.162.1 on 2026-10-13. Neither `features list` nor
`codex doctor` reads `hooks.json` (a malformed one passes both), so the hook registration is
checked against the hooks page only. `codex doctor` also reports a startup warning for every
unbounded `**` deny on Linux ("Non-macOS sandboxing does not support unbounded `**` natively; set
`glob_scan_max_depth`"): the deny loads and applies; the compiler sets no depth, which is the
operator's trade between scan time and coverage.

## Plugin packaging

promptbook holds no skills, so it ships no plugin; Skilldex packages its install sets. For a skills
plugin, the `.codex-plugin/plugin.json` compatibility manifest carries `name`, `version`,
`description`, `author`, `homepage`, `repository`, `license`, `keywords`, an explicit
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
[exec]: https://learn.chatgpt.com/docs/non-interactive-mode
[config]: https://learn.chatgpt.com/docs/config-file/config-basic
[config-ref]: https://learn.chatgpt.com/docs/config-file/config-reference
[mcp]: https://learn.chatgpt.com/codex/mcp
[managed]: https://learn.chatgpt.com/docs/enterprise/managed-configuration
[plugins]: https://developers.openai.com/plugins/build/plugins

> ADR-0021 is agentic-template's measured permission matrix (Claude Code 2.1.296), on branch `docs/adr-permission-precedence`, commit `c177fa1`, until it lands on master.
