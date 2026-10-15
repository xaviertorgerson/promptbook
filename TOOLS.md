# Tools

Node 22, ESM, no dependencies beyond the validator's (`ajv`, `ajv-formats`, `yaml`). Every tool is
one script under `tools/` with its library under `tools/lib/`, prints its own usage with `--help`,
and exits 0 on success, 1 when a check fails, 2 on a usage error. `pnpm test` (`node --test "tests/**/*.test.mjs"`)
runs them all; Node 22 does not accept a bare directory there.

```
promptbook <command> [args]       # package.json bin: tools/cli.mjs; or pnpm <command> / node tools/<tool>.mjs
  validate        artifacts against their contracts                 tools/validate.mjs
  trace           the trace graph of a project (validate --trace)   tools/validate.mjs --trace
  lint            skills (a Skilldex checkout) against the rules    tools/lint-skills.mjs
  simulate        the runtime contracts under faults                tools/simulate.mjs
  compile-policy  agent-policy.yaml into one engine's settings      tools/compile-policy.mjs
  run             an engine under its runner.json and its caps      tools/run.mjs
  check-requires  probe this host for a profile's requires          tools/check-requires.mjs
  lock            pin or verify toolkit.lock                        tools/lock.mjs
  grant           verify a grant before acting under it             tools/grant.mjs
  eval-routing    routing evals through a model command             tools/eval-routing.mjs
  import-evals    an agentic-template evals.md into the eval files  tools/import-evals.mjs
  report          run records: cost, tokens, cache hit per task     tools/report.mjs
```

## validate, trace

The contract validator and the trace graph; see [CONTRACTS.md](CONTRACTS.md). A file's contract comes
from its path in the project layout, else from its name's suffix (`*.grant.yaml`, `*.task.md`, …;
`*.template.*` and `_`-prefixed templates such as `docs/ux/_UX-TEMPLATE.md` are skipped unless
`--contract` names one), so `promptbook validate <skilldex>/skills` checks every renamed example too.
`promptbook trace <root>`
is `validate --trace <root>`; `--readiness <dir>` writes each epic's report with the root's `HEAD` as
`source_commit`, and `--no-timestamp` leaves it and `generated_at` out for a report committed with
the plan; `--readiness <dir> --check` writes nothing and fails (exit 1) when a committed report is
missing, stale against the plan, timestamped, or names no epic, printing the first differing line
and the command that regenerates it (CI runs it so "never hand-edited" holds); `--tests <glob>`
picks the test files (an explicit glob that matches nothing is an error), `--test-pattern <regex>` adds a
way to read test names beyond the built-in JS/TS, Go, Python, JUnit/Kotlin, Rust and Ruby readers
(fixtures: `fixtures/test-names/`). A commented-out, skipped or todo test, and a Rust `fn` with no
test attribute, name nothing (CONTRACTS.md, Test names).

## lint

`promptbook lint [dir]...` checks a folder of skills, or one skill, against the authoring rules. The
skills live in Skilldex: `promptbook lint <skilldex>/skills`, or `promptbook lint` from a Skilldex
checkout (the default folder is `./skills`). Errors name a stable rule; `--strict` fails on warnings
too. Errors are the Agent Skills spec's hard limits (the frontmatter, the name, a description of at
most 1,024 characters), what breaks an installed skill (a link out of its folder, a malformed eval
file, a route to no skill) and engine neutrality. promptbook's authoring style is advice: the rules
marked *style* below are warnings unless the skill's own library asks for them in its `SETS.yaml`,
`lint: { strict: [rule...], skills: [name...] }` (`skills` absent: every skill of the library), so a
library can hold the skills it maintains to the full bar while another maintainer's skills beside
them keep their own style. `evals-present` accepts one `evals/evals.md` (a test plan in prose)
unless it is strict, when it wants `routing.jsonl`, `scenarios.md` and `evidence.md`. `--sets <file>` names the `SETS.yaml` of the library the linted skills install beside (a
project's own skills beside Skilldex's): its sets are checked, a `--budget-set` name is read from it,
and its skills are names a near-miss may route to.

