---
epic: "template-migration"
generated_at: "2026-10-13T12:00:00Z"
generator: "harness/validate@1.0.0"
source_commit: "5651f88"
adoption: "legacy"
epic_status: "draft"
verdict: "not-ready"
counts:
  error: 0
  warning: 21
  info: 0
coverage:
  journeys:
    covered: 3
    total: 4
  requirements:
    covered: 0
    total: 8
  tasks:
    covered: 0
    total: 6
  criteria:
    covered: 0
    total: 40
gaps:
  - epic: "template-migration"
    rule: "task-cites-requirement"
    severity: "warning"
    subject: "TMIG-1"
    message: "TMIG-1 cites no requirement of template-migration/spec.md (requirements: [REQ-n])"
    file: "specs/template-migration/tasks/TMIG-1.md"
    blocks_readiness: true
  - epic: "template-migration"
    rule: "task-cites-requirement"
    severity: "warning"
    subject: "TMIG-2"
    message: "TMIG-2 cites no requirement of template-migration/spec.md (requirements: [REQ-n])"
    file: "specs/template-migration/tasks/TMIG-2.md"
    blocks_readiness: true
  - epic: "template-migration"
    rule: "task-cites-requirement"
    severity: "warning"
    subject: "TMIG-3"
    message: "TMIG-3 cites no requirement of template-migration/spec.md (requirements: [REQ-n])"
    file: "specs/template-migration/tasks/TMIG-3.md"
    blocks_readiness: true
  - epic: "template-migration"
    rule: "task-cites-requirement"
    severity: "warning"
    subject: "TMIG-4"
    message: "TMIG-4 cites no requirement of template-migration/spec.md (requirements: [REQ-n])"
    file: "specs/template-migration/tasks/TMIG-4.md"
    blocks_readiness: true
  - epic: "template-migration"
    rule: "task-cites-requirement"
    severity: "warning"
    subject: "TMIG-5"
    message: "TMIG-5 cites no requirement of template-migration/spec.md (requirements: [REQ-n])"
    file: "specs/template-migration/tasks/TMIG-5.md"
    blocks_readiness: true
  - epic: "template-migration"
    rule: "task-cites-requirement"
    severity: "warning"
    subject: "TMIG-6"
    message: "TMIG-6 cites no requirement of template-migration/spec.md (requirements: [REQ-n])"
    file: "specs/template-migration/tasks/TMIG-6.md"
    blocks_readiness: true
  - epic: "template-migration"
    rule: "task-index-agrees"
    severity: "warning"
    subject: "TMIG-1"
    message: "spec.md Tasks says TMIG-1 serves CUJ-1, CUJ-2; its frontmatter says CUJ-1. Write cuj: [CUJ-1, CUJ-2]"
    file: "specs/template-migration/tasks/TMIG-1.md"
  - epic: "template-migration"
    rule: "task-index-agrees"
    severity: "warning"
    subject: "TMIG-3"
    message: "spec.md Tasks says TMIG-3 serves CUJ-1, CUJ-2; its frontmatter says CUJ-1. Write cuj: [CUJ-1, CUJ-2]"
    file: "specs/template-migration/tasks/TMIG-3.md"
  - epic: "template-migration"
    rule: "journey-has-requirement"
    severity: "warning"
    subject: "CUJ-1"
    message: "no requirement of template-migration serves CUJ-1 (add a CUJ column to the Requirements table, or cite requirements from its tasks)"
    file: "specs/template-migration/cuj.md"
    line: 3
    blocks_readiness: true
  - epic: "template-migration"
    rule: "journey-has-task"
    severity: "warning"
    subject: "CUJ-2"
    message: "no task's cuj: names CUJ-2; spec.md Tasks attributes it to TMIG-1, TMIG-3 (fix the frontmatter)"
    file: "specs/template-migration/cuj.md"
    line: 15
    blocks_readiness: true
  - epic: "template-migration"
    rule: "journey-has-requirement"
    severity: "warning"
    subject: "CUJ-2"
    message: "no requirement of template-migration serves CUJ-2 (add a CUJ column to the Requirements table, or cite requirements from its tasks)"
    file: "specs/template-migration/cuj.md"
    line: 15
    blocks_readiness: true
  - epic: "template-migration"
    rule: "journey-has-requirement"
    severity: "warning"
    subject: "CUJ-3"
    message: "no requirement of template-migration serves CUJ-3 (add a CUJ column to the Requirements table, or cite requirements from its tasks)"
    file: "specs/template-migration/cuj.md"
    line: 25
    blocks_readiness: true
  - epic: "template-migration"
    rule: "journey-has-requirement"
    severity: "warning"
    subject: "CUJ-4"
    message: "no requirement of template-migration serves CUJ-4 (add a CUJ column to the Requirements table, or cite requirements from its tasks)"
    file: "specs/template-migration/cuj.md"
    line: 35
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-1"
    message: "REQ-1 (R1) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 64
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-2"
    message: "REQ-2 (R2) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 65
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-3"
    message: "REQ-3 (R3) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 66
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-4"
    message: "REQ-4 (R4) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 67
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-5"
    message: "REQ-5 (R5) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 68
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-6"
    message: "REQ-6 (R6) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 69
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-7"
    message: "REQ-7 (R7) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 70
    blocks_readiness: true
  - epic: "template-migration"
    rule: "requirement-has-task"
    severity: "warning"
    subject: "REQ-8"
    message: "REQ-8 (R8) is implemented by no task"
    file: "specs/template-migration/spec.md"
    line: 71
    blocks_readiness: true
