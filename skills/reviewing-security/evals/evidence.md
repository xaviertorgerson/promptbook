# Evidence — reviewing-security

## 2026-10-13 · Routes on a 280-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill reviewing-security --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 36/36; precision 80%, recall 100% over every case in the catalog. The original 765-character description, same runner and cases: 36/36, precision 92%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2025-05-27 · The lethal trifecta was exploited through an official MCP server
- **Kind:** literature
- **Source:** https://simonwillison.net/b/8713
- **Claim:** Private data, untrusted instructions and an exfiltration channel in one agent session make it exploitable; a malicious public issue made an agent using GitHub's official MCP server leak private-repository data (https://devclass.com/2025/05/27/researchers-warn-of-prompt-injection-vulnerability-in-github-mcp-with-no-obvious-fix/).
- **Result:** Step 3 checks the trifecta per session; the fix removes a leg.

## 2026-02-05 · Public skills ship secrets and malicious payloads
- **Kind:** literature
- **Source:** https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub
- **Claim:** Snyk found a critical issue in 13.4% of 3,984 public skills, 76 confirmed malicious, and hardcoded secrets in 10.9%; Unit 42 documented malicious skills that slipped past scanners (https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain-risk/).
- **Result:** Agent tooling is read by a person before install, pinned and mirrored; scanners are a floor.

## 2026-09-21 · Nothing said where tokens may live in the browser
- **Kind:** audit
- **Source:** agentic-template .claude/skills/security-review/evals.md @ bbfad58
- **Claim:** Secrets were guarded by path, but no rule said where session tokens may be stored client-side.
- **Result:** The checklist states httpOnly secure cookies, never client storage, as a stack-neutral rule (scenario S1).

## 2026-10-12 · Hooks and MCP servers run outside the sandbox
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/plugins/security
- **Claim:** Claude Code's plugin docs say a plugin can execute arbitrary code with the user's privileges, hooks and MCP servers run outside the sandbox, and auto-update can change reviewed files.
- **Result:** references/agent-tools.md treats hooks and MCP servers as installed software; a human signs the read.

## 2026-10-13 · Asks are not walls; only denies held in every mode
- **Kind:** measured
- **Source:** agentic-template DECISIONS.md ADR-0021 on branch docs/adr-permission-precedence
- **Claim:** Under a personal bypass default, project hook and settings denies blocked in every permission mode measured; an ask prompted only interactively and was a denial headless.
- **Result:** Step 4 flags any change that turns a deny into an ask, disables hooks or widens an unattended allowlist (scenario S4).
- **Engine:** claude
- **Model:** haiku

## 2026-10-13 · Ported from the template's security-review
- **Kind:** observed
- **Source:** agentic-template .claude/skills/security-review/SKILL.md, evals.md, .claude/hooks/guard-secrets.mjs, scripts/secret-scan.mjs, docs/_RBAC-TEMPLATE.md @ bbfad58
- **Claim:** The trifecta check, the checklist (secrets, authn/z, boundary validation, injection, dependencies, crypto and personal data, abuse), and the one-line severity format are stack-neutral.
- **Result:** Kept them and the three scenarios. Dropped the mention of one engine's built-in reviewer, the mandate's client-storage table, the hook names and package manager; generalized the RBAC template's identity-permission-scope rule and secret-scan patterns into the checklist. Added SEC-n findings with scenario and fix, severity definitions, the walls check and the review of third-party agent tooling.