| Rule | Checks |
|---|---|
| the skill contract (`agentskills-core-fields-only`, `name-matches-path`, …) | frontmatter via the validator |
| `name-is-gerund` (style) | the first word ends in -ing: `writing-requirements` |
| `description-use-when`, `description-do-not-use-for` (style) | a "Use when …" trigger and a "Do not use …" clause ("Do not use for …", "Do not use merely to …"); warnings if out of order or naming no neighbour |
| `description-length` (style) | a description over 400 characters is the style rule (an error when strict), over 300 always a warning: every description stays loaded in every session; over 1,024 is the skill contract's error |
| `description-budget` (warning) | the scanned set's descriptions together exceed 8000 characters (one engine keeps skill metadata within 2% of context or 8000 characters); the longest are named. The budget binds what a machine installs, not one library: `--budget-set <file>` sums the descriptions of an installed set (a list of skill folders or folders of skills, one per line or a YAML list; or a `toolkit.lock`, whose local entries contribute the skills under `source/path` (or `source/skills/`), narrowed to the install `sets` an entry names (read from the library's `SETS.yaml`; an unknown set fails `budget-set-sets`) and by an `x-skills` list; a remote entry is reported as `budget-set-unread`, a listed folder that is missing fails `budget-set-missing`) and warns over 8000 with the count from each source; `--budget-set <set>` names a set of a `SETS.yaml` instead (`--sets`, else the linted library's, else `./SETS.yaml` or `./skills/SETS.yaml`, as in a Skilldex checkout) and checks what a session holding it loads; with no folder given only this check runs |
| `sets-shape`, `sets-known`, `sets-disjoint`, `sets-cover`, `set-over-budget`, `set-not-installed` (warning) | a skill library's `SETS.yaml` (Skilldex's), in its skills folder or at the root above it, or the one `--sets` names, names install sets: each a scope (`user`, `project`, or `library`, never installed), its own `skills` and/or the sets it `includes`, and what a session `loaded_with` it (another set, or an `external` pack measured at a pinned commit; `--external name=<dir>` reads the real descriptions). Every named skill and set exists; every skill is in exactly one set's own list and some installable set; a user or project set, with what loads beside it, stays within `budget.limit` less `budget.headroom` (8,000 less 10%); `--budget-set` on a library set warns; a `lint` block names only rules lint can make strict and skills the library holds. The sets line prints each total |
| `deprecated-description` (style) | a skill with `metadata.deprecated` is exempt from "Use when": its description starts with "Deprecated:" and names the replacement skill |
| `parse-error` | the frontmatter is YAML; when a plain value holds ": " (the usual cause), the error says to quote it |
| `body-length` (style) | warn over 200 body lines; over 300 is the style rule |
| `engine-neutral` | no engine, runtime, forge or stack name in the description or body; `references/engine-notes.md` is exempt. The deny-list (Claude Code, Claude, Codex, Gemini, Antigravity, Herdr, Heeler, stagehand, OpenAI, Anthropic, Copilot, GitHub, GitLab, Forgejo, Cloudflare, Coolify, Hetzner, Angular, NestJS, Drizzle, pnpm) is replaced with `--deny-terms`, narrowed with `--allow-terms`; URLs are ignored, and so is a term of art that holds a listed word but names a practice (Claude Search Optimization) |
| `links-stay-in-skill` | no relative link leaves the skill folder (a skill installs alone) |
| `evals-present`, `routing-counts` (style), `routing-kind-declared` (style) | evals, as one `evals/evals.md` or (strict) as `routing.jsonl` with ≥ 4 positive, ≥ 3 near-miss with `route_to`, ≥ 2 negative, each case in the evidence contract's format |
| `route-to-known`, `route-to-self` | a `route_to` names a scanned skill, a sibling of a linted skill, a skill that loads beside it (one of the `--sets` library, an `external` of the library's or the `--sets` `SETS.yaml`), `--known`, or `none` |
| `scenarios-count`, `scenario-format` (style), `scenario-stop-condition` | ≥ 3 scenarios in `scenarios.md`, each with setup, prompt, pass criteria and k; one should hand to a human |
| `evidence-count` (style) and the evidence contract's rules | ≥ 1 dated entry; literature and vendor-reported cite a URL |
| `imported-needs-review` | nothing `import-evals` could not fill is left: a routing case noted `needs route_to`, a scenario line marked `TODO(import)` |
| `deprecated-never-triggers` (style) | a skill with `metadata.deprecated` keeps only no-trigger cases |
| `description-overlap` (warning) | two descriptions' trigger phrases (the "Use when" clause, stop words removed) share more than 0.3 Jaccard; the pair and the shared words are named. agentic-template's 19 skills peak at 0.17 |

Fixtures: `fixtures/lint/good/` (a library in Skilldex's layout: four skills under `skills/`, one
deprecated, and a `SETS.yaml` at the root that holds them strict) and one overlay per broken rule in
`fixtures/lint/broken/<rule>/`, each linted outside the library: a style rule's overlay is a warning
there and an error when strict.

## simulate

`promptbook simulate <scenario.yaml>` or `promptbook simulate --project <root>` runs a seeded,
deterministic discrete-event model of the runtime contracts and checks 20 invariants after every
event. The world: a supervisor policy (the reference coordinator: the protocol `state-machines/` describes, as code; stagehand's coordinator is tested with `--supervisor`), author and
evaluator sessions with read-only helpers, CI, a reviewer that reviews every pushed head (pass or
changes-requested, `reviewer.reject_rate`), a merge queue that classifies conflicts and re-runs
checks on the merged result (for the branches it serves), the orchestrator's own merge under a
merge grant for a branch no queue serves, a scripted human with latencies who also merges an
integration branch into the target once nothing on it is in flight (`promote`), a forge of remote
refs that each hold their own copy of the task files (`workflow.yaml` `status_authority`): a claim
creates the task's branch as a new ref (rejected when it exists: the compare-and-swap), in-flight
status is committed on it (compare-and-swap per ref), the default branch's copy says `ready` until
the task lands, approve-pr is a forge event bound to the PR head and the branch's version (a commit
after it voids it), landing writes `merged` or `integrated` on the target inside the merge, and the
targets (the protected branch and each epic's integration branch) admit a merge only with a valid
approval of the head, a platform that, where the scenario records a trust profile (`governance`),
computes the risk gate from it, the task's risk and the PR's changed paths, runs the visual check on
a screen change, and auto-merges what the gate passes (the merge role records `auto-land`, with no
approval) while the human reviews the rest, and a runtime whose
signals (working, blocked, done, idle, unknown) are lossy and duplicable, with events-lost notices.

A scenario names tasks (`depends_on`, `touches`, `size`, `risk`, `criteria`, `budget`, `lands_to`,
`branch`: default `task/<id>`),
the policy tier and its `forbid`/`ask`/`budgets`, its grants (`grant`, or `grants` for several,
e.g. a work grant and a separate merge grant; each validated against the grant contract), the
project's trust profile (`governance`, validated against the governance contract; `checks.visual_change_rate`
is how often the visual check finds changed screens), the
supervisor's caps, the evaluator's and the reviewer's latency and reject rate, the merge queue's
`queue_targets` (default every branch), the human's behaviour (`on_integration: merge|hold`), and faults: `concurrent_claims` (a rival runtime),
`crash`, `lost_events`, `duplicate_wakes`, `unknown_signals`, `no_progress`, `budget_exhaustion`,
`semantic_conflict`, `evaluator_rejection`, `grant_expiry`, `merge_without_grant`, `ask`, `wall`,
`question` (`grant_expiry.grant` names the one grant to expire; default every one). Unknown keys
are errors. With several grants, each delegated action is exercised under the live grant that
delegates it (merge authority comes from a merge grant only); the workers cap is the smallest
`max_workers` among the live grants that dispatch work (`select-tasks`, `approve-plan`,
`dispose-findings`, `finalize`), so a merge-only grant caps nothing it does not run; the runtime
budget defaults to the tightest such grant's budget. `--project` reads `specs/<epic>/tasks/*.md` with the
validator's loaders (`--config` adds actors and faults; `assume_approved: true` stands in for the
spec gate).

