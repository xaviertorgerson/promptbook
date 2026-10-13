---
epic: my-epic
generated_at: "2026-01-01T12:00:00Z"            # when you ran the checks (UTC, ISO 8601)
generator: manual/checking-plan-readiness@0.1.0  # a tool run writes harness/validate@<version>
adoption: full                                   # full: docs/product/brief.md exists; legacy: it does not
epic_status: draft                               # the spec's status as you found it
verdict: not-ready                               # ready only with no error and no blocking gap
counts:
  error: 0
  warning: 1
  info: 0
coverage:
  journeys: { covered: 1, total: 2 }      # journeys served by a task
  requirements: { covered: 4, total: 4 }  # requirements implemented by a task
  tasks: { covered: 3, total: 3 }         # tasks citing a requirement
  criteria: { covered: 9, total: 9 }      # criteria named in a test
gaps:
  - rule: journey-has-task
    severity: warning                     # warning while the epic is draft; error once approved
    blocks_readiness: true
    epic: my-epic
    subject: CUJ-2
    message: "CUJ-2 (An organiser settles the month) is served by no task; fix with planning-work"
    file: specs/my-epic/cuj.md
    line: 18
---

# Readiness · my-epic

<!-- Write this by hand only when the trace tool is unavailable; a tool run regenerates it and you do
     not edit that output. One gap per finding, with the rule names of references/readiness-checklist.md.
     Check: harness validate specs/<epic>/readiness.md (or --contract readiness-report <file>). -->

## Verdict

**not-ready** (manual check) — epic status `draft`, full adoption: 0 error(s), 1 warning(s), 1 gap
blocks readiness. Plan checks (touches, size, blocking questions, decisions, skeleton): <none, or the findings>.

## Coverage

| Link | Covered |
|---|---|
| Journeys served by a task | 1/2 |
| Requirements implemented by a task | 4/4 |
| Tasks citing a requirement | 3/3 |
| Criteria named in a test | 9/9 |

## Gaps

| Severity | Rule | Subject | Finding | Fixed by |
|---|---|---|---|---|
| warning (blocks) | journey-has-task | CUJ-2 | CUJ-2 is served by no task | planning-work |
