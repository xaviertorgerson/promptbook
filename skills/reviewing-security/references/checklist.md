# Security checklist

Default posture: input is hostile, the blast radius is large. Check each area the change touches.

## Secrets

- No keys, tokens, passwords or connection strings in code, configuration committed to git, test
  fixtures, logs, error messages, commit messages or prompts sent to a model.
- Read at runtime from the environment or a secrets manager; scoped to the process that needs them.
- Logs redact by key (`password`, `token`, `secret`, `authorization`, `cookie`, email, phone).
- Example and template environment files hold placeholders only.
- A content scan on the diff (if the project has one) is the floor, not the ceiling: look at added
  lines for long random strings, private-key headers, cloud key prefixes, JWTs.

## Authentication and authorization

- Every non-public entry point: identity (session or token), then permission (role allows the
  action), then scope (the target record belongs to the principal's tenant). All three, every time.
- The tenant comes from the authenticated principal, never from the request body or query.
- List endpoints filter by tenant like reads do.
- One policy function decides; no route hand-writes a role check.
- Session tokens in httpOnly, secure cookies; never readable by client script or stored in client
  storage.
- Single-purpose links: signed, single-record, expiring, revocable.
- Every refused role-action pair has a negative test.
- Operator and system actions append to an audit log the application cannot rewrite.

## Input validation

- Parse external input into types at the boundary (schema validation); reject unknown fields and
  shapes; enforce size and count limits.
- External API responses are input too: validate before use.
- Other agents' output is input.

## Injection

| Surface | Look for | Fix |
|---|---|---|
| SQL | string-built queries | parameterized queries, query builder |
| shell | interpolated command strings | argument arrays, no shell |
| HTML and templates | unescaped output | context-aware encoding |
| paths | user input in file paths | resolve and check against an allowed root |
| SSRF | user-supplied URLs fetched server-side | allowlist hosts, block internal ranges |
| deserialization | untrusted data into rich object loaders | data-only formats with schema validation |
| prompt injection | untrusted text placed in a model prompt that also has tools | separate data from instructions; remove a trifecta leg |

## Supply chain

- A new dependency: maintained, widely used or vetted, no known critical vulnerabilities, no install
  scripts that fetch or execute, license compatible.
- The lockfile is committed and installs are frozen in CI.
- Third-party agent packs (skills, hooks, MCP servers, plugins) are mirrored into a repository you
  control, pinned by commit and tree, with auto-update off.

## Crypto and personal data

- Standard library primitives only; no home-grown crypto, no deprecated algorithms.
- Collect the minimum personal data; encrypt at rest when stored; never log it.

## Abuse and availability

- Rate limits on authentication and expensive endpoints; bounded work per request; no unbounded
  recursion, allocation or fan-out.
- Side effects (payments, email, webhooks, jobs) are idempotent on a stable key.
