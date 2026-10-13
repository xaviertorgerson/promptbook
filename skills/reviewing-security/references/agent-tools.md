# Agent tools: the lethal trifecta, extensions and walls

## The lethal trifecta

A session is exfiltration-exploitable when it combines all three:

| Leg | Examples |
|---|---|
| 1. private data | reading the repository's secrets or `.env`, a production database, private repositories, the user's mail or files, cloud credentials in the environment |
| 2. untrusted content | issue and pull-request text from outsiders, web pages, dependency READMEs, emails, tool results, other agents' output, files in a cloned third-party repository |
| 3. an exfiltration channel | outbound network (fetch, curl, a package install), posting comments or opening pull requests in public places, sending mail, writing to a shared bucket, an MCP tool that writes externally |

Check per session, not per tool: a read-only MCP server is still leg 1 if the same session can fetch
the web (legs 2 and 3).

**Fix by removing a leg:** no secret or private read in that session (deny-read rules, a separate
identity), no untrusted input (a separate session reads untrusted text and hands back data only), or
no egress (an egress allowlist, read-only tools, no comment-posting token). "The model will refuse"
is not a fix.

## Reviewing a skill, plugin, hook or MCP server before install

1. **Pin first:** review a specific commit; the lock entry must name that commit and tree, auto-update
   off for third parties.
2. **Read everything that executes:** hooks, MCP server code and launch commands, `bin/`
   executables, install and post-install scripts. What runs, on which events, as which user, with
   which environment variables?
3. **Hooks and MCP servers usually run outside the agent's sandbox** with the user's privileges:
   treat them as installing software, not as text.
4. **Read the instructions as an attacker would:** skill bodies, references and READMEs that tell
   the agent to fetch a URL, run a script, send data, disable a check or ignore earlier instructions
   are prompt injection until proven otherwise.
5. **Egress:** every host contacted, including telemetry. Is each needed and allowlisted?
6. **Credentials:** does anything read tokens, key files or environment secrets? Could it log them?
7. **Padding and size:** unusually large files can hide payloads from scanners. Scanners are a floor;
   the read is by a person.
8. **Least privilege:** MCP servers read-only by default, minimal toolsets, least-privilege tokens,
   credentials as variable references, never literals in configuration.

## Permission walls

| Correct | Finding |
|---|---|
| anything an agent must never do is a deny (hook returning deny, or a permission deny rule) | a must-never expressed as an ask (unattended, an ask is a denial and protects nothing; interactively, it can be approved by habit) |
| unattended runs pin the no-prompt mode plus an explicit tool allowlist | a bypass default on a machine that can reach production or holds production credentials |
| the personal layer adds denies and never removes the project's | a setting that disables hooks, or removes a project deny rule |
| denials are reported as questions for a human | code or prompts that retry a denied action another way |
| branch protection and required reviews backstop every hook | a token for an agent role that can push to the default branch or approve its own work |

## Mini-example

A new skill "triage-issues" reads every new issue (leg 2), runs with the repository's default
environment including a deploy token (leg 1), and may post comments and fetch URLs (leg 3).

Finding: `high · agent-tools · skills/triage-issues/SKILL.md · lethal trifecta: untrusted issue
text, a deploy token in the environment, and comment posting plus fetch in one session · an issue
can instruct the agent to post the token or fetch an attacker URL with it · run triage with a
comment-only identity, no deploy token in its environment, and egress limited to the forge`.
