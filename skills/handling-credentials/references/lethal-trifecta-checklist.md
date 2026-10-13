# Lethal-trifecta checklist (before enabling any tool, plugin, skill or MCP server)

The lethal trifecta: a session that has (1) access to private data, (2) exposure to untrusted
input, and (3) a channel to send data out. Any session with all three can be steered by injected
text to exfiltrate. It was demonstrated against a forge's official MCP server: a malicious public
issue made an agent leak private-repository data into a public PR.

Fill one copy per tool, per version. Attach it to the PR that adds the tool or its pin.

## A. Provenance and pinning

- [ ] Source named (repository or registry) and the publisher verified, not a look-alike name.
- [ ] Pinned by full commit SHA or content hash in the toolkit lock; auto-update off.
- [ ] Every hook, server config, executable and install script read before install; nothing
      downloads or runs code at install time that was not read.
- [ ] No hardcoded credentials in the package (public skill registries have shipped them).
- [ ] A scanner run on it (a skill or MCP scanner) and its result recorded; a clean scan is
      necessary, not sufficient: reviewed malicious skills have passed scanners.

## B. The three legs, for the session configuration that will load it

| Leg | Question | This tool adds it? | Already present in the session? |
|---|---|---|---|
| Private data | Can the session read anything not public: private repositories, secrets, customer data, internal documents, the user's mail or files? | | |
| Untrusted input | Does the session read text an outsider can write: issues, PR comments, web pages, emails, tickets, dependency READMEs, another agent's output, the tool's own results? | | |
| Exfiltration | Can the session send data where an outsider can see it: web requests to arbitrary hosts, public comments or PRs, emails, chat posts, image URLs rendered in a client, DNS? | | |

- [ ] **At most two legs are present.** If all three are, do not enable as configured. Break a leg:
      read-only and private-data-free toolsets; egress limited to an allowlist of domains; untrusted
      sources processed in a separate session with no private data and no write tools; or a human
      approval step before any outbound write.

## C. Least privilege

- [ ] Read-only by default; write tools enabled one by one with a reason.
- [ ] Minimal toolset: only the tools this project uses are enabled, others disabled.
- [ ] Its credential is a least-privilege, short-lived token for its own identity (role-identities.md),
      referenced as `${VAR}`, never a literal in a config.
- [ ] It runs inside the sandbox where the runtime allows; where it runs outside the sandbox (hooks
      and servers often do), the permission rules still constrain its calls.
- [ ] Network egress for it is limited to the domains it documents.
- [ ] Scoped to the project (L2) only if every collaborator should have it; production-capable
      servers never in a project file.

## D. Decision

- [ ] Enabled / enabled with the leg broken as noted / refused.
- [ ] Reviewer (a human) and date. Re-run this checklist on every version bump.
