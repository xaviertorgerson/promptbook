# Credentials

## Problem

An agent runs untrusted text (issues, web pages, dependency READMEs, other agents' output) with the
user's privileges. A long-lived key in its reach is one prompt injection away from leaving. Shared
tokens make every role as powerful as the most powerful one, and leaks are found in history, not in
review.

## Practice

- **No long-lived keys in an agent's reach.** Not in the repo, not in its environment, not in a file
  it can read. Secrets reach a process at runtime, scoped to that process.
- **One identity per role.** Planner, coder, reviewer, merge and release each get their own forge
  identity with the narrowest scope that role needs (comment-only for the reviewer, feature branches
  for the coder, merge for the merge role only). Tokens are short-lived and minted per run.
- **Federate from CI to cloud.** CI jobs obtain cloud credentials by workload identity federation
  (OIDC) for the duration of the job, never from a stored key.
- **Personal machines: inject at runtime from a password manager.** The L1 layer renders secrets
  from the vault into a mode-600 file or the agent's environment at apply time; nothing secret is in
  the dotfiles. Always-on boxes hold no vault; they authenticate with their own scoped login.
- **A person moves a secret by pipe, never by typing it into a session.** From the vault's clipboard
  straight into the forge's or host's secret-set command, so the value reaches no transcript, shell
  history or log. Agents never type or paste a live credential and never create accounts on a live
  service; they name the secret and the command, and the person runs it.
- **Deny reads of secret-bearing paths** (`.env*`, `secrets/`, key and cloud-credential directories)
  in both the agent's permission rules and its sandbox; tool calls that run outside the sandbox
  still need the permission rule.
- **Scan for secrets at every rung:** a pre-write hook, pre-commit, and CI on the diff.
- **Break the lethal trifecta.** No session holds all three of: private data, untrusted input, and an
  exfiltration channel. MCP servers default to read-only, minimal toolsets and least-privilege tokens;
  credentials reference variables (`${VAR}`), never literals.

## Evidence

- 2026-04-08 · vendor · Anthropic Managed Agents: credentials never enter the sandbox; MCP calls go
  through a vault proxy ([Anthropic](https://www.anthropic.com/engineering/managed-agents)).
- 2026-04-15 · vendor · OpenAI's Agents SDK separates harness from compute to keep credentials out of
  environments where model code runs ([OpenAI](https://openai.com/index/the-next-evolution-of-the-agents-sdk/)).
- 2026-10 · vendor · Claude Code: the sandbox reads `~/.ssh` and `~/.aws/credentials` unless denied,
  and inherits env secrets; prefer "short-lived tokens" over mounting host secrets
  ([sandboxing](https://code.claude.com/docs/en/sandboxing); [devcontainer](https://code.claude.com/docs/en/devcontainer)).
- 2025-05-27 · practitioner · the lethal trifecta was demonstrated against GitHub's official MCP
  server ([Simon Willison](https://simonwillison.net/b/8713); [DevClass](https://devclass.com/2025/05/27/researchers-warn-of-prompt-injection-vulnerability-in-github-mcp-with-no-obvious-fix/)).
- 2026-02-05 · practitioner · Snyk found hardcoded secrets in 10.9% of ClawHub skills
  ([Snyk](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub)).
- 2026-09-23 · practice · agentic-template: per-role scoped tokens, one push-capable merge token, a
  secret-guard hook and `secret-scan` in CI ([roles.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/roles.md)).
- 2026-10 · practice · heirloom's operator sets production and QA secrets with `pbpaste | gh secret
  set NAME --env <stage>`; once the value went into the name argument, which the forge displays, and
  the key was rotated. Unsourced in the repository (the operator's notes); treat it as practice.
- 2026-10-04 · practice · the user's dotfiles render secrets from Bitwarden at apply time; servers
  hold no vault ([dotfiles README](https://github.com/xaviertorgerson/dotfiles/blob/main/README.md)).
- unsourced · OIDC federation from CI to cloud is standard platform practice but no source in this
  research measures or documents it; treat it as recommendation.

## Contracts used

`policy` (`deny_read`, `egress`), `grant` (which role may act), `toolkit-lock` (MCP servers pinned by
version), `run-record` (identity used per run).

## Anti-patterns

- One personal access token shared by every workflow.
- An API key in an MCP config file, or a `.env` copied into an agent's prompt.
- Bypass modes on a machine that holds production credentials.
- A reviewer token that can push.
- Secrets in logs because the agent echoed a variable to "check it".
- A secret pasted into the name field of a set command: names are listed in clear, so the value is
  burned and must be rotated.

## Revisit when

Agent runtimes issue per-run, per-tool credentials natively, or MCP's workload identity federation
proposals reach the spec.
