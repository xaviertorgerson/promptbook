# Contracts

Promptbook defines the files every layer reads and writes, so that engines (Claude Code, Codex,
Gemini), runtimes (a CLI loop, CI agents, stagehand on Herdr) and methods can be swapped without
touching the others. A contract is a JSON Schema 2020-12 file in `schemas/`, versioned with
`x-version`; the state machines that govern the status fields are in `state-machines/`; the
validator is `tools/validate.mjs`. Layers are explained in [LAYERS.md](LAYERS.md), the five
repositories of the suite in [SUITE.md](SUITE.md).

Who writes what across the suite: a **stagecraft** project holds the plan and the queue (brief,
journeys, requirements, ADRs, tasks, readiness reports) and its `toolkit.lock`; **stagehand** is the
coordinator: it follows the project's own instructions for its task queue, keeps its own task
records (which the `task-record` contract reads unchanged) and records each delegation as a project
note in its private control state; the sequential loop and the CI agents (stagecraft) write run
records, and a runtime that wants a checkable delegation writes it in the `grant` format; **Skilldex** holds the
skills and their evals, in the `skill` and `evidence` formats, and the skills that write the
learning records; **dotfiles** hold the operator's `policy`. Promptbook holds the formats and the
checks, and writes none of these artifacts itself.

```
node tools/validate.mjs <file|dir>...           # each file against the contract its path implies
node tools/validate.mjs --contract task <file>  # against a named contract
node tools/validate.mjs --trace <project-root>  # the trace graph, per epic, with a verdict
node tools/validate.mjs --list                  # contracts, versions, artifact paths
```

## Conventions all contracts share

- **Artifacts** are Markdown with YAML frontmatter unless a contract says YAML, JSON or JSONL. The
  schema validates the frontmatter (or each parsed entry); required level-2 body headings are listed
  under `x-sections`, matched case-insensitively by prefix.
