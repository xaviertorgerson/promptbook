# OIDC from CI, and runtime injection

## OIDC workload identity federation (CI → cloud)

Standing note: the research behind this harness did not measure OIDC federation; it is standard
platform practice, documented by the forges and clouds. The steps below follow one forge's
documentation, read on 2026-10-13 (cited in evals/evidence.md); check your forge's and cloud's
current pages before relying on a detail.

1. **Trust the forge's identity provider in the cloud account** (one-time, by a human with cloud
   admin): register the forge's OIDC issuer and audience.
2. **Create one cloud role per CI purpose** (build-push, deploy-dev, deploy-prod, backup-check),
   each with only the cloud permissions that job needs.
3. **Pin the trust policy to claims**: the subject claim limited to one repository and one branch,
   or one protected environment (`production` for deploy-prod). A trust policy that accepts any
   repository in the organization is a finding.
4. **Let the job request a token**: the job declares permission to request an ID token (on one
   forge, `id-token: write` at job level) and exchanges it for the role's temporary credentials.
   The ID token is valid for one job and expires on its own.
5. **Remove the stored cloud keys** from the forge's secrets once the federated job is green.
6. **Record** the role, its trust conditions and the jobs that use it in the role-identity table.

Production roles are assumable only from the protected production environment, which itself waits
for a human approver (releasing-changes).

## Runtime injection on personal machines (L1)

The dotfiles pattern the harness inherits:

- Secrets live in the password manager. At apply time the dotfiles render one note of
  `export NAME=value` lines into a mode-600 file outside every repository (in the user's dotfiles:
  `~/.config/shell/secrets.sh`), which the shell sources. Applying needs an unlocked vault.
- SSH keys stay in the password manager's SSH agent; no private key touches disk.
- Always-on boxes (devbox, servers) hold no vault. They authenticate with their own scoped logins
  (the forge CLI's own login, a tailnet identity) and cannot reach production by network ACL.
- Agents inherit the environment, so an agent session started from that shell can read every
  exported secret. Keep agent-facing sessions on the narrowest environment: start unattended agents
  with a scrubbed environment and inject only the variables the run needs; deny reads of the
  rendered file (deny-read-and-scanning.md).

Per-process injection, better than a sourced file where the tool supports it:

```sh
# resolve at process start; nothing written to disk, nothing in shell history
<password-manager-cli> run --env-file .env.refs -- <command>
```

where `.env.refs` holds only references (`DATABASE_PASSWORD=<vault reference>`), safe to commit.

## `${VAR}` in tool and server configs

- Server and tool configs (MCP server entries, CLI configs committed to a repository) reference
  variables: `"Authorization": "Bearer ${SERVICE_TOKEN}"`. A literal value in a committed config is a
  leak, whatever the repository's visibility.
- Some runtimes refuse to expand certain credential variables into remote server headers; then the
  server cannot take that credential from the config, which is the intended outcome. Do not work
  around it by inlining the value.
- Variables a project needs are listed with placeholders in a committed example file
  (`.env.example`), never with values.
