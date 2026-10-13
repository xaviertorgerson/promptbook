# Deny-read patterns and the three scan rungs

## Deny-read patterns (walls)

Put each in the permission deny rules of every engine the profile runs, and in the sandbox's
filesystem deny list. Tool calls outside the sandbox (built-in file readers, MCP servers, hooks)
need the permission rule; shell reads are covered only by the sandbox or a hook.

| Pattern | Covers | Note |
|---|---|---|
| `**/.env`, `**/.env.*` except `.env.example`, `.env.sample`, `.env.template` | project env files | allow the example files explicitly |
| `**/secrets/**` | secret directories | |
| `**/*.pem`, `**/*.key`, `**/*.p12`, `**/*.pfx`, `**/*.keystore` | key material | |
| `~/.ssh/**` | all SSH keys and config | not only `id_rsa`: modern keys are `id_ed25519` |
| `~/.aws/**`, `~/.config/gcloud/**`, `~/.azure/**`, `~/.kube/config` | cloud and cluster credentials | |
| `~/.docker/config.json`, `~/.npmrc`, `~/.pypirc`, `~/.netrc` | registry tokens | |
| `~/.config/gh/hosts.yml` (or the forge CLI's token file) | the forge CLI's token | |
| the agent runtime's own credential file | the agent's login | for example `~/.claude/.credentials.json`; see engine-notes.md |
| the password manager's rendered file | every personal secret | in the user's dotfiles `~/.config/shell/secrets.sh` |
| `**/terraform.tfstate*` | state files with embedded secrets | |

### Gaps measured on 2026-10-13 (worth closing)

- agentic-template's secret guard hook denied `Read` of `id_rsa`, `.aws/credentials`, `.env.local`
  and `secrets/` paths, but allowed `Read` of `~/.ssh/id_ed25519`, `~/.config/shell/secrets.sh`,
  `~/.docker/config.json`, `~/.npmrc`, `~/.config/gh/hosts.yml` and the agent's credential file.
  For shell commands it denied `cat ./.env` and `cp .env …` but allowed `cat .env.local`,
  `source .env`, `grep KEY .env`, `cat ~/.ssh/id_ed25519` and `cat secrets/prod.json`.
- The dotfiles' personal deny rules cover `.env` variants, `secrets/` and `~/.ssh/**`, but not the
  rendered `~/.config/shell/secrets.sh`, cloud credential directories or the forge CLI token.

So shell reads depend on the hook's regexes; the sandbox's read-deny (or a hook that parses the
command's path arguments) is the wall for them.

## Never echo

- Check presence, not value: `test -n "${VAR:-}" && echo "VAR is set"`.
- No `env`, `printenv`, `set -x`, `cat`, `grep`, `diff` or `git diff` over a secret file or variable.
- Logs redact by key name (`*_TOKEN`, `*_KEY`, `*_SECRET`, `PASSWORD`, `AUTHORIZATION`), and never
  include request headers or full connection strings.

## Scan rungs

| Rung | When | What it checks | On a hit |
|---|---|---|---|
| 1. Pre-write hook | every file write or edit by an agent | the target path against the deny list; the written content against secret-shaped patterns | deny the write with the reason |
| 2. Pre-commit | every commit, human or agent | staged added lines | block the commit |
| 3. CI on the diff | every PR push | added lines in `<base>...<head>` | fail the required check |

Patterns the template's scanner uses (agentic-template `scripts/secret-scan.mjs`, commit bbfad58):
private key headers; cloud access key ids and secret access key assignments; forge personal tokens
(`gh[pousr]_…`); chat tokens (`xox[baprs]-…`); cloud API keys (`AIza…`); JWTs; and generic
`api_key|secret|password|token|client_secret = "<12+ chars>"`. Placeholders are allowlisted
(`example`, `changeme`, `your-…`, `<…>`, `${…}`, `xxxx`, `redacted`), and so are `.env.example`
files and the scanner's own source.

Rung 1 is the template's `guard-secrets` hook for paths; rung 3 is `secret-scan --diff <base>` in
the reviewer workflow. In that template the scanner did not run at rung 2 (its pre-commit config
runs lint, types, boundaries, drift and EARS checks, not the scanner) and did not run as a CI job of
its own, only inside the reviewer agent's workflow: add it to both.

A scanner is a net, not a wall: the deny rules and short-lived credentials are what keep a leak
small when the net misses.