| Invariant | Holds that |
|---|---|
| `one-owner-per-claimed-task` | a claimed task has one owner, from the claim that created its branch on the remote (the new-ref compare-and-swap); a claim anywhere else is a violation; one author session holds it; only the owner commits |
| `approval-bound-to-head` | approve-pr is a forge event bound to the PR head and the task branch's version, never a commit; nothing lands on an approval a later commit voided |
| `status-where-it-lives` | in-flight status is committed on the task branch while it exists; `merged` and `integrated` only on the target, by the landing actor; no agent but the merge role writes the protected branch |
| `transitions-allowed` | every status change is a `workflow.yaml` transition from its from-state by a listed role, or the orchestrator under a live grant of its `grant`; reasons where needed; humans are humans |
| `guards-hold` | the transition's guards hold on the evidence (deps merged, an integrated dependency counting only in the same epic; checks green, criteria met and named in tests, independent review (the reviewer role's pass on the current head), independent verification (the evaluator role's pass on the current head, every task), lands on the protected or the integration branch as `lands_to` says, mechanical-only, merged checks green, integration landed, question answered; auto-land's trust-permits, no-protected-path and visual-checked, recomputed from the recorded profile, never read from the platform's gate); a grant adds its grant guards |
| `human-gates-by-humans` | gates are passed by a human approver, or by the orchestrator under a live grant where the gate is grantable |
| `signals-never-advance-workflow` | a commit decided on a runtime signal is one the evidence and authority justify on their own |
| `attention-consistent` | records carry attention only; needs-human names the next action; complete only when the human has nothing left |
| `merge-requires-authority` | a change lands on a branch only by the merge role, a human, or the orchestrator under a merge grant live when it decided for that exact branch; an agent lands only with its `land`/`auto-land`/`integrate` commit and after checks on the merged result of that head; never without green checks and the evaluator's pass on the landed head; with an approval of that head by a human or such a grant, plus `authority.yaml`'s `always_requires`, or, with no approval, as the merge role's auto-land that the recorded trust profile permits; and never over a semantic conflict or red merged checks |
| `lanes-disjoint` | claimed tasks never have overlapping `touches` |
| `cap-workers`, `cap-depth`, `cap-run`, `cap-spend` | workers (authors, evaluators and the readers they start; the runtime refuses a reader when every slot is taken), delegation depth, per-run turns and spend, per-task and runtime budgets |
| `no-progress-stops` | after a stalled run or a ceiling, no rerun until a human decides |
| `merged-criteria-covered` | a merged task has a test naming every criterion on the landed head |
| `asks-surface-to-human` | only a human answers a prompt; unattended, an ask is a denial; every prompt and denial reaches the human as needs-human |
| `walls-block` | a forbidden command never runs, in any tier |
| `stalls-surface` | at quiescence every unfinished task is parked by a human or waits on a needs-human record |
| `contracts-valid` | every run-record, return, grant and task record produced validates |

Transition tables, roles, gates, guards, side states, the merge requirements and the claimed statuses
are read from `state-machines/*.yaml` and the task schema; a guard the simulator has no evidence
model for is an error, never a pass. `--break <mutation>` swaps in one of 26
deliberately broken supervisors (`--list` names them); the tests run each, plus ten broken world
bindings (bypass that skips walls, a forge without CAS, a merge queue that resolves semantic
conflicts, no branch protection, and a risk gate that ignores the task's risk, reads every profile
as solo (on team and on regulated), ignores protected paths, ignores screen changes, or arms
auto-merge on a draft before the verdict), and require the named invariant to catch it; with
`orchestrator-auto-lands` (the coordinator lands a green PR itself as if auto-land were its own:
`transitions-allowed`, `merge-requires-authority`) they show each auto-land guard is load-bearing. Among them:
`cross-epic-integrated` (a dependent in another epic treats an integrated dependency as merged:
`guards-hold`, deps-merged), `finalize-unverified` (a PR marked ready with no evaluator
verdict: `guards-hold`, independent-verification), `approve-over-reviewer` (the evaluator's pass
taken as the review while the reviewer requested changes on that head: `guards-hold`,
independent-review), and the three that put status in the wrong place: `claim-on-default` (a claim
committed to the default branch: `one-owner-per-claimed-task`, `status-where-it-lives`),
`terminal-on-task-branch` (`integrated` written on the task branch: `status-where-it-lives`) and
`land-on-stale-approval` (a fix pushed after the approval and landed on it, with the forge's
protection off: `approval-bound-to-head`, `merge-requires-authority`) and `land-without-grant` (the orchestrator lands a
change no merge grant of its covers: `transitions-allowed`, `merge-requires-authority`).

`--supervisor <module>` replaces the built-in supervisor with a runtime's own, so a binding is tested
against the same invariants: the module's default export is a factory `({ runtime, sc }) => ({ name,
onEvent(note, api) })`, the shape `orchestrating()` in `tools/lib/sim/policies.mjs` returns. On every
wake (`note`: `start`, `checkin`, `signal`, `ci`, `webhook`, `notice`) it reads `api.view()` (tasks
with their specs, PRs, its sessions and ended runs, decisions, prompts, grants and `grantHas`,
spend, records) and acts only through `api.dispatch(task, {mode, caps, claimable})`,
`api.evaluate(task, {caps})`, `api.commit(task, {transition, to, …})` (as the orchestrator, under its
grants), `api.record(task, {attention, summary, next_action, item, questions})`,
`api.consume(session)`, `api.merge(task)` and `api.answerPrompt(id, decision)` (which the invariants
catch: only a human answers). It cannot reach the forge or the human directly.

Output: `.sim-out/<scenario>-seed<n>.jsonl` (one event per line: time, actor, task, the commits it
applied, effects, violations), `.summary.json` (merged, parked, needs-human, spend, makespan,
throughput, violations with seed and event index), `.run-records.jsonl` (each line names its `role`;
an evaluator's run ends in `verdict`, never an author's `advanced`) and `.task-records.json` in
their contracts' shapes. A violation prints a `reproduce:` command. Scenarios:
`fixtures/scenarios/{happy-path, parallel-overlap, crash-lost-events, merge-without-grant,
budget-exhaustion, unattended-ask, evaluator-rejection, grant-expiry, wall-bypass,
integration-branch, trust-solo, trust-team, trust-regulated}.yaml`; the three `trust-*` scenarios
are one project per trust profile (solo: low and medium risk auto-land; team: low risk, and a screen
change when the visual check passes; regulated: nothing); `integration-branch` is tier 2 and 3: the orchestrator lands an epic's
tasks on `integration/<epic>` under its merge grant, a same-epic dependent builds on an integrated
task, a dependent in another epic waits for merged, and the human merges the branch to main.

## compile-policy

`promptbook compile-policy <agent-policy.yaml> --profile <p> --engine claude|codex|gemini [--out <dir>]`
validates the policy, then emits one profile's settings, following `adapters/<engine>/README.md`.
`--out` also writes `report.json`: the tier, every warning (an ask or allow dropped, a mode
degraded), every accepted gap as `{field, message, reason}` (what it degrades and the operator's
reason) and the notes for the launcher, the same file the goldens hold, so what a compile gave up is
on disk beside what it wrote, not only on stderr:

| Engine | Files |
|---|---|
| claude | `settings.json` (permissions allow/deny/ask, `defaultMode` per tier, `auto` for the auto tier, `sandbox` with `allowUnsandboxedCommands: false` under a bypass that relies on it and `credentials` masks with `network.tlsTerminate`), `runner.json` (unattended: `--permission-mode dontAsk --allowedTools … --max-turns --max-budget-usd`) |

Every `runner.json` carries `caps` (`max_turns`, `max_budget_usd`, `timeout_seconds`, null where the
tier's budget sets none) and `enforcement`, which says per cap who enforces it: `engine` (a flag or
setting the compile emits), `promptbook-run`, or `none` (said in a `spend-unmetered` warning). Codex and
Gemini report no cost, so an unattended profile on either needs `budgets.unattended.max_minutes` for
a hard kill; no `accept_gaps` entry waives an unattended cap.
| codex | `config.toml` (or `<profile>.config.toml` unattended: a `promptbook` permission profile, approval policy, network domains), `mcp-restrictions.toml` (MCP tool denies, to merge into the entries that define those servers: a server table without its transport does not load), `rules/promptbook.rules` (`prefix_rule` prompt / forbidden with justification and match examples; `allow` only where the profile accepts the `allow` gap, since an allow runs outside the sandbox, and never for an interpreter), `runner.json` |
| gemini | `settings.json` (`defaultApprovalMode`, `tools.sandbox`, `tools.allowed`, `model.maxSessionTurns`), `policies/promptbook.toml` (user-tier `[[rule]]` deny / ask_user / allow), `runner.json` |

When the policy names `roles`, an unattended compile writes one file set per role that runs on the
engine under `roles/<role>/` (each `runner.json` names its `role`; the guard hook below stays at the
top, shared), and `report.json` tags each warning and accepted gap with its role. A role only
narrows the profile (`role-narrows`); `read_only` drops write allows and denies writes. Settings are
machine-wide on every engine, so a role whose settings differ runs from its own config home
(`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, its container); on Claude everything a role narrows is also in
its runner's flags, since an unattended compile keeps the allowlist out of `settings.json`.