---

# Readiness · template-migration

<!-- Generated by tools/validate.mjs --trace. Do not edit; regenerate. -->

## Verdict

**not-ready** — epic status `draft`, legacy adoption: 0 error(s), 21 warning(s).

## Coverage

| Link | Covered |
|---|---|
| Journeys served by a task | 3/4 |
| Requirements implemented by a task | 0/8 |
| Tasks citing a requirement | 0/6 |
| Criteria named in a test | 0/40 |

## Gaps

| Severity | Rule | Subject | Finding |
|---|---|---|---|
| warning (blocks) | task-cites-requirement | TMIG-1 | TMIG-1 cites no requirement of template-migration/spec.md (requirements: [REQ-n]) |
| warning (blocks) | task-cites-requirement | TMIG-2 | TMIG-2 cites no requirement of template-migration/spec.md (requirements: [REQ-n]) |
| warning (blocks) | task-cites-requirement | TMIG-3 | TMIG-3 cites no requirement of template-migration/spec.md (requirements: [REQ-n]) |
| warning (blocks) | task-cites-requirement | TMIG-4 | TMIG-4 cites no requirement of template-migration/spec.md (requirements: [REQ-n]) |
| warning (blocks) | task-cites-requirement | TMIG-5 | TMIG-5 cites no requirement of template-migration/spec.md (requirements: [REQ-n]) |
| warning (blocks) | task-cites-requirement | TMIG-6 | TMIG-6 cites no requirement of template-migration/spec.md (requirements: [REQ-n]) |
| warning | task-index-agrees | TMIG-1 | spec.md Tasks says TMIG-1 serves CUJ-1, CUJ-2; its frontmatter says CUJ-1. Write cuj: [CUJ-1, CUJ-2] |
| warning | task-index-agrees | TMIG-3 | spec.md Tasks says TMIG-3 serves CUJ-1, CUJ-2; its frontmatter says CUJ-1. Write cuj: [CUJ-1, CUJ-2] |
| warning (blocks) | journey-has-requirement | CUJ-1 | no requirement of template-migration serves CUJ-1 (add a CUJ column to the Requirements table, or cite requirements from its tasks) |
| warning (blocks) | journey-has-task | CUJ-2 | no task's cuj: names CUJ-2; spec.md Tasks attributes it to TMIG-1, TMIG-3 (fix the frontmatter) |
| warning (blocks) | journey-has-requirement | CUJ-2 | no requirement of template-migration serves CUJ-2 (add a CUJ column to the Requirements table, or cite requirements from its tasks) |
| warning (blocks) | journey-has-requirement | CUJ-3 | no requirement of template-migration serves CUJ-3 (add a CUJ column to the Requirements table, or cite requirements from its tasks) |
| warning (blocks) | journey-has-requirement | CUJ-4 | no requirement of template-migration serves CUJ-4 (add a CUJ column to the Requirements table, or cite requirements from its tasks) |
| warning (blocks) | requirement-has-task | REQ-1 | REQ-1 (R1) is implemented by no task |
| warning (blocks) | requirement-has-task | REQ-2 | REQ-2 (R2) is implemented by no task |
| warning (blocks) | requirement-has-task | REQ-3 | REQ-3 (R3) is implemented by no task |
| warning (blocks) | requirement-has-task | REQ-4 | REQ-4 (R4) is implemented by no task |
| warning (blocks) | requirement-has-task | REQ-5 | REQ-5 (R5) is implemented by no task |
| warning (blocks) | requirement-has-task | REQ-6 | REQ-6 (R6) is implemented by no task |
| warning (blocks) | requirement-has-task | REQ-7 | REQ-7 (R7) is implemented by no task |
| warning (blocks) | requirement-has-task | REQ-8 | REQ-8 (R8) is implemented by no task |
