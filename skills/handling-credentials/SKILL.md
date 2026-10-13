---
name: handling-credentials
description: Use when agent credentials are set up or go wrong — each agent role's token, OIDC instead of stored cloud keys, runtime secret injection, deny reads of .env and ~/.ssh, secret scanning, rotating or leaked keys, "is it safe to add this MCP server". Do not use for code review (reviewing-security).
license: MIT
compatibility: Any agent runtime with permission rules or hooks, a forge with scoped tokens, and a secret store. Optional harness tools/validate.mjs (Node 22) to check the policy file.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Handling credentials

An agent reads untrusted text with someone's privileges. A long-lived key in its reach is one
prompt injection away from leaving, and a shared token makes every role as strong as the
strongest. Design credentials so each role holds only what it needs, for only as long as a run,
with walls that deny reads and scanners that catch what slips.

Typical asks: "what token should the reviewer agent use", "give the merge agent its own credential",
"how do CI jobs reach the cloud without a stored key", "load secrets from the password manager at
runtime", "block agents from reading .env and ~/.ssh", "add secret scanning", "rotate this key", "a
token leaked in a commit", "is it safe to add this MCP server", "can this tool see private data and
post to the internet".

Hand off instead: reviewing code for vulnerabilities such as injection or broken authorization
(reviewing-security); issuing merge authority (delegating-authority); deploying with those
credentials (releasing-changes).

## Inputs

- The roles in play and what each must do (workflow contract roles: planner, coder, reviewer,
  merge, train, orchestrator; plus a releaser and an auditor where they exist).
- The operator policy (`policy` contract): `deny_read`, `forbid`, `egress`, `sandbox`, per profile.
- The project's walls: secret-guard hooks, permission deny rules, ignore rules, the secret scanner,
  and the forge's environments and secrets.
- Any new tool, plugin, skill or MCP server proposed, with its source, version and requested scopes.
- The toolkit lock (`toolkit-lock` contract) for third-party pins.

## Procedure

**Design identities**

1. **One identity per role.** Fill references/role-identities.md for the project: each role's
   identity, the scopes it gets, the scopes it must not have, how the token is minted, its
   lifetime. The reviewer can comment and never push; the coder pushes feature branches and opens
   draft PRs; only the merge role can merge; no agent identity can deploy to production; no agent
   identity is a code owner.
2. **Short-lived by default.** Mint per run from an app installation or federation, scoped to the
   repositories and permissions of that run. A personal access token shared by workflows is the
   anti-pattern. Where a long-lived credential cannot be avoided, it lives only in the forge's
   secret store or protected environment, scoped to one job, with a rotation date.
3. **Federate CI to the cloud.** CI jobs get cloud credentials by OIDC workload identity federation
   for the length of the job, with the cloud's trust policy pinned to repository, branch or
   environment claims (references/oidc-and-injection.md). No cloud key stored in the forge.
4. **Inject at runtime on personal machines.** Secrets come from the password manager at apply or
   process start into the environment or a mode-600 file outside any repository; nothing secret in
   dotfiles, project files or worktrees. Always-on boxes hold no vault; they use their own scoped
   login. Config files name variables (`${VAR}`), never values.

**Build the walls**

5. **Deny reads of secret-bearing paths** in the permission rules and in the sandbox, for every
   engine the profile runs (references/deny-read-and-scanning.md): env files, `secrets/`, key files,
   SSH and cloud credential directories, the forge CLI's token file, the agent's own credential
   file, and the file the password manager renders into. Walls are denies; an ask protects nothing
   unattended.
6. **Never echo.** No command prints, diffs, greps, cats or logs a secret value, including "to check
   it is set": test presence (`test -n "$VAR"`) and print the name only. Logs redact by key.
7. **Scan at three rungs**: a pre-write hook that denies writing secret files and secret-shaped
   content; a pre-commit hook; CI on the diff of every PR. Any hit fails the gate; a false positive
   is fixed with a placeholder or an allowlist entry in review, never by skipping the scan.

**Admit tools safely**

8. **Run the lethal-trifecta check** (references/lethal-trifecta-checklist.md) before enabling any
   new tool, plugin, skill or MCP server, and when an existing one changes version. Refuse a session
   configuration that combines private data, untrusted input and an exfiltration channel; split it
   or remove a leg. Pin third-party sources by commit or hash with auto-update off; read hooks,
   server configs and executables before installing.

**Maintain**

9. **Rotate** on schedule, on a role change, after any suspected exposure, and after removing a
   compromised tool (references/rotation-and-leak-runbook.md): issue the new credential, switch
   consumers, verify, revoke the old, record it.
10. **Respond to a leak** with the runbook: revoke first, then clean up; assume anything readable by
    the leaked credential was read; never just delete the commit.

## Outputs

- A role-identity table and the forge and cloud settings that enforce it.
- Policy entries (`deny_read`, `forbid`, `egress`) and project deny rules; example:
  references/deny-read-fragment.policy.yaml (validates against the `policy` contract; if `harness validate`
  is available, run `node tools/validate.mjs --contract policy <file>`).
- Scanner placement (hook, pre-commit, CI) and a rotation log entry per rotation.
- For each admitted tool: the completed trifecta checklist and its pin in `toolkit.lock`.

## Gates and stop conditions

- Never: read a secret file you were not asked to read; print a secret; commit one; paste one into a
  prompt, issue or PR; give an agent identity production deploy rights or code-owner status; set an
  ask where a deny is needed; disable hooks to get past a guard.
- Credentials, revocation and rotation are human actions: an agent prepares the steps and the
  evidence; a human with the authority executes them (an auth-required signal is always
  `needs-human`).
- Hand to a human (attention `needs-human`): any suspected or confirmed leak; a tool whose trifecta
  legs cannot be broken; a role that needs a scope the table forbids; a long-lived credential with
  no rotation owner; a scanner hit that is not obviously a placeholder.

## References

- references/role-identities.md — per-role identities and scopes table (author, reviewer, merger,
  releaser, auditor, and the rest).
- references/oidc-and-injection.md — OIDC from CI, runtime injection from a password manager, `${VAR}`.
- references/deny-read-and-scanning.md — the deny-read patterns, known gaps, the three scan rungs.
- references/lethal-trifecta-checklist.md — the checklist before enabling any tool or server.
- references/rotation-and-leak-runbook.md — rotation steps, the leak response, the rotation log.
- references/deny-read-fragment.policy.yaml — a `policy` fragment with the deny-read wall.
- references/engine-notes.md — engine and forge specifics.
