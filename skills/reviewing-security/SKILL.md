---
name: reviewing-security
description: Use when a change or tool needs a security review — auth, sessions, secrets, injection, webhooks, a new dependency, hooks, a third-party skill pack or MCP server, an agent reading untrusted input; "is this safe". Do not use for credential setup or rotation (handling-credentials).
license: MIT
compatibility: Any agent runtime that reads Agent Skills; any language or stack. Read-only; it reports findings and never edits the change.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Reviewing security

Threat-model the change, assume input is hostile and the blast radius is large, and report the
findings that matter in a fixed format. Agent tooling gets the same review as application code, plus
the lethal-trifecta check. If the runtime ships its own security reviewer, run it too; this skill is
the portable checklist and the findings contract.

Typical asks: "is this safe", "we're adding a new dependency", "security review this", "can this
leak", "check this for injection", "audit this skill or plugin before we install it"; any change
touching authentication, sessions, permissions, secrets, external input, network egress, a webhook,
a hook, an MCP server or an agent tool.

Hand off instead: setting up, issuing, storing, injecting or rotating credentials, tokens or OIDC
federation (handling-credentials); general correctness or style review (reviewing-code); judging
whether a task meets its criteria (verifying-work).

## Inputs

- The changeset (diff against its base) and the files it touches, read in full where a boundary is
  involved.
- The task (`task` contract: `id`, `## Acceptance criteria`, `risk`) and the requirements it cites,
  especially security NFRs (`NFR-n` with a security category).
- The project's access-control table and policy module, if any; its walls (deny hooks, permission deny
  rules, secret scanning, branch protection) and the operator policy's `deny_read`, `forbid` and
  `egress` (`policy` contract).
- For agent tooling: the skill, hook, MCP server or plugin files, their manifests, and the lock entry
  that pins them (`toolkit-lock`).

## Procedure

Copy the list into your working notes and tick it as you go.

1. **Map the surface.** List what crosses a trust boundary in this change: inputs (user, external
   API, webhook, file, other agents' output), outputs (responses, logs, outbound calls), privileges
   used (database, file system, tokens, shell), and who can reach each entry point.
2. **Run the checklist** ([checklist](references/checklist.md)) against every boundary:
   - **Secrets:** none in code, logs, commits, error messages, test fixtures or prompts; read from the
     environment or a secrets manager at runtime; never echoed.
   - **Authentication and authorization:** every privileged path establishes identity, then
     permission, then scope (the record belongs to the principal's tenant); tenant from the session,
     never the request; lists scoped like reads; one policy module; a negative test per refused role.
   - **Input validation at the boundary:** parse into types; reject unknown shapes; size limits.
   - **Injection:** SQL (parameterized only), shell (no string-built commands), templates and HTML
     (output encoding), path traversal, SSRF, deserialization, and prompt injection into any
     model-facing text.
   - **Supply chain:** each new dependency vetted (maintained, provenance, known vulnerabilities, install
     scripts), the lockfile committed, third-party agent packs mirrored and pinned with auto-update off.
   - **Crypto and personal data:** standard libraries only; personal data minimized, redacted in logs,
     encrypted at rest when stored.
   - **Abuse:** rate limits, bounded work per request, idempotent side effects (a webhook applied once
     per provider event id).
3. **Check agent tools for the lethal trifecta** ([agent-tools](references/agent-tools.md)). For each
   agent, skill, hook, MCP server or plugin the change adds or widens, mark the legs it gives one
   session: **(1) private data**, **(2) untrusted content**, **(3) an exfiltration channel**. All three
   in one session is a finding of at least high severity; the fix removes a leg (no secret or private
   read, no untrusted input, or no egress), never "be careful".
4. **Check the permission walls.** Anything that must never happen is a deny (a hook or a permission
   deny rule), not an ask; an ask is a denial in unattended runs and protects nothing there. Flag any
   change that turns a deny into an ask, disables hooks, removes a deny rule, adds a bypass, or
   widens an unattended allowlist.
5. **Write each finding** in the findings format ([output-format](references/output-format.md)):
   severity, area, location, what is wrong, a concrete exploit or failure scenario, the fix, and the
   trifecta leg or OWASP category where one applies. Report sparsely: only what violates a stated
   rule or carries a realistic risk; no style, no theoretical hardening, no finding to prove a pass ran.
6. **Verdict:** `block` if any critical or high finding is open, else `pass` (with medium and low
   findings listed for the author).

## Outputs

- A findings report in the format of `references/output-format.md`, posted as review comments or
  returned in the hand-back (`return` contract: findings in `summary`, the report path in
  `artifacts`, `decisions_needed` for anything a human must accept).
- The verdict, recorded where the project records evaluator verdicts (the task's agent log, the run
  record).
- Never a fix: the author resolves selected findings; the reviewer re-reviews the new head.

## Gates and stop conditions

- A critical or high finding blocks the merge until fixed or explicitly accepted by a human, with the
  acceptance recorded (an ADR or a dated note naming who accepted it).
- Never read real secret files or production data to prove a finding; describe the path instead.
- Set attention `needs-human` and stop when:
  - a secret is found committed or pushed: it must be rotated first (handling-credentials), then
    removed by a human-run procedure;
  - the change weakens a wall, adds a bypass, or disables hooks;
  - a third-party skill, plugin or MCP server ships code that runs outside the agent's sandbox or
    makes network calls: a human signs the read;
  - an accepted risk is proposed: only a human can accept it.

## References

- [references/checklist.md](references/checklist.md): the checklist by area, with what to look for.
- [references/agent-tools.md](references/agent-tools.md): the lethal trifecta, reviewing skills,
  hooks, MCP servers and plugins, permission walls.
- [references/output-format.md](references/output-format.md): the findings format, severities, a
  worked report.