- **Where** an artifact lives is `x-artifacts` in its schema: a format, path globs relative to the
  project root, and `bind` rules that tie a frontmatter field to a path segment (a task's `id` must
  equal its file name; its `epic`, its folder). The validator infers a file's contract from these
  paths, or from `fixtures/{valid,invalid}/<contract>/`. A file outside the project layout (a
  skill's example) names its contract by suffix, declared as `x-artifacts[].suffixes`:
  `*.grant.yaml`, `*.return.json`, `*.task-record.yaml`, `*.run-record.jsonl`, `*.policy.yaml`,
  `*.toolkit.lock`, `*.governance.yaml`, `*.task.md`, `*.brief.md`, `*.persona.md` (frontmatter or a list),
  `*.adr.md`, `*.ux.md`, `*.spec.md` (epic and requirements), `*.cuj.md`, `*.readiness.md`,
  `*.agent-setup-review.md`, `*.reflection.md`, `*.evidence.md`, `*.routing.jsonl`. A suffix applies only when no path does; it binds no
  frontmatter field, and an entry file (`<epic>.cuj.md`, `<epic>.ux.md`) takes its epic from the name
  before the suffix. A `*.template.*` file, or one whose name starts with `_` (agentic-template's
  `docs/ux/_UX-TEMPLATE.md`, `specs/<epic>/tasks/_TASK-TEMPLATE.md`), holds placeholders on purpose
  and gets no inferred contract, nor does a file under a `_`-prefixed folder a path glob captures
  (`specs/_drafts/spec.md`), as the trace skips them; `--contract` still validates it.
- **Rules have names.** Conditional rules carry `x-rule`; errors report that name, a JSON pointer,
  and a file line. Rules JSON Schema cannot express are named checks listed in `x-checks`
  (`tools/lib/checks.mjs`). Unknown fields are errors, except `x-*` keys, which are free for local
  extensions, and a task record's top-level keys, which a runtime fills with its own evidence.
- **Ids.** `BRIEF`, `PER-n`, `CUJ-n` and `REQ-n`/`NFR-n` (per epic), `UX-n`, `ADR-nnnn`,
  `<PREFIX>-n` for tasks, `AC-n` per task, `GRANT-n`. A reference across epics is `<epic>/CUJ-n` or
  `<epic>/REQ-n`; within an epic the bare id is enough. ADRs belong to no epic, so they always qualify.
- **Shared definitions** (ids, dates, status enums, `mode`, `role` — the workflow roles, `evaluator`
  among them —, `budget`, `sessionRef`, `traceGap`) are in
  `common.schema.json` and referenced with `$ref`.
- **Versioning.** Each schema started at `1.0.0` and carries its own `x-version`
  (`validate.mjs --list` prints them). A change that makes a valid artifact invalid is a major
  bump; a new optional field or enum value is minor. Promptbook is pre-1.0 as a whole (README).

## Catalogue

| Contract | Artifact (in an L2 project unless noted) | Format | Producer | Consumers |
|---|---|---|---|---|
| [brief](#brief) | `docs/product/brief.md` | frontmatter-md | product owner | planner, trace check |
| [persona](#persona) | `docs/product/personas.md` or `personas/<slug>.md` | entries / frontmatter-md | product owner | journeys, trace check |
| [journey](#journey) | `specs/<epic>/cuj.md` entries | entries | product owner, planner | planner, tasks, trace check |
| [requirement](#requirement) | `specs/<epic>/spec.md` Requirements tables | table rows | product owner | tasks, ADRs, trace check |
| [ux-flow](#ux-flow) | `docs/ux/<epic>.md` entries | entries | designer | coder, trace check |
| [decision](#decision) | `DECISIONS.md` (or `docs/adr/*.md`) entries | entries | anyone, reviewed | everyone; trace check |
| [epic](#epic) | `specs/<epic>/spec.md` frontmatter | frontmatter-md | product owner | board, planner, trace check |
| [task](#task) | `specs/<epic>/tasks/<ID>.md` | frontmatter-md | planner | board, loop, coder, reviewer, merge, stagehand |
| [readiness-report](#readiness-report) | `specs/<epic>/readiness.md` | frontmatter-md | trace check (generated) | product owner at the spec gate |
| [task-record](#task-record) | `.orchestrator/tasks/<id>.yaml` (runtime) | YAML | the coordinator (stagehand's own records read as they are) | a replacement coordinator, the status board |
| [return](#return) | a subagent's hand-back | JSON | subagent | dispatcher |
| [run-record](#run-record) | `.agent/loop-runs.jsonl` (runtime, gitignored) | JSONL | runner (stagecraft's loop and CI agents) | humans, `promptbook report` |
| [grant](#grant) | `.orchestrator/grants/GRANT-n.yaml` | YAML | a human (a runtime may draft it from the human's words) | the coordinator, `promptbook grant verify` |
| [policy](#policy) | `agent-policy.yaml` (L1 dotfiles) | YAML | operator | `promptbook compile-policy` → engine settings |
| [toolkit-lock](#toolkit-lock) | `toolkit.lock` (L1 and L2) | YAML | `promptbook lock` | stagecraft's sync and CI, dotfiles |
| [governance](#governance) | `governance.yaml` (L2) | YAML | a human (owner), with the ADR that chose it | the forge's risk gate and auto-merge, the merge role (`auto-land`), `promptbook simulate` |
| [skill](#skill) | `skills/<name>/SKILL.md` (Skilldex; a set's or a project's own) | frontmatter-md | skill author | every engine's skill loader, `promptbook lint` |
| [evidence](#evidence) | `**/skills/<name>/evals/{evidence.md,routing.jsonl}` (Skilldex's, a project's `.agents/skills/` too), `routing-results*.jsonl` | entries / JSONL | skill author, `promptbook eval-routing` | skill reviews, routing evals |
| [agent-setup-review](#agent-setup-review) | `agent-setup-reviews/<date>-<label>.md` | Markdown record | Skilldex's reviewing-agent-setup skill | humans, the next review |
| [reflection-report](#reflection-report) | `reflections/*.md` | frontmatter-md | Skilldex's reflecting-on-runs skill | a curator, humans |

`common` holds the shared definitions and is not an artifact.

---

### brief

**Purpose.** The root of the trace graph: problem, users, outcomes, non-goals, and the personas the
product commits to. One per product. **Schema** `schemas/brief.schema.json` 1.1.0; `id: BRIEF`,
`product`, `owner`, `status` (draft | approved | superseded), `updated`, `personas[]`, `links[]`;
sections Problem, Users, Outcomes, Non-goals. **Swap story.** The brief can be written by hand, by an
interview skill, or exported from a product tool; the trace check only reads this file. **Compat.**
agentic-template has no brief; `docs/01-*` chapters hold similar prose. Its absence switches the
trace check to legacy adoption (below).

### persona

**Purpose.** A user the brief serves; journeys cite personas. **Schema** `persona.schema.json`
1.1.0: `id` PER-n, `name`, `role`, `goals[]` (≥1), optional `pains`, `context`, `quote`,
`evidence[]`. **Location.** Either one `docs/product/personas.md` with `## PER-n · Name` entries and
`- **Role:** …` / `- **Goals:**` bullets, or one frontmatter file per persona under `personas/`.
**Swap story.** Personas from research tools, interviews or analytics land in the same shape.
**Compat.** New in promptbook.

### journey

**Purpose.** A Critical User Journey: one end-to-end path that must work, the source of a task's
event, state and unwanted-behaviour criteria. **Schema** `journey.schema.json` 1.1.0: `id` CUJ-n,
`title`, `epic` (from the path), `actor`, `goal`, `trigger`, `success`, `unwanted`, optional `steps[]`,
`personas[]`, `user_facing`, `extra{}`. **Swap story.** Journeys can be drafted by a product owner, a
planner agent or a design tool; tasks reference them only by id. **Compat.** Describes
agentic-template's `cuj.md` unchanged (both epics validate as-is). New optional bullets:
`- **Personas:** PER-1` and `- **User-facing:** yes|no`.

### requirement

**Purpose.** One checkable behaviour (functional, REQ) or one measurable quality (non-functional,
NFR) of an epic; tasks implement requirements and ADRs satisfy them. **Schema**
`requirement.schema.json` 1.2.0: `id`, `source_id`, `epic`, `kind`, `statement`, `ears` (set by the
parser), `module`, `verified_by`, `cujs[]`, `adrs[]`; an NFR also requires `category` (performance,
reliability, availability, security, privacy, accessibility, usability, operability, observability,
cost, compliance, compatibility, maintainability, portability, scalability; the playbook's list is
held to it by a test) and `measure`. **Swap story.** A requirements tool can export the same rows; tasks cite
ids, not text. **Compat.** Describes agentic-template's `| # | Requirement | Module | Verified by |`
table; legacy `R<n>` ids normalize to `REQ-<n>` (Normalization).

### ux-flow

**Purpose.** The screens of a user-facing journey and its four states (empty, loading, error,
success), designed before code, with a prototype link. **Schema** `ux-flow.schema.json` 1.1.0: `id`
UX-n, `title`, `epic`, `cujs[]` (≥1), `requirements[]`, `steps[]`, `states{empty,loading,error,success}`,
`prototype` (inherited from the file's frontmatter), `accessibility`. **Swap story.** The prototype
may live in any design tool; only its link is in git. **Compat.** New; agentic-template's
`docs/design.md` is the visual language, not per-flow design.

### decision

**Purpose.** An Architecture Decision Record: the immutable why, the options rejected, whether the
door is one-way, what would reverse it, and the requirements it satisfies. **Schema**
`decision.schema.json` 1.2.0: `id` ADR-nnnn, `title`, `status` (proposed | accepted | superseded |
deprecated | rejected), `status_text`, `superseded_by[]`, `refined_by[]`, `date`, `supersedes`,
`supersedes_ids[]`, `decision`, `why` (or `context`, the Nygard form's `**Context:**`, which stands in
for it: `missing-why` only when neither is there), `consequences`, optional `options[]`, `door`,
`reversal_trigger`, `satisfies[]` (`<epic>/REQ-n`), `extra{}`, `placeholders[]`. Rules: a superseded
ADR names its successor; a one-way door names its reversal trigger; a date is required unless still
the template's `TODO(domain)` (warning). **Swap story.** One `DECISIONS.md` or one file per ADR under
`docs/adr/`; the parser reads both. **Compat.** Describes agentic-template's format (`## ADR-NNNN:
title`, `**Status:**`, `**Date:**`, `**Decision:**`, `**Why:**`, `**Consequences:**`, and the newer
`**Supersedes:**`, `**Reversed when:**`); all 18 ADRs validate unchanged.

### epic

**Purpose.** The planning-layer state machine of `spec.md` (intake → scoping → draft → approved →
in-progress → done; blocked). Not in the brief's table; added so the epic status is checked the
same way as the task status. **Schema** `epic.schema.json` 1.2.0: agentic-template's spec
frontmatter exactly (`epic`, `status`, `priority`, `size`, `business_value`, `initiative`, `owner`),
`owner` required from `approved` on, plus the optional promptbook field `mode`, the default methodology
of the epic's tasks (a task's own `mode` overrides it; absent everywhere, `spec-driven`); sections
Problem, Scope, Requirements, Tasks, Acceptance. The trace check reports each task's effective mode
(`--json`: `epics[].task_modes`) and an override of the epic's mode as `info`. **Compat.** Both
template epics validate unchanged.

### task

**Purpose.** One unit of work, the coordination substrate: the frontmatter is the kanban column, the
`branch` it names is the claim lock (a claim creates it on the remote; while it exists the live
status is on its head, and the default branch's copy says `ready` until the task lands:
`workflow.yaml` `status_authority`); the body is the contract the coder builds against. **Schema** `task.schema.json`
1.3.0. Required (agentic-template's fields, same meaning): `id`, `epic`, `status`, `priority`, `cuj`,
`guiding_docs`, `branch`, `depends_on`, `owner`. Optional template fields: `parent`, `size`,
`kickback_reason`. **Optional promptbook fields:**

| Field | Meaning |
|---|---|
| `requirements` | REQ/NFR ids this task implements; the trace check wants ≥1 |
| `touches` | path globs it expects to modify; overlapping tasks are one lane |
| `inputs` | paths or `{name, kind: file|secret|service|decision|data, ref, provided_by}` it needs first |
| `risk` | `low|medium|high` or `{level, irreversible, reasons}`; high/irreversible never runs unsupervised |
| `evaluator` | ordered `{kind: tests|script|agent-review|human|eval, ref}` that decide "met" |
| `budget` | `{max_turns, max_usd, max_minutes, max_tokens}` for the whole task |
| `sessions` | `sessionRef[]` the agent appends in its handoff (the runner never writes the task file) |
| `mode` | spec-driven, research-plan-implement, ralph-loop, icm-pipeline; absent: the epic's `mode`, else spec-driven |
| `lands_to` | the branch its PR targets when not the protected branch: the epic's integration branch (`integration/<epic>`); the task then goes `merging` → `integrated`, and `merged` when a human merges that branch |

`cuj` additionally accepts a list (`cuj: [CUJ-1, CUJ-2]`). `status` adds `integrated` (on the
epic's integration branch, not yet on the protected branch). Rules: a claimed task (in-progress,
review, human-review, merging) has an owner; `id` equals the file name and `epic` the folder;
criteria are `AC-n`, unique, EARS-shaped (the same five patterns as agentic-template's
`ears-lint.mjs`); no self-dependency; sections Context, Acceptance criteria, Open questions, Agent
log. **Swap story.** Any runtime that can read Markdown frontmatter can dispatch work: the
claude-cli loop, CI agents, stagehand, or a future PM-tool sync (as a projection, never an
authority). **Compat.** **All ten real task files** (BILL-1..4, TMIG-1..6) validate unchanged;
three are copied byte-for-byte into `fixtures/valid/task/real-*.md` and a test re-checks them against
their sources.

### readiness-report

**Purpose.** The trace check's verdict on one epic, generated for the product owner at the spec gate.
**Schema** `readiness-report.schema.json` 1.2.0: `epic`, `generated_at`, `generator`,
`source_commit` (the traced root's `HEAD` when it is a git repository), `adoption` (full | legacy), `epic_status`, `verdict` (ready | not-ready), `counts`,
`coverage` (journeys with a task, requirements with a task, tasks citing a requirement, criteria
named in a test, each `{covered,total}`), `gaps[]` (`traceGap`); a `ready` verdict has no error and
no gap that blocks readiness. Written by `validate.mjs --trace <root> --readiness <dir>`; never
hand-edited. `generated_at` and `source_commit` change on every check whatever the plan says, so
`--no-timestamp` leaves both out (1.2.0: `generated_at` is optional) and a report committed with the
plan changes only when the plan does; its own commit dates it. `--readiness <dir> --check`
regenerates each committed report in that form and fails on one that is missing, differs from the
plan (a hand edit, or a plan change not regenerated), is timestamped, or has no epic; CI runs it. **Compat.** New.

### task-record

**Purpose.** A runtime's recovery note for one task: what a replacement coordinator needs to resume
(repository, worktree, agents, native session ids, PRs, attention, next action, human decisions).
**Schema** `task-record.schema.json` 1.4.0; `state.name` is attention (working | needs-human |
complete), never a workflow status; needs-human requires `next_action`; complete forbids it. The
fields named here are typed; any other top-level key is a runtime's own evidence and is accepted
(1.4.0: stagehand's records carry the latest result, each PR's reviewed head and outcome, selected
feedback and human decisions under names his template leaves open).
Promptbook additions: `runtime`, `grant`, `signals{role: {source, value, observed_at}}` (source: an
`attention.yaml` vocabulary — herdr, a2a, mcp-tasks, claude-headless, loop-outcome, ci — or
codex-exec, forgejo, gitlab, other), structured `reviews[]` (each bound to the head it judged:
`outcome` pass | fail | changes-requested | comment, `role` reviewer for a code review or evaluator for
the verdict on the criteria) and `decisions[]`, `resources` (the
worktree's derived `slug`, `worktree_path`, `database`, `ports{slot,first,last}`, `caches`,
`services`, the last cleanup `audit{at, result: passed|blocked, blocked_by}` and
`worktree_removed_at`, which requires an audit that passed), `updated_at`. **Swap story.** A different runtime (a CLI loop, a CI
orchestrator, stagehand) keeps the same note; a coordinator can be replaced mid-task. **Compat.**
stagehand, the suite's coordinator, keeps its own records from its `assets/task-record.yaml`, and
this contract reads them as they are: a record filled from the template validates
(`fixtures/valid/task-record/stagehand-development.yaml`), its unnamed evidence included. The
promptbook additions above (`runtime`, `grant`, `signals`, `reviews`, `decisions`, `resources`) are
promptbook-optional; stagehand writes none of them. The field map is in
[adapters/herdr](adapters/herdr/README.md).

### return

**Purpose.** A subagent's hand-back: a bounded summary (8,000 characters, about 2k tokens), the
artifact paths it wrote, its attention, the decisions it needs, and each acceptance criterion met
or unmet with a reason. needs-human requires at least one question; complete requires no unmet
criterion. **Schema** `return.schema.json` 1.2.0; `task` is the workflow id (`<PREFIX>-<n>`) when
the work has one, otherwise the runtime's stable id, as `task-record.task_id` accepts (a review of
an outside PR, a delegated job). **Swap story.** Any engine's structured output
(`claude -p --json-schema`, a Codex output schema) or a JSON file; the dispatcher reads paths, not a
transcript. **Compat.** stagehand deliberately uses no worker JSON (it reads the pane); the return
is optional there.

### run-record

**Purpose.** One JSON line per agent run, appended by the runner. **Schema** `run-record.schema.json`
1.4.0: exactly `scripts/loop.mjs`'s line — `task`, `session_id`, `started_at`, `ended_at`, `exit`
(code or signal), `outcome`, `reason`, `subtype`, `num_turns`, `total_cost_usd`, `status_after` —
with null where loop.mjs writes null. `outcome` is advanced | stalled | failed | needs-human (the
loop's since it pins dontAsk: a denied call left the task where it was) for an author's run, and
verdict (an evaluator judged the criteria) or read (a reader or helper answered a question) for a
run that is not the author's. Promptbook optional fields: `engine`, `runtime`, `role` (author |
evaluator | reader | planner | orchestrator | merge | other; absent, the author), `model`,
`status_before`, `permission_mode`, `permission_denials` (a count, or one line per denied call as
the dontAsk loop writes them), `attention`, `budget`, `grant`, `usage` (`input`, `output`,
`cache_read`, `cache_write`: whole tokens over every model the run called, `input` being the part
neither read from nor written to the prompt cache; the cache pair is absent when the engine reports
none; null when the result reported no usage; Claude Code's are the result's `modelUsage` entries
summed, whose `costUSD` add up to `total_cost_usd`). Rules: failed, stalled and
needs-human carry a reason, advanced, verdict and read do not; advanced means the task left
ready/in-progress; a verdict is an evaluator's (`verdict-by-evaluator`), a read a reader's
(`read-by-reader`); a verdict or read that left the status other than it found it is a warning
(`run-kept-status`); `usage` holds only those four counts (`usage-counts-tokens`); ended ≥ started.
1.2.0 added `role`, the three outcomes and denial lines, so an evaluator's or reader's run is logged
as what it was instead of an author's "advanced"; 1.3.0 added `usage`, so a run's cost has its
tokens and cache hit rate beside it (`promptbook report`, TOOLS.md); 1.4.0 lets `task` be the
runtime's stable id when the work has no workflow task (a review of an outside pull request, a
delegated job), as `task-record.task_id` and `return.task` already do.
**Compat.** Lines from loop.mjs's own test runs are the fixture
`fixtures/valid/run-record/loop-mjs-outcomes.jsonl`; the dontAsk loop's lines (agentic-template
`fix/agent-run-caps`: `needs-human`, `permission_denials` as lines), produced with a fake engine, are
`loop-mjs-dontask.jsonl`, and a test holds the loop's outcome literals to the enum. The lines with
`usage` (agentic-template `integration/agent-hardening`), from the same fake engine, are
`loop-mjs-usage.jsonl`. A task's
`sessions[]` entry (`common` `sessionRef`, 1.4.0) takes the same outcomes.

### grant

**Purpose.** A human delegating named decisions to a coordinator for a named scope, within limits,
until an expiry or a stop condition (`state-machines/authority.yaml`). **Schema** `grant.schema.json` 2.1.0: `id`,
`granted_by`, `granted_to{role, agent, runtime}`, `granted_at`, `source`, `scope{objective,
repositories, epics, tasks, requirements, non_goals}`, `actions[]`, `limits{max_workers, budget,
stop_when}`, `expires_at`, `revocable: true`, `revoked_at/by/reason`, `narrowed[]` (structured:
`{at, by, remove_actions, remove_scope, reduce_limits, reason}`, at least one of the three). Actions:
`select-tasks`, `approve-plan`, `dispose-findings` (with a `policy`), `finalize`, `publish-review`,
and `merge{repo, target, protected_branch, strategy, requires}` where `requires` must include
`independent-review` and `required-checks`; only an orchestrator or the merge role may hold merge.
No grant is open-ended (`grant-is-bounded`): it names `expires_at` and `limits.budget`, or a
non-empty `limits.stop_when`, and then may omit both (2.1.0): a coordinator records only what the
human said, and an interactive runtime reports no spend, so such a grant is bounded by its stop
conditions and by revocation. A grant with neither an expiry nor a stop condition is invalid.
2.0.0 (breaking): `protected_branch` is required and `target` may not equal it
(`merge-target-not-protected`): a merge grant lands on an epic's integration branch at most, and
the protected branch is reached only by the merge role after a human's approval or by a human's
merge of the integration branch (workflow `land` is never grantable; `promote` is a human's). **Lifecycle (derived; no
status field).** A grant's state is read from the record, never stored in it: *where* it is (the
project's `.orchestrator/grants/GRANT-n.yaml`; it applies to that project only and is never moved or
deleted, so the audit trail stays), its *dates* (`pending` before `granted_at`, `live` until
`expires_at`, exclusive, then `expired`; a grant with no expiry stays live until a stop condition
holds, which only its coordinator can tell, or it is revoked), its *revocation* (`revoked` from `revoked_at`, with
`revoked_by` and `revocation_reason`; it wins over expiry), its *narrowing* (`narrowed[]`, append-only;
the issued fields never change, and the grant in force is the issue minus every entry; an entry
only removes what the grant holds, only lowers limits and the expiry and never empties a scope list,
`narrowing-only-narrows`; widening is a new grant), its *provenance* (a live grant is the file the
granting human committed under `.orchestrator/grants/`, a CODEOWNERS-protected path, `granted_by`
one of its owners; agents write only `.orchestrator/grants/drafts/`, which validate as grants but are
never live; `promptbook grant verify <file> --git` checks the owners, the last commit's author, the
issued fields against the issuing commit, append-only narrowing and a source commit, and reports
the lifecycle state, failing a grant that is not live), and its
*recorded uses* (every task record, run record and orchestrator
commit that names its id). A coordinator derives the state before each delegated action
(`authority.yaml` lifecycle.validity); `grantState()` and `effectiveGrant()` in `tools/lib/grant.mjs`, which the simulator and `grant verify` share, are the reference. A coordinator
may hold several grants (a work grant and a merge grant, revocable alone): each action is exercised
under the grant that delegates it, and the workers cap is the smallest `max_workers` among the live
grants that dispatch work, so a merge-only grant's `max_workers` bounds its merges, not the epic's
workers (`authority.yaml` lifecycle.limits, since 1.2.0). **Swap story.** Lets a
coordinator (stagehand, a CI orchestrator, a future agent) stand in for named human decisions with an
auditable, expiring record instead of a remembered chat line. **Compat.** stagehand records a
delegation as a project note, not a grant file; the parts of its note map onto a grant's fields
([adapters/herdr](adapters/herdr/README.md)), and a grant bounded only by its stop conditions
validates, so a runtime drafting one from the human's words records an expiry or a budget only
when the human states one.

### policy

**Purpose.** The operator's (L1) agent policy: autonomy tier per machine profile, what is never read
(`deny_read`), never done (`forbid`), asked about (`ask`), pre-approved (`allow`), network `egress`,
`sandbox`, and run `budgets`; compiled per engine. **Schema** `policy.schema.json` 1.4.0. Tiers:
read-only, ask, auto-edit, auto, autonomous, unattended (an unattended profile requires
`budgets.unattended`). `auto` (1.3.0) is a classifier-reviewed tier: routine actions run without
asking, the engine's classifier blocks or asks for risky ones, ask rules still prompt and walls hold;
it compiles to Claude's auto mode, and to the stricter auto-edit equivalent, with a warning, on an
engine with no classifier mode (Codex on-request, Gemini auto_edit). A profile may carry its own
`sandbox` and `egress`, merged key by key over the top-level ones (1.3.0). `sandbox.credentials`
(1.3.0) lists credential masks: a file (`path`, optional `extract`) or an environment variable
(`env`) that sandboxed commands may use without reading it, the real value reaching only
`inject_hosts`; a mask is not a wall (the file tools are not covered), and a path `deny_read` names
cannot also be masked (`credential-not-denied`). **Migration:** the dotfiles' top-level
`x-claude: { default_mode: { workstation: auto } }` (read by their `settings.json.tmpl` to put
Claude in auto mode while the profile said auto-edit) becomes `profiles.workstation.tier: auto`;
Codex compiles exactly as it did, so drop the `x-claude` key and the template's lookup.

A rule has exactly one matcher: `command` (argv prefix, with alternatives), `write` (path glob) or
`tool` (web-fetch with a domain, web-search, `mcp:server[:tool]`). A forbid's `command` may add
`flags_anywhere` (1.4.0): the words in order anywhere in the argv and one of the flags after them,
so `git push origin main --force`, `git -C . push -f` and `env git push -f` are denied
(`flags-anywhere-forbids-only`: never in an ask or allow, where it would widen a pre-approval).
`hooks.forbid_guard` (1.4.0) has the compile emit the engine-neutral guard
(`tools/guards/forbid-guard.mjs`) as a user-scope PreToolUse hook. A forbid is defense in depth on
every engine (a command rule matches the text an agent writes, never every way to run a program);
the project's hook deny and the sandbox are the wall. An `allow` or `ask` that a `forbid` covers is
a warning (it never takes effect).

A profile may name `requires`: preconditions the operator keeps outside the policy, each a named
probe of the host (`prod-unreachable-from-this-host` against `requires_config.prod_hosts` (1.4.0),
`non-root`, `container`, `non-root-container`, `sandbox-available`; an unknown name fails closed).
The bypass tier (autonomous) must name them (a validation warning, a compile error); `promptbook
check-requires` probes them, and the compiler passes them with `requires_config` to the launcher in
`runner.json`, with the run's `caps` and who enforces each (`engine`, `promptbook-run` or `none`).
`promptbook run` is that launcher: it refuses to start a run until the probes pass. An unattended
tier's caps are never waivable: on an engine that reports no cost the compile requires
`budgets.unattended.max_minutes` for a hard kill.

`roles` (1.4.0) names who runs headless (author, evaluator, reader, planner, merge, ...) and only
narrows the profile per role: its own `allow` (each one the profile's allow already grants,
`role-narrows`), its own `egress.allow_domains` (deny by default), `read_only` (every write allow
dropped and every write denied), and the `engines` that run it. When a policy names roles, every
unattended run is one of them: the unattended compile emits one file set per role under
`roles/<role>/` (an engine no role names is `role-engine`); an interactive or bypass tier, which has
no allowlist boundary, ignores them.

`accept_gaps` records the degradations the operator accepts; an entry's `profiles` (1.4.0) scopes
it, an entry without `profiles` covers every profile except a bypass-tier one, whose gaps are
accepted only by an entry that names it (`gap-profiles-exist` checks the names), and the first entry
that covers a profile wins. **Swap story.** One policy, three engines: the compiler emits Claude
settings, Codex config + execpolicy rules, Gemini settings + policy TOML; per-engine maps and gaps
are in `adapters/{claude,codex,gemini}/README.md`. **Fail closed:** an unrepresentable deny is a
compile error unless accepted with a reason (Claude's read and write denies without the sandbox are
a `sandbox` gap: they do not bind a script). An unrepresentable ask or allow is dropped with a
warning in an interactive tier; a Codex command allow, which runs outside the sandbox, is dropped
unless the `allow` gap is accepted, and an interpreter never emitted; unattended, an ask is a
denial, and one an engine cannot deny fails closed. The bypass tier also needs the policy's own
isolation (`sandbox.enabled`, `fail_if_unavailable`, `egress.default: deny`) or, where the host is
isolated another way, that field's gap accepted for that profile by name; its `requires` is never
waivable. Where its own sandbox is on, the compile also forbids an unsandboxed retry of a command
the sandbox blocked (Claude `sandbox.allowUnsandboxedCommands: false`), which bypass would otherwise
run without a prompt; that is decided from the profile's merged sandbox alone, never from another
profile's accepted gap.
**Compat.** The dotfiles' `settings.json.tmpl` is restated as the valid fixture.

### toolkit-lock

**Purpose.** Pins the exact promptbook, the portable skill libraries and the L4 packs a project (or the
dotfiles) runs. **Schema** `toolkit-lock.schema.json` 2.0.0: `lock_version`, `entries[]` of `{name,
layer (L3|L4), kind, source, path, ref, commit (full sha), tree (git tree id), version (semver,
build metadata allowed: `0.0.0+fc572b6` for an untagged pin, which names the pinned commit and moves with it), autoUpdate (off | patch | minor |
major), mirrored}`; names unique. `kind` at L3 is `promptbook` (exactly one; an L3 entry with no kind is
promptbook) or `skill-library` (any number, e.g. a Skilldex skill); at L4 `engine-binding`,
`stack-pack`, `runtime` or `domain-pack` (a kind on the other layer is a warning). A
`skill-library` entry may name the install `sets` the consumer copies (Skilldex's `planning`,
`delivery`, `personal`, …; `sets-on-skill-library`), so one pin of the whole library says what is
installed, and `promptbook lint --budget-set toolkit.lock` measures exactly those sets. The tree id
detects a rewritten tag or a force-pushed mirror. **Compat.** Replaces agentic-template's `.template-version` file and the
plugin `version` pin as the single source.

### governance

**Purpose.** A project's recorded trust profile: which changes land on the protected branch on
green required checks and the evaluator's verdict without a human's approval of the pull request
(workflow `auto-land`), and which always wait for one. One per project, `governance.yaml`, chosen by
a human (at bootstrap, say) and recorded in an ADR with its reversal trigger. Without one, nothing
lands without a human's approval, as before. **Schema** `governance.schema.json` 1.0.0: `trust`
(solo | team | regulated), `decision` (the ADR), `reversal_trigger`, `auto_land.max_risk` (none |
low | medium; absent, the profile's ceiling: solo medium, team low, regulated none; never high, and
never an irreversible task), `protected_paths` (globs; a change touching one waits for a human),
`ui_paths` and `visual_check` (a change to a UI path auto-lands only when that required check passed
on its head), `production{approvals, continuous}`, `signed_commits`, `attestations`. Rules:
`auto-land-within-profile` (team low at most, regulated none), `regulated-evidence` (two production
approvers, signed commits, build attestations), `continuous-deploy-solo-only`, and
`governance-protects-itself` (the file is one of its own protected paths, so an agent cannot widen
what lands without a human by editing it). **What no profile changes:** the spec is a human's
(`spec-approval`, never grantable); an agent never approves its own work or bypasses a required
check; agents never push to the default branch (the forge merges, and only the merge role records
`merged`); a release to production is a human's (one tap, two people when regulated; continuous
only where a solo project's human chose it). **Swap story.** The forge enforces it: a risk gate
computed from this file, the task's risk and the PR's changed paths is a required check, auto-merge
is armed where it passes, and code owners own the protected paths; any forge with required checks
and auto-merge can. **Compat.** New. heirloom's D-159 ("CI gates replace human PR approval") is
`trust: solo`.

### skill

**Purpose.** A portable procedure. **Schema** `skill.schema.json` 1.0.0: the agentskills.io core
fields only (read 2026-10-13): `name` (≤64, lowercase, single hyphens, equals its directory),
`description` (≤1024), `license`, `compatibility` (≤500), `metadata` (string map; promptbook reads
`metadata.version` (semver), `metadata.deprecated`, `metadata.layer`). `allowed-tools`, Claude
Code's extensions (`disable-model-invocation`, `context`, `hooks`, `paths`, `model`, …) and anything
else are rejected: engine extensions belong in adapters. Gerund names and "Use when … Do not use for
…" descriptions are lint rules (`promptbook lint`, TOOLS.md). The skills live in Skilldex; promptbook
holds none. **Compat.** agentic-template's skills add `origin:` and live in `.claude/skills/`,
which the L3 path deliberately does not match.

### evidence

**Purpose.** Why a skill is the way it is and whether it routes. **Schema** `evidence.schema.json`
1.3.0 with three shapes: `#/$defs/entry` for `evals/evidence.md` entries (`## YYYY-MM-DD · title`,
or `## YYYY-MM · title` when the source gives only a month; any other level-2 heading in the file is
an error, `entry-heading`, so no evidence is silently dropped; with `**Kind:**` measured | observed |
incident | audit | vendor-reported | literature, `**Source:**`, `**Claim:**`, optional result,
engine, model, skill_version, revisit; vendor-reported and literature must cite a URL, measured must
cite a source); `#/$defs/routingCase` for `evals/routing.jsonl` lines (and `evals/heldout.routing.jsonl`, cases
written after tuning and never used to change a description: `prompt`, `expect` trigger |
no-trigger, `kind` positive | near-miss | negative, `route_to`); and `#/$defs/routingResult` for the
lines `promptbook eval-routing --out` writes (`routing-results*.jsonl`: `skill`, `case` `<skill>:<line>` of the
cases file the run read, `prompt`, `expect`, `kind`, `route_to`, `model`, `runs`, `answers[]` per
run, `passes`, `pass` — pass^k, every run — `errors`, `at`, `skill_version`; counts must agree), the measured source an
evidence entry cites. The eval files validate wherever a skills folder is, dot-folder or not
(Skilldex's `skills/`, a project's `.agents/skills/` or `.claude/skills/`, a user's `~/.agents/skills/`):
unlike `SKILL.md`, whose L3 contract an engine's own skill folder may extend, the eval shapes are
the same everywhere; `*.evidence.md` and `*.routing.jsonl` name the contract outside one (1.3.0).
**Compat.** agentic-template keeps both in one `evals.md` (a routing table and an Evidence list);
`promptbook import-evals` converts one, marking what a human must still decide (TOOLS.md).

### agent-setup-review

**Purpose.** The record an agent-setup review leaves (after a model release, or quarterly): what was
reviewed with which suite, the baseline, one ablation per component and the decision each supports.
**Schema** `agent-setup-review.schema.json` 2.0.0 (the record's new name: a breaking change), read from the reviewing-agent-setup skill's Markdown as
written: the title `# Agent-setup review — YYYY-MM-DD — <model or quarter>` gives `date` and `label`; the
header bullets `**Trigger:**`, `**Reviewed:**`, `**Suite:**`, `**Trials:**` (required), `**Spend cap /
spent:**` and `**Noise …:**` give `trigger`, `reviewed`, `suite`, `trials`, `spend`, `noise`; the
level-2 sections must include Baseline, Ablations, Decisions and Playbook (`review-has-sections`);
each Ablations row names its component and a decision; Decisions bullets (`- Removed: …`) become
`decisions[]`. **Compat.** New.

### reflection-report

**Purpose.** What one reflection proposes from a window of runs, verdicts and reviews: deltas, each
one operation on one item in one file, never a wholesale rewrite. **Schema**
`reflection-report.schema.json` 1.0.0 (frontmatter): `window{from,to}`, `inputs{run_records,
verdicts, reviews}`, `deltas[]` of `{target, op (add | modify | remove), anchor, before, after, class,
evidence[] (≥1), recurrence, eval, risk, status (proposed | accepted | rejected), reason, pr}`. Rules:
add carries `after`, modify `before` and `after`, remove `before` (`delta-op-has-text`); a rejected
delta says why. **Compat.** New.

---

## Normalization (how existing Markdown maps to the schemas)

Implemented in `tools/lib/parsers.mjs`; every parser keeps file line numbers for errors.

- **Journeys** (`cuj.md`). Each `## CUJ-n · title` heading (also `—`, `-`, `:`) starts an entry. Each
  top-level `- **Label:** value` bullet is a field; labels are lowercased with parentheticals
  dropped, so `**Success (observable):**` → `success`. `**Steps:**` takes its numbered sub-items.
  `**Personas:**` is a comma list; `**User-facing:**` yes/no becomes a boolean. Unknown labels go to
  `extra`. `epic` comes from the folder. An entry whose title or actor is still a template token is a
  stub: a warning, not validated.
- **Requirements** (`spec.md`). Under `## Requirements` (including its `###` subsections), every GFM
  table with an id column (`#`, `ID`) and a requirement column is read; columns map by header (`Module`
  → module, `Verified by`/`Test` → verified_by, `Category`, `Measure`/`Target`, `CUJ`, `ADR`), other
  columns go to `extra`. Ids: `R<n>` → `REQ-<n>` (kept in `source_id`), `REQ-n`, `NFR-n`; an NFR row
  is non-functional. Rows whose statement is a placeholder (`…`, `<…>`) are skipped; a duplicate id
  after normalization is an error. A section with no real row is an error (`no-entries`) from
  `draft` on, and a warning while the epic is `intake` or `scoping` (a stub spec).
- **Decisions** (`DECISIONS.md`). Each `## ADR-NNNN: title` starts an entry; each line starting
  `**Label:**` starts a field that runs to the next such line (multi-line values and inner bold text
  are kept). `status` is the first word of the Status line; ADR ids after "superseded" in it become
  `superseded_by` ("superseded in part by" counts), after "refined" `refined_by`. In
  `**Supersedes:**`, clauses opening with "extends", "confirms", "refines", "fills" name related ADRs,
  not superseded ones. Template tokens (`TODO(domain)`) are recorded in `placeholders` and reported as
  warnings.
- **Personas, UX flows, evidence** use the same `## <ID> · title` + `- **Label:**` shape; UX
  `**States:**` takes `- **Empty:**`-style sub-bullets; a flow inherits `prototype` from the file's
  frontmatter.
- **Tasks** are frontmatter; criteria are bullets under `## Acceptance criteria` starting `AC-n`
  (legacy `AC1` is accepted with a warning), exactly as `ears-coverage.mjs` reads them.

## Trace graph

```mermaid
flowchart LR
  BRIEF["BRIEF<br/>docs/product/brief.md"] --> PER["PER-n<br/>personas"]
  PER --> CUJ["CUJ-n<br/>specs/{epic}/cuj.md"]
  CUJ --> REQ["REQ-n / NFR-n<br/>spec.md Requirements"]
  CUJ -- "user-facing" --> UX["UX-n<br/>docs/ux/{epic}.md"]
  UX -. cites .-> REQ
  REQ --> TASK["TASK<br/>tasks/{ID}.md<br/>requirements: [...]"]
  CUJ --> TASK
  TASK --> AC["AC-n<br/>Acceptance criteria"]
  AC --> TEST["test name<br/>contains AC-n"]
  ADR["ADR-nnnn<br/>DECISIONS.md"] <-->|"satisfies / ADR column"| REQ
  TASK -. guiding_docs .-> ADR
```

`validate.mjs --trace <root>` loads the project, validates every artifact it reads, and checks:

| Rule | Checks | Severity |
|---|---|---|
| `artifact-valid` | every artifact it read passes its contract | error |
| `*-exists` (persona, journey, requirement, decision, task, guiding-doc) | every id or path cited resolves | error |
| `dependencies-acyclic` | `depends_on` has no cycle | error |
| `criterion-named-in-test` | a task in review or later has every AC id in a test name (`--tests` globs; default the ears-coverage globs plus Go, Python, JUnit/Kotlin, Rust and Ruby test files): a name that carries a task id counts for that task only; a bare `AC-n` counts only when one task of the epic has that id | error, blocks readiness |
| `ambiguous-criterion-id` | a test name carries a bare `AC-n` that several tasks of the epic share: it counts for none of them; the warning names them | warning |
| `task-cites-requirement` | every task cites ≥1 REQ/NFR (`requirements:`); an id named only in prose is a warning with the fix | see below |
| `journey-has-task`, `requirement-has-task` | no orphan journey or requirement | see below |
| `journey-has-requirement` | each journey is served by a requirement (CUJ column, or a task that cites both) | see below |
| `journey-cites-persona`, `user-facing-journey-has-ux` | full adoption only | see below |
| `overlapping-tasks-ordered` | two open tasks whose `touches` overlap are ordered by `depends_on` (one lane, one writer) | see below; blocks readiness |
| `skeleton-is-root` | the walking skeleton (`x-skeleton: true`, `x-tags: [skeleton]`, or titled "Walking skeleton"), when there is one, depends on nothing in its epic and every other task depends on it | see below; blocks readiness |
| `one-way-door-decided` | no ADR the epic cites (header, ADR column, `satisfies`, a task's guiding doc) is a one-way door still proposed | see below; blocks readiness |
| `ready-task-unblocked` | a `ready` task has no unchecked Open question that says it blocks | error (warning in legacy adoption); blocks readiness |
| `task-size-fits` | no task is `XL`: an error from `ready` on, a warning before | see below |
| `tests-exist` | some test file matches; an explicit `--tests` glob that matches nothing, or no test file while a task is at review or later, is an error (and that task's criteria are uncovered) | warning; error, blocks readiness |
| `persona-has-journey`, `persona-in-brief`, `nfr-has-decision`, `task-index-agrees`, `cites-current-decision`, `decision-link-agrees` | consistency | warning |
| `task-mode-overrides-epic` | a task's `mode` differs from its epic's | info |

**Severity policy.** A broken reference or an invalid artifact is always an error. A *missing* link
is an error only when the artifact claims readiness — the epic is approved, in-progress or done, or
the task is ready or later — and a warning before that (the to-do list for the spec gate).
**Adoption:** a project with `docs/product/brief.md` is in *full* adoption and every rule applies.
Without it the project is in *legacy* adoption (an agentic-template project from before the product
layer): the product-layer rules are skipped (reported once as `info`), and every link promptbook
introduced — persona links, task → requirement, requirement → journey, UX, ADR `satisfies` — is a
warning even on an approved epic, so adopting promptbook never turns a green build red. Gaps that
keep an epic from `ready` are marked `blocks_readiness` in either mode. With no test files at all,
criterion coverage is a single `tests-exist` warning while no task claims to be tested; once a task is
at review or later it is an error and each of that task's criteria is uncovered, so a merged task
with no test never reads ready.
`--strict` makes warnings fail; `--readiness <dir>` writes each epic's `readiness.md`
(`--no-timestamp`: without `generated_at` and `source_commit`).

**Test names.** A file's extension picks how its test names are read: JS/TS the first string of
`it`/`test`/`describe` (ears-coverage's extractor); Go `t.Run("…")` and `func TestXxx`; Python
`def test_…`, pytest `ids=[…]` and the `id="…"` of a `pytest.param(…)`; JUnit 5 `@DisplayName("…")`;
Kotlin backticked function names; Rust the names of `fn`s under a test attribute (`#[test]`,
`#[tokio::test]`, `#[rstest]`, `#[test_case(…)]`), never a helper `fn` or an `#[ignore]`d one; Ruby
`it`/`describe`/`context`/`specify`/`test "…"`. A test that never runs evidences nothing: comments are
blanked first (strings kept), and JS/TS `it.skip`, `test.todo`, `describe.skip` (with the tests it
holds), their `.each`, `xit`/`xtest`/`xdescribe` and a `{ skip: … }` or `{ todo: … }` option are
dropped, as are Ruby's `xit` family. `--test-pattern <regex>` (repeatable) adds a reader for anything
else (group 1, or the match, is a name), read from the same comment-blanked text. An id matches in any case with a hyphen, an underscore or nothing between prefix and number
(`AC-2`, `ac_2`, `AC2`, `bill_7_ac_2`), or in CamelCase after a lower-case letter or digit
(`TestBILL7AC2`), never inside a longer id (`AC-21`, `FAC2`).

**Which task a name evidences.** A name that carries a task id (`INV-1 AC-2 returns 404`,
`test_inv_1_ac_2`) is qualified and counts for the tasks it names, never another. A name with a bare
`AC-n` counts for the one task of its epic that has an `AC-n`; when several do, it is ambiguous and
counts for none of them (`ambiguous-criterion-id`), so coverage can no longer read complete while a
task's own criterion is untested. Ids are matched per name, not per enclosing `describe`: a bare
`it('AC-2 …')` inside `describe('INV-1 …')` is bare. The epic's coverage ratio counts covered
criteria, and `--json` lists each criterion's evidence (`epics[].criteria_evidence`: qualified,
bare, ambiguous or none). A bare id unique in its epic still counts when another epic has the same
id, so a project with several epics should qualify every name.

On `wt-stack-drift` (two epics, no product docs, no tests) the check reports legacy adoption, 31
warnings and 7 errors: rating-engine's BILL-1 (merged) and BILL-2 (human-review) have no test file
naming their six criteria (`tests-exist`, `criterion-named-in-test`). The warnings are tasks that
cite no requirement (with the exact `requirements: [REQ-2]` fix where one is named in prose), requirements no task implements, journeys no requirement serves, and
CUJ-2 of template-migration, which the spec's Tasks table attributes to TMIG-1 and TMIG-3 while their
`cuj:` frontmatter does not.

## Runtime flow

```mermaid
sequenceDiagram
  autonumber
  participant H as Human (owner / engineer)
  participant D as git: default branch
  participant B as git: task branch
  participant F as forge (PR)
  participant C as Coordinator (loop / CI / stagehand)
  participant A as Agent (engine)
  participant R as Runtime records
  H->>D: approve spec (gate 1) — tasks become ready on the default branch
  C->>D: fetch task files; ls-remote: a task with no branch is unclaimed
  A->>B: claim: the branch's first commit, owner + ready→in-progress, pushed as a new ref (CAS)
  C->>R: task-record (attention working), grant if delegated
  C->>A: dispatch: task file + guiding_docs, budget
  A-->>R: signals (Herdr state, A2A/MCP task state) — attention only
  A->>B: commits, agent-log handoff, status → review; draft PR
  A-->>C: return (summary, artifacts, criteria met/unmet, decisions needed)
  C->>R: run-record line (outcome, subtype, cost), task-record reconciled
  alt criteria met and gates green
    F-->>R: reviewer's review and evaluator's verdict, each bound to the head
    A->>B: status → human-review
    Note over F,D: trust profile permits it (governance.yaml): the risk gate passes, the forge auto-merges, and the merge role records auto-land → merged; no approval
    H->>F: approve PR (gate 2): a forge review of the head, not a commit; or a merge grant's holder, for an integration branch
    C->>R: the approval in reviews/decisions
    C->>D: merge role lands; the merge carries status → merged on the protected branch
    Note over C,D: lands_to integration/epic: the merge writes integrated there; a human's merge of that branch, then promote → merged
    H->>F: approve production release (gate 3)
  else needs-human
    C->>H: next_action (question, permission, budget)
  end
```

The three human gates and every transition are in `state-machines/workflow.yaml`; which signal
means what is `state-machines/attention.yaml`; what a human may delegate is
`state-machines/authority.yaml`. The invariant that ties them: **status is a commit by an authorized
role on the branch where it lives (or, for approve-pr, a forge event); a runtime signal is a hint
that changes attention at most.** Where it lives is `workflow.yaml` `status_authority` (workflow
1.6.0): a claim creates the task branch (the rejected new-ref push is the compare-and-swap);
in-flight status is on the task branch; approvals are forge events bound to the head, voided by any
commit after them; only the landing actor writes `merged` or `integrated`, on the target;
`deps-merged` reads the dependent's own target.

Landing (workflow since 1.2.0, authority since 1.1.0). `land` (→ `merged`, the protected branch) is the
merge role's alone, after a human's approval (never grantable since workflow 1.4.0). `auto-land`
(`human-review` → `merged`, since 1.6.0) is the merge role's too, with no approval at all, where the
project's recorded trust profile permits it: its guards are `trust-permits` (the profile's ceiling
covers the task's risk, and the task is not irreversible), `checks-green`,
`independent-verification`, `no-protected-path`, `visual-checked`, `lands-on-protected`,
`mechanical-only` and `merged-checks-green`; it is never grantable and never a coordinator's. `integrate` (→
`integrated`) and `return-to-human` are the merge role's, or the orchestrator's under a live
`merge` grant whose repo, strategy and exact target match — the target being the task's `lands_to`,
an integration branch, never the protected branch (a runtime with no separate merge role). `promote` (`integrated` → `merged`) is a human's, after the
human merged the integration branch (tier 3; never grantable). `reopen` and `respec` take an
integrated task back with a reason when a later integration breaks it. `deps-merged` counts an
`integrated` dependency only for a dependent in the same epic. `mark-pr-ready` carries
`independent-verification`: every task needs the evaluator's passing verdict on the current head
(workflow since 1.3.0; risk sets its trials and model family). `independent-review` is the reviewer role's
pass on the current head, required where a merge grant approves; the two are separate records
(`task-record.reviews[].role`) and neither counts as the other. The simulator enforces all of it
(TOOLS.md).

## Compatibility summary

| Source | Contract | Result |
|---|---|---|
| agentic-template `specs/rating-engine/tasks/*.md` (4) and wt-stack-drift `specs/template-migration/tasks/*.md` (6) | task | all 10 validate unchanged |
| both epics' `spec.md` and `cuj.md` | epic, requirement, journey | validate unchanged (12 `R<n>` rows normalized) |
| `DECISIONS.md` (18 ADRs) | decision | validates; ADR-0001's `TODO(domain)` date is a warning |
| `scripts/loop.mjs` run lines (the dontAsk loop's on `fix/agent-run-caps`, and with `usage` on `integration/agent-hardening`) | run-record | validate unchanged |
| stagehand `assets/task-record.yaml` (`main` 48aff9a; `feat/promptbook-contracts` 5e5336f), filled as the coordinator fills it | task-record | validates as it is, its unnamed evidence included; a test checks the fill covers every key of the template |
| stagehand's project note (a delegation) | grant | not a grant file; its parts map onto a grant's fields ([adapters/herdr](adapters/herdr/README.md)) |
| Skilldex skills (feat/suite-skill-library) | skill, evidence | `promptbook lint <skilldex>/skills` checks each skill, its evals and each install set |
| Herdr `AgentStatus`, A2A 1.0 `TaskState`, MCP Tasks `TaskStatus`, Claude result subtypes, GitHub check runs | attention.yaml | every value mapped; none to a workflow status |
| agentskills.io frontmatter | skill | core fields only; engine extensions rejected |