With `hooks.forbid_guard`, the Claude and Codex outputs also carry `hooks/forbid-guard.mjs` (a copy
of `tools/guards/forbid-guard.mjs`, Node builtins only) and `hooks/forbid.json` (the command forbids,
and unattended the command asks), registered as a `PreToolUse` hook for the shell tool (Claude in
`settings.json`, Codex in `hooks.json`). The guard splits the command as a shell would (compound
commands, substitutions, `sh -c`, wrappers, a program by path) and exits 2 on a match; it fails
closed on input it cannot read. A `flags_anywhere` forbid compiles to prefix and anywhere rules on
Claude and to its prefix form on Codex and Gemini, where the rest is the guard's (Codex) or a
`forbid` gap.

A profile's own `sandbox` and `egress` are merged key by key over the top-level ones before
compiling (the merged egress still needs a default, and a deny default its allow list:
`egress-effective`). Fail closed: a deny-side field an engine cannot represent is an error that
prints the `accept_gaps` stanza that would accept it (credential masks on Codex and Gemini are a
`sandbox` gap; the auto tier's WebFetch outside a deny egress list, left to Claude's classifier, an
`egress` gap); a tier an engine has no mode for compiles to its stricter equivalent with a `degraded`
warning; an unrepresentable ask or allow is dropped with a warning; on any error
nothing is written. Refused outright: the bypass tier (`autonomous`) without a `requires` list naming
its outside preconditions, or without `sandbox.enabled`, `sandbox.fail_if_unavailable` and
`egress.default: deny` unless the missing field's gap is accepted for that profile by name
(`accept_gaps` sandbox or egress with `profiles: [<it>]` and a reason; an entry without `profiles`
never covers a bypass-tier profile) (HAR-4); `requires` (with `requires_config`) goes into `runner.json` and the notes, for `promptbook run` and
`promptbook check-requires` to probe;
an unattended tier without turn and spend caps (HAR-3); any `x-` extension that disables hooks (HAR-2); an `examples` entry its rule does
not match. No output may carry `disableAllHooks`, `hooksConfig.enabled: false`, `disableYoloMode`,
`tools.exclude`, a full-access mode, or a bypass key outside the bypass tier: every compile checks
the parsed output's keys and mode values (never the text, so a forbid on `codex --yolo` compiles), and
a hit is a `walls-only` error like any other refusal; so is a Gemini `argsPattern` the Gemini loader
would drop as a potential ReDoS (`gemini-drops`). Unattended, an `ask` compiles to a denial,
never dropped: where an engine has no deny for it (a Codex write or tool ask), the compile fails until
the `ask` gap is accepted for the profile. `--diff <settings.json|settings.json.tmpl>`
compares the Claude output with a hand-written file.

