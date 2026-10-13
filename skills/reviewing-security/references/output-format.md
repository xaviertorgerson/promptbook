# Output format

One finding per defect. Each finding is one block:

```markdown
### SEC-<n> · <severity> · <area> · <short title>
- **Location:** <path>:<line> (or the component and setting)
- **Finding:** what is wrong, in one or two sentences, quoting at most a short phrase of the code
- **Scenario:** who can do what to cause which harm, concretely
- **Fix:** the change that removes the cause (not "be careful")
- **Class:** <OWASP category, CWE, or trifecta leg(s): private-data | untrusted-content | exfiltration>
- **Blocks merge:** yes | no
```

`SEC-<n>` is numbered within one review. The one-line form for comments and hand-backs keeps the
template's order:

```
[high] authz — orders list ignores tenant scope (api/orders.ts:42) — filter by the session's tenant
```

## Severities

| Severity | Means | Blocks merge |
|---|---|---|
| critical | exploitable now by an outsider: data exposure across tenants, remote code execution, a live secret committed, auth bypass, the lethal trifecta with a real exfiltration path | yes |
| high | exploitable with a plausible precondition, or a wall weakened (a deny turned into an ask, hooks disabled, a bypass added) | yes |
| medium | defense missing where a rule requires it (no rate limit, a missing negative test, personal data in logs) | no, unless the task's security NFR names it |
| low | hardening a stated rule asks for, with no realistic exploit today | no |

## What is not a finding

Style, preference, theoretical hardening no rule asks for, duplicates of another finding, and
"looked at X, fine" lines. Report sparsely after investigating broadly.

## Review shape

```markdown
# Security review — <task id or PR> — <date>

Verdict: block | pass
Surface: <inputs, outputs, privileges, entry points in one paragraph>
Trifecta: <for each agent session the change adds or widens: legs present, or "none">

## Findings
### SEC-1 · high · authz · Orders list is not tenant-scoped
- **Location:** api/orders.ts:42
- **Finding:** the list query filters by the `tenantId` query parameter.
- **Scenario:** any signed-in user lists another tenant's orders by changing the parameter.
- **Fix:** take the tenant from the session principal; ignore the parameter; add a negative test.
- **Class:** OWASP A01 Broken Access Control
- **Blocks merge:** yes

## Accepted risks
- <none, or the finding id, who accepted it, where it is recorded>
```

When dispatched as a subagent, return the review's path in `artifacts`, the verdict and finding
counts in `summary`, and any risk awaiting acceptance in `decisions_needed`.
