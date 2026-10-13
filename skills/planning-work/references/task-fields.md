# Task fields

The task contract is a superset of the template's task frontmatter: every field the template writes
keeps its meaning, and the harness fields are optional to the schema but expected by this skill.

## Required (the queue)

| Field | Rule |
|---|---|
| `id` | `<PREFIX>-<n>`, equals the file name, never reused (a deleted task leaves a gap) |
| `epic` | the folder under `specs/` |
| `status` | `spec-draft` when planned; `ready` only after the owner approves the spec and no blocking question is open |
| `priority` | P0–P3; rank by value ÷ effort |
| `cuj` | the journey id (or a list) this slice serves; `null` only for a chore with no journey |
| `guiding_docs` | paths (with `#anchor` for an ADR) the coder reads first; each must exist |
| `branch` | `<type>/<prefix>-<n>-<slug>` |
| `depends_on` | ids that must be merged first; the skeleton for every non-skeleton task |
| `owner` | `null` when planned |

## Harness fields

| Field | Fill with | Wrong |
|---|---|---|
| `requirements` | the REQ/NFR ids the criteria restate (`<epic>/REQ-n` across epics) | ids only mentioned in prose (the trace warns) |
| `touches` | globs of the paths it will edit, including shared hot spots: lockfiles, migrations, route or DI registries, generated clients | empty, `**`, or a whole app when one module will change |
| `inputs` | section anchors (`specs/x/spec.md#requirements`); `{name, kind: secret | service | decision | data | file, ref, provided_by}` for what must exist first | whole directories |
| `risk` | `low`, `medium`, `high`, or `{level, irreversible, reasons}` | `low` on anything touching money, personal data, auth, deletion or a public API |
| `evaluator` | ordered `{kind, ref}`: tests, script, agent-review, human, eval | only "tests" on a high-risk task |
| `budget` | `{max_turns, max_usd, max_minutes}` for the whole task across runs | no budget on an unattended task |
| `mode` | the method that selects skills (below) | ralph-loop on high risk or an existing codebase |

## Risk → evaluator

| Risk | Evaluator, in order |
|---|---|
| low | tests on the touched paths; the criterion-coverage script |
| medium | the above; a separate reviewing agent with a clean context |
| high | the above; a human (code owner); `irreversible: true` never runs unsupervised |

## Size → budget (a starting point; tune from the project's run records)

| Size | Meaning | max_turns | max_usd | max_minutes |
|---|---|---|---|---|
| XS | a few lines, one criterion | 40 | 1 | 30 |
| S | one behaviour, two or three criteria | 80 | 2 | 60 |
| M | one slice through several layers, up to five criteria | 150 | 5 | 120 |
| L, XL | too big for one session | split before ready | | |

Raise the budget one step for `risk: high` (a stronger evaluator costs turns). A run that hits a cap
stops and asks; it is not retried blindly.

## Mode

| Mode | Use for | Never for |
|---|---|---|
| spec-driven (default) | features with clear behaviour | open exploration |
| research-plan-implement | deep or unfamiliar changes in an existing codebase | trivial changes |
| ralph-loop | greenfield work with strong tests and types | existing codebases, high or irreversible risk |
| icm-pipeline | sequential, human-reviewed stages, often docs or content | concurrent work |

The mode's selection rules belong to choosing-methodology; set the default here and let it override.