Goldens: `fixtures/compile-policy/golden/expected/<engine>-<profile>/`, each with its `report.json`
(`UPDATE_GOLDEN=1` rewrites).
`fixtures/compile-policy/dotfiles/agent-policy.yaml` restates the user's Claude settings for the diff
test; stagehand's `herdr.rules` round-trips through the Codex compiler when the checkout is present.
`tests/codex-load.test.mjs` loads every committed and freshly compiled Codex config and rules file
in the real Codex CLI (`CODEX_BIN=<codex>`, or `codex` on `PATH`; skipped without one), as
adapters/codex/README.md describes; `tests/gemini-load.test.mjs` does the same for Gemini's
settings and policy files (`GEMINI_BIN=<gemini>`, or `gemini` on `PATH`), as adapters/gemini/README.md
describes.

## grant

`promptbook grant verify <grant.yaml>... [--git] [--owners a,b] [--identities <file>] [--root <dir>] [--at <time>]`
answers "may a coordinator act under this file?" (`state-machines/authority.yaml` lifecycle.issue):
the grant contract, schema and named checks; the grant is live now, or at `--at` (an ISO date-time),
and each line names its lifecycle state, `(live)`, `(pending)`, `(expired)` or `(revoked)`, read from
its dates and revocation (`grant-is-live` fails the other three; a grant bounded only by stop
conditions has no expiry, and whether one holds is the coordinator's to tell); the file is under `.orchestrator/grants/` and not a
draft under `drafts/` (`grant-on-protected-path`, `grant-is-draft`); `granted_by`, each
`narrowed[].by` and `revoked_by` are owners of that path, read from the project's CODEOWNERS (the
last matching rule, as the forges read it) or `--owners` (`granted-by-is-owner`,
`narrowed-by-owner`); `narrowed[]` only narrows (`narrowing-only-narrows`, also a validator check).
`--git` reads the file's history: its last commit is by `granted_by` (`committed-by-granter`; an
author matches a handle by name, email local part or the `--identities` map), every commit touching
it is by an owner, the issued fields equal the issuing commit's (`issued-fields-unchanged`),
`narrowed[]` was only appended to (`narrowing-append-only`), and a commit `source` names exists
(`source-resolves`). The grant in force (issued minus narrowing) is `effectiveGrant()` in
`tools/lib/grant.mjs`, which the simulator uses too.

