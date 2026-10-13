# Readiness checklist

Use part A only when the trace tool cannot run; it mirrors the tool's rules, names and severities so a
manual report and a generated one read the same. Parts B and C always run.

**Severity policy (as the tool applies it).** A broken reference or an invalid artifact is always an
**error**. A *missing* link is an **error** when the artifact claims readiness (the epic is approved,
in-progress or done; a task is ready or later) and a **warning** before that. **Adoption**: with
`docs/product/brief.md` the project is *full* and every rule applies; without it, *legacy*: the
product-layer rules are skipped (one **info** line) and every harness-introduced link (task →
requirement, requirement → journey, UX, ADR satisfies) is a warning even on an approved epic.
"Blocks" marks gaps that keep the verdict at not-ready whatever their severity.

## A · Trace rules

| Rule | Check | Severity | Blocks |
|---|---|---|---|
| `artifact-valid` | every brief, persona, cuj.md, spec.md, task, UX file and ADR passes its contract | error | — |
| `brief-exists` | `docs/product/brief.md` exists (else legacy adoption) | warning | — |
| `persona-exists` | every PER id in the brief's `personas` and in a journey's Personas is defined | error | — |
| `persona-has-journey` | every persona is cited by some journey | warning | — |
| `persona-in-brief` | every persona is listed in the brief's `personas` | warning | — |
| `epic-has-spec` | the epic folder has `spec.md` | error | yes |
| `epic-has-journeys` | the epic has `cuj.md` | missing-link | yes |
| `decision-exists` | every ADR id cited (spec header, ADR column, guiding doc anchor, superseded_by, supersedes) is defined | error | — |
| `requirement-exists` | every REQ/NFR cited by a task, an ADR's Satisfies or a UX flow is defined | error | — |
| `journey-exists` | every CUJ cited by a task, a requirement's CUJ column or a UX flow is defined | error | — |
| `task-exists` | every `depends_on` and `parent` id has a task file | error | — |
| `guiding-doc-exists` | every non-URL guiding doc path exists | error | — |
| `dependencies-acyclic` | `depends_on` has no cycle | error | — |
| `task-serves-journey` | a task's `cuj` is not null | warning | — |
| `task-cites-requirement` | a task lists ≥1 REQ/NFR in `requirements` (an id only in prose is a warning with the fix) | missing-link (harness) | yes |
| `criterion-named-in-test` | a task in review or later has every AC id in a test name | error | yes |
| `criterion-evidence-unambiguous` | an AC id shared by several tasks is named with its task id in the test | warning | — |
| `tests-exist` | some test file exists (else criterion coverage is not checked) | warning | — |
| `task-index-agrees` | the spec's Tasks table and the task files agree (ids and CUJs) | warning | — |
| `journey-has-task` | every journey is served by a task's `cuj` | missing-link | yes |
| `journey-has-requirement` | every journey is served by a REQ/NFR (CUJ column, or a task citing both) | missing-link (harness) | yes |
| `journey-cites-persona` | every journey names Personas (full adoption) | missing-link | yes |
| `journey-says-user-facing` | every journey says User-facing yes or no (full adoption) | warning | — |
| `user-facing-journey-has-ux` | every user-facing journey is designed by a UX flow (full adoption) | missing-link | yes |
| `requirement-has-task` | every REQ/NFR is implemented by a task | missing-link (harness) | yes |
| `nfr-has-decision` | every NFR is satisfied by an ADR (Satisfies or the ADR column) | warning | — |
| `decision-link-agrees` | an ADR's Satisfies and the row's ADR column agree | warning | — |
| `cites-current-decision` | no guiding doc cites a superseded ADR | warning | — |
| `ux-flow-serves-journey` | every UX flow names a CUJ | warning | — |

"missing-link" means warning before readiness and error once claimed; "(harness)" means always a
warning in legacy adoption.

**Coverage** (the report's four ratios): journeys served by a task / all journeys; requirements
implemented by a task / all requirements; tasks citing a requirement / all tasks; criteria named in a
test / all criteria.

## B · Plan checks (not in the trace)

| Check | Blocks when |
|---|---|
| Touches overlap | two tasks with no dependency path between them have overlapping `touches` (same glob, a prefix, a shared hot spot such as a lockfile or migrations, or `**`) |
| Touches present | a task has no `touches` |
| Size | a task is L or XL, or has more than about five criteria |
| Blocking questions | a task has an unchecked Open question marked blocking |
| Decisions accepted | a one-way ADR a task depends on is still Proposed |
| Skeleton is the root | the plan needs a walking skeleton (new product or new one-way door) and some task does not reach it through `depends_on` |
| Walkthroughs | a user-facing journey has no passing walkthrough row in `docs/ux/<epic>.md` |
| Harness fields | a medium or high risk task has no `evaluator` beyond tests, or any task has no `risk` or `budget` |

## C · Contradictions

- A REQ or task that serves a brief non-goal or a Scope Out item.
- Two requirements that cannot both hold (a 100 ms bound and a synchronous third-party call).
- A criterion whose behaviour differs from the requirement it cites.
- A task, requirement or guiding doc that relies on a superseded ADR.
- Personas whose "must never" conflict without a requirement that resolves it.

Each contradiction blocks readiness until the owner chooses.

## Routing: who fixes what

| Finding | Fixed by |
|---|---|
| brief missing, outcome or non-goal unclear | framing-products |
| persona missing, orphan persona, persona not in brief | defining-personas |
| journey missing persona or user-facing flag, journey without a task's reason to exist | mapping-journeys |
| journey without a requirement, vague NFR, contradiction between requirements | writing-requirements |
| user-facing journey without a flow, no passing walkthrough | designing-flows |
| NFR without a decision, proposed one-way ADR, superseded ADR still cited | choosing-architecture |
| task without requirement or touches, cycle, overlap, size, missing skeleton, index disagreement | planning-work |
| criterion not in a test name (task already in review) | the task's implementer (implementing-task) |

## The owner's question

```
Approve the <epic> spec?
Verdict: <ready | not-ready> (<tool | manual>) · journeys a/b · requirements c/d · tasks e/f · criteria g/h
Blocking: <none | each finding → the skill that fixes it>
Options: approve (the owner sets the epic approved; tasks without blocking questions become ready) · send back (the fixes above)
Report: specs/<epic>/readiness.md
```
