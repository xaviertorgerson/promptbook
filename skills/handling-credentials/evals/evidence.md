# Evidence — handling-credentials

## 2026-10-13 · Routes on a 296-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill handling-credentials --runner "node router.mjs" --json, run 3 times on 2026-10-13 at harness feat/reconcile-skills after 681794e, with $SKILLDEX a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the runner in skills/evaluating-skills/references/engine-notes.md; per-case results in skills/routing-results-2026-10-13.jsonl, the table in skills/ROUTING-RESULTS.md
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 36/36; precision 77%, recall 100% over every case in the catalog. The original 998-character description, same runner and cases: 36/36, precision 80%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2025-05-27 · The lethal trifecta against an official MCP server
- **Kind:** literature
- **Source:** https://simonwillison.net/b/8713
- **Claim:** Private data, untrusted instructions and an exfiltration channel in one session let a malicious public issue make an agent leak private-repository data through a forge's official MCP server.
- **Result:** The trifecta checklist runs before any tool or server is enabled.

## 2025-05-27 · The MCP injection was called architectural
- **Kind:** literature
- **Source:** https://devclass.com/2025/05/27/researchers-warn-of-prompt-injection-vulnerability-in-github-mcp-with-no-obvious-fix/
- **Claim:** The researchers' demonstration had no easy fix at the server; the session's capability mix is the control point.

## 2026-02-05 · Public skills ship secrets and payloads
- **Kind:** vendor-reported
- **Source:** https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub
- **Claim:** Snyk found 13.4% of 3,984 public skills with a critical issue, 76 confirmed malicious payloads, and hardcoded secrets in 10.9% of ClawHub skills; it advises scanning, removing flagged skills, rotating credentials and limiting agent privileges.
- **Result:** Provenance, pinning and a scan in the checklist; rotation after removing a compromised tool.

## 2026-04-08 · Credentials stay out of the sandbox
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/managed-agents
- **Claim:** Managed Agents keep credentials out of the sandbox; tool calls go through a vault proxy.
- **Result:** No long-lived key in an agent's reach; injection at process start.

## 2026-10-13 · The sandbox reads credential directories unless denied
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/sandboxing
- **Claim:** The sandbox can read most of the machine, including ~/.ssh and ~/.aws/credentials, unless read-deny is set, and inherits environment secrets; built-in tools, MCP servers and hooks run outside it.
- **Result:** Deny reads in both the permission rules and the sandbox.

## 2026-10-13 · OIDC tokens are per job and pinned by subject claim
- **Kind:** vendor-reported
- **Source:** https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
- **Claim:** A job needs id-token write permission to request the token; the cloud trust policy should evaluate the sub claim to limit which repositories, branches or environments can assume the role. The research behind this harness did not measure federation; it is standard practice.
- **Result:** references/oidc-and-injection.md.

## 2026-10-13 · App installation tokens expire after an hour and can be scoped
- **Kind:** vendor-reported
- **Source:** https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
- **Claim:** An installation access token expires after one hour and can be limited to listed repositories and a subset of permissions.
- **Result:** Per-run minting in the role-identity table.

## 2026-09-23 · Per-role scoped tokens in the template
- **Kind:** observed
- **Source:** agentic-template docs/roles.md, .claude/hooks/guard-secrets.mjs and scripts/secret-scan.mjs at commit bbfad58
- **Claim:** Reviewer token comment-only, coder token feature branches, one merge-capable token on a trusted runner; a path-based secret guard; a content scanner on the PR diff.
- **Result:** The role table and the scan rungs.

## 2026-10-13 · Secret guard and deny-list gaps
- **Kind:** measured
- **Source:** agentic-template .claude/hooks/guard-secrets.mjs (commit bbfad58) probed with Read and Bash payloads; dotfiles home/dot_claude/settings.json.tmpl (commit 6afafd2) read
- **Claim:** The hook allowed Read of ~/.ssh/id_ed25519, the rendered secrets file, registry and forge CLI token files and the agent's credential file, and allowed shell reads such as cat .env.local and source .env; the dotfiles deny list does not cover the rendered secrets file or cloud credentials; the content scanner runs only inside the reviewer agent's workflow.
- **Result:** The deny-read table, the policy fragment, and the note to add the scanner at pre-commit and as its own CI check.
- **Engine:** claude

## 2026-10-04 · Secrets rendered from the vault; servers hold none
- **Kind:** observed
- **Source:** dotfiles README.md (Secrets section) at commit 6afafd2
- **Claim:** A Bitwarden note renders to a mode-600 file at apply time; SSH keys stay in the vault's agent; always-on boxes hold no vault and use their own scoped logins.
- **Result:** Runtime injection on personal machines.