## run

`promptbook run --runner <runner.json> [--report <file>] [--grace <s>] -- <engine command...>` launches
one engine command under the `runner.json` compile-policy wrote: it appends the runner's `args` and
enforces the caps marked `enforcement: promptbook-run`.

| Engine | `max_turns` | `max_budget_usd` | `timeout_seconds` |
|---|---|---|---|
| claude | engine (`--max-turns`); checked after the run against the result's `num_turns` | engine (`--max-budget-usd`, may overshoot by one response); checked after the run against `total_cost_usd` | promptbook run |
| codex | promptbook run: tool actions counted from `codex exec --json` (`--json` is in the runner's args) | **none**: Codex reports tokens, not cost (the run report records the tokens) | promptbook run |
| gemini | engine (`model.maxSessionTurns`; headless exit 53) | **none**: no cost reported | promptbook run |

The timeout is a hard kill: SIGTERM to the run's process group, SIGKILL `--grace` seconds later
(default 10). A run stopped at the timeout exits 124; one stopped at, or reporting a result past, a
cap exits 125; otherwise the engine's own exit code passes through. An unattended runner without
its caps, or without a timeout on an engine that meters no spend, is refused (exit 1), as is a file
compile-policy did not write. `--report` writes `{role, argv, caps, enforcement, exit_code, signal,
stopped_by, stopped_by_engine, turns, cost_usd, usage, duration_ms}`, the fields a run record needs.
A role's run takes its own `roles/<role>/runner.json`.

## check-requires

`promptbook check-requires --policy <agent-policy.yaml> --profile <p> [--json]` probes this host for
the profile's `requires`, by name: `prod-unreachable-from-this-host` (a TCP connect to every
`requires_config.prod_hosts` entry, `host[:port]`, 443 by default, must fail within
`requires_config.connect_timeout_ms`, 3000 by default; a host that does not resolve counts as
unreachable, so list addresses to probe the route rather than the resolver; no hosts listed fails),
`non-root` (uid not 0), `container` (`/.dockerenv`, `/run/.containerenv`, `$container`, or a
container cgroup in `/proc/1/cgroup`), `non-root-container` (both), `sandbox-available` (bubblewrap
runs on Linux, `sandbox-exec` on macOS). An unknown name fails closed, and so does a bypass-tier
profile that names none. Exit 0 when every probe passes, 1 when one fails. `promptbook run` runs the
same probes on the `requires` and `requires_config` in a `runner.json` and refuses to start the run
when one fails; compile-policy warns `requires-unknown` and `requires-unprobed` for a name with no
probe and for `prod-unreachable-from-this-host` without `prod_hosts`.

