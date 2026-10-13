# Evidence — writing-requirements

## 2026-09-21 · Criterion ids without a hyphen could not be grepped
- **Kind:** audit
- **Source:** agentic-template .claude/skills/planner/evals.md
- **Claim:** Tasks carried AC1 ids, so no test could be matched to a criterion.
- **Result:** The AC-n form and ears-coverage gate were adopted.
- **Revisit:** when a second id form is proposed

## 2026-10-12 · EARS criteria are unambiguous to a reviewer agent
- **Kind:** literature
- **Source:** https://alistairmavin.com/ears/
- **Claim:** The five EARS patterns give each requirement one reading.

## 2026-10-13 · Legacy R<n> rows normalize without edits
- **Kind:** measured
- **Source:** tools/validate.mjs on agentic-template specs/ (commit 5651f88)
- **Claim:** All 12 R<n> rows in two epics parse as REQ-<n> with no file change.
- **Engine:** claude
- **Skill version:** 1.0.0
