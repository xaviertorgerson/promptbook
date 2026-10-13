# Engine and forge notes

The procedure names no engine or forge. These notes map it; the harness `adapters/` own the mapping.

## GitHub (forge)

- Per-role identities: one GitHub App per role (or one app with per-run installation tokens scoped
  to repositories and permissions). An installation access token expires after one hour and can be
  limited to listed repositories and a subset of the app's permissions (GitHub docs, read
  2026-10-13).
- OIDC: a job with `permissions: id-token: write` requests an ID token; the cloud role's trust
  policy should pin the `sub` claim to the repository and branch or environment (GitHub docs, OIDC
  in AWS, read 2026-10-13). The ID token is valid for one job.
- Job-level `permissions` is honored; Forgejo ignores the key, so token scope is the real gate there
  (agentic-template docs/roles.md).
- Production: a protected `production` environment with a required reviewer holds the deploy
  secrets and the cloud role's trust condition.

## Claude Code (engine)

- Deny reads with `permissions.deny: ["Read(<glob>)"]` and `sandbox.filesystem.denyRead`; the Read
  tool, MCP servers and hooks run outside the sandbox, so both are needed. The sandbox reads
  `~/.ssh` and `~/.aws/credentials` unless denied, and inherits env secrets (harness adapter notes).
- The agent's own login is stored in `~/.claude/.credentials.json`; deny it, and never mount it into
  a container that runs a bypass-mode session.
- `.mcp.json` expands `${VAR}` in server configs; some credential variables are read as empty in
  remote server headers.
- agentic-template ships `guard-secrets.mjs` (rung 1, paths) and `secret-scan.mjs` (rung 3, run by
  the reviewer workflow); the gaps measured on 2026-10-13 are in deny-read-and-scanning.md.

## Codex, Gemini CLI

- Codex: execpolicy `forbidden` prefix rules for commands; an MCP allowlist that matches name plus
  command or URL; untrusted projects skip project config and hooks.
- Gemini CLI auto-loads `.env` from the working directory upward, so an agent there reads env files
  by design: keep secrets out of the tree it runs in (harness adapter notes; unverified details).

## Password manager (L1)

- The user's dotfiles render a Bitwarden note into `~/.config/shell/secrets.sh` (mode 600) at apply
  time and serve SSH keys from Bitwarden's SSH agent; servers hold no vault. Deny-read the rendered
  file for agent sessions.