## lock

`promptbook lock [--lock toolkit.lock]` fills each entry's `commit`, `tree` (the git tree id of `path`)
and `version` (from a semver tag, else `package.json`/`plugin.json` in the path, else `0.0.0+<sha>`,
the pinned commit, which a moved pin rewrites; a version a human set by hand on an untagged source is
kept). Local sources are
read with git plumbing, no network; remote sources use `git ls-remote` and a depth-1 blob-less fetch
into `~/.cache/promptbook/lock`, and an unreachable remote fails with the reason (`--offline` skips
remotes with a warning). `--check` changes nothing and exits 1 on drift: a pinned commit that is
gone, a different tree, a moved tag, a branch rewritten past the pin, a version the tag or the manifest contradicts, a `0.0.0+<sha>` that
names another commit than the pin;
a branch that moved ahead is a warning. A CI checkout often has no local branch: a local source's ref
resolves as a tag, a branch, or `refs/remotes/origin/<ref>`, and when a detached or shallow checkout
holds none of them, `--check` verifies the pin by its recorded commit and tree ("ref not present;
verified by commit", warning `ref-absent`) instead of failing; a shallow clone that lacks the pinned
commit itself fails `commit-exists` with the fix (fetch the full history). `--update [name...]` moves pins within each entry's
`autoUpdate` (never to a prerelease), or a named entry to its newest tag. Comments survive, and so
does the file's flow style: a `sets: [planning, delivery]` stays compact, a padded `[ a, b ]` stays padded.

## eval-routing

`promptbook eval-routing [dir]...` is a dry run: it prints each skill's case count and the router
prompt, and sends nothing. `--runner "<cmd>"` sends each case's prompt on stdin to any command that
prints text (a cheap-model CLI), takes the skill names on its last line, and judges: a trigger case
needs its skill; a no-trigger case needs it absent and, for an installed `route_to`, the neighbour
named. The router sees only installed, non-deprecated skills' names and descriptions, as an engine's
loader would. It reports failures and per-skill precision and recall. `--runs <k>` asks k times per
case and passes a case only when all k pass (pass^k); `--model <label>` names the model; `--out
<routing-results….jsonl>` writes one result per case in the evidence contract's `routingResult`
shape, which `promptbook validate` checks and an evidence entry cites as its measured source. `--cases <file>` reads
each skill's cases from `evals/<file>` instead of `routing.jsonl` (the held-out cases are `heldout.routing.jsonl`);
`--set <name>` installs only that set of the library a `SETS.yaml` names (`--sets <file>`, else the one in or above a
given folder; other folders, a pinned pack, stay whole), so a set's routing is measured with what it actually loads.
Run it from a Skilldex checkout (the default folder is `./skills`) or name `<skilldex>/skills`. Ported from agentic-template's
`scripts/skill-evals.mjs`. Tests use `fixtures/eval-routing/fake-router.mjs`; no test calls a model.

## import-evals

`promptbook import-evals <evals.md> --out <skill>/evals [--skill <name>] [--rename old=new,...] [--k n]
[--force] [--dry-run]` converts an agentic-template `evals.md` (a "Trigger routing" table, "Scenarios"
with Fixture/Assertions, an "Evidence" list) into `routing.jsonl`, `scenarios.md` and `evidence.md`
in the evidence contract's shapes. A trigger row is a positive case; a no-trigger row that names a
skill is a near-miss routed to it (after `--rename`); any other no-trigger row is a negative case
with `note: "needs route_to: <what the source said>"`. Scenarios keep their fixture and assertions
and get a `TODO(import)` prompt (the source has none); evidence keeps its date (day or month) and
text, kind audit or observed, citing the source file. Lint fails both markers
(`imported-needs-review`) until a human resolves them. It refuses to overwrite without `--force`.
A skill a project ports into Skilldex is imported there: `--out <skilldex>/skills/<name>/evals`.
Fixtures: two real evals.md files under `fixtures/import-evals/`.

## report

`promptbook report [file|dir]... [--since <date>] [--json]` totals run records: what the runs cost
and why. A file is read as run-record JSONL; a directory is searched for the contract's paths
(`.agent/loop-runs.jsonl`, `.agent/runs/*.jsonl`, `*.run-record.jsonl`); no path means the current
directory, and a file reached twice is read once. Every line is validated against the run-record
contract first: an invalid line (bad JSON, a broken rule, a truncated last line) is skipped and
listed with its file, line and rule, never counted, and never stops the report. Per task (costliest
first, with the status its latest run left), per role (once any run names one; no role is the
author) and in total it prints runs, the outcomes that occur (advanced, stalled, needs-human,
failed, verdict, read), turns, cost, input and output tokens, the cache hit rate and denied calls,
then the three most expensive runs with their session ids and lines. Input is all input: uncached,
cache read and cache write; the hit rate is cache read ÷ input, over the runs that report `usage`
(the table says how many when not all do), and "—" when none do. A run with a null cost is marked
`*`: the total is a floor. `--since` keeps runs started at or after a date or ISO time; `--json`
prints the same summary as JSON. Exit 0 when every line was a valid run record, 1 when one was
skipped, 2 on a usage error. Fixtures under `fixtures/report/`: a loop's `.agent/loop-runs.jsonl`
with usage, a log from before usage with an evaluator's and a reader's runs, and a file with one
invalid line (a needs-human run with no reason, as the loop wrote one before it was fixed).
