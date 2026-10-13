# Tools

Node 22, ESM, no dependencies beyond the validator's (`ajv`, `ajv-formats`, `yaml`). Every tool is
one script under `tools/` with its library under `tools/lib/`, prints its own usage with `--help`,
and exits 0 on success, 1 when a check fails, 2 on a usage error. `pnpm test` (`node --test "tests/**/*.test.mjs"`)
runs them all; Node 22 does not accept a bare directory there.

```
harness <command> [args]          # package.json bin: tools/cli.mjs; or pnpm <command> / node tools/<tool>.mjs
  validate        artifacts against their contracts                 tools/validate.mjs
  trace           the trace graph of a project (validate --trace)   tools/validate.mjs --trace
  lint            skills against the authoring rules                tools/lint-skills.mjs
  simulate        the runtime contracts under faults                tools/simulate.mjs
  compile-policy  agent-policy.yaml into one engine's settings      tools/compile-policy.mjs
  lock            pin or verify toolkit.lock                        tools/lock.mjs
  eval-routing    routing evals through a model command             tools/eval-routing.mjs
  import-evals    an agentic-template evals.md into the eval files  tools/import-evals.mjs
```

## validate, trace

The contract validator and the trace graph; see [CONTRACTS.md](CONTRACTS.md). A file's contract comes
from its path in the project layout, else from its name's suffix (`*.grant.yaml`, `*.task.md`, …;
`*.template.*` and `_`-prefixed templates such as `docs/ux/_UX-TEMPLATE.md` are skipped unless
`--contract` names one), so `harness validate skills` checks every renamed example too.
`harness trace <root>`
is `validate --trace <root>`; `--readiness <dir>` writes each epic's report with the root's `HEAD` as
`source_commit`, and `--no-timestamp` leaves it and `generated_at` out for a report committed with
the plan; `--tests <glob>` picks the test files, `--test-pattern <regex>` adds a
way to read test names beyond the built-in JS/TS, Go, Python, JUnit/Kotlin, Rust and Ruby readers
(fixtures: `fixtures/test-names/`).

## lint

`harness lint [dir]...` (default `skills`) checks a folder of skills, or one skill, against the
authoring rules. Errors name a stable rule; `--strict` fails on warnings too.

| Rule | Checks |
|---|---|
| the skill contract (`agentskills-core-fields-only`, `name-matches-path`, …) | frontmatter via the validator |
| `name-is-gerund` | the first word ends in -ing: `writing-requirements` |
| `description-use-when`, `description-do-not-use-for` | a "Use when …" trigger and a "Do not use for … (neighbour)" clause; warnings if out of order or naming no neighbour |
| `description-length` | a description over 400 characters fails, over 300 warns: every description stays loaded in every session |
| `description-budget` (warning) | the scanned set's descriptions together exceed 8000 characters (one engine keeps skill metadata within 2% of context or 8000 characters); the longest are named. The budget binds what a machine installs, not one library: `--budget-set <file>` sums the descriptions of an installed set (a list of skill folders or folders of skills, one per line or a YAML list; or a `toolkit.lock`, whose local entries contribute the skills under `source/path`, the harness's under `skills/`, narrowed by an `x-skills` list; a remote entry is reported as `budget-set-unread`, a listed folder that is missing fails `budget-set-missing`) and warns over 8000 with the count from each source; with no folder given only this check runs |
| `deprecated-description` | a skill with `metadata.deprecated` is exempt from "Use when": its description starts with "Deprecated:" and names the replacement skill |
| `parse-error` | the frontmatter is YAML; when a plain value holds ": " (the usual cause), the error says to quote it |
| `body-length` | warn over 200 body lines, fail over 300 |
| `engine-neutral` | no engine, runtime, forge or stack name in the description or body; `references/engine-notes.md` is exempt. The deny-list (Claude Code, Claude, Codex, Gemini, Antigravity, Herdr, Heeler, stagehand, OpenAI, Anthropic, Copilot, GitHub, GitLab, Forgejo, Cloudflare, Coolify, Hetzner, Angular, NestJS, Drizzle, pnpm) is replaced with `--deny-terms`, narrowed with `--allow-terms`; URLs are ignored |
| `links-stay-in-skill` | no relative link leaves the skill folder (a skill installs alone) |
| `evals-present`, `routing-counts`, `routing-kind-declared` | `routing.jsonl` with ≥ 4 positive, ≥ 3 near-miss with `route_to`, ≥ 2 negative, each case in the evidence contract's format |
| `route-to-known`, `route-to-self` | a `route_to` names a scanned skill, a sibling of a linted skill, a pinned Skilldex skill (`reviewing-code`, `preparing-pull-requests`, `resolving-findings`, `writing-specifications`, `building-skills`), `--known`, or `none` |
| `scenarios-count`, `scenario-format`, `scenario-stop-condition` | ≥ 3 scenarios in `scenarios.md`, each with setup, prompt, pass criteria and k; one should hand to a human |
| `evidence-count` and the evidence contract's rules | ≥ 1 dated entry; literature and vendor-reported cite a URL |
| `imported-needs-review` | nothing `import-evals` could not fill is left: a routing case noted `needs route_to`, a scenario line marked `TODO(import)` |
| `deprecated-never-triggers` | a skill with `metadata.deprecated` keeps only no-trigger cases |
| `description-overlap` (warning) | two descriptions' trigger phrases (the "Use when" clause, stop words removed) share more than 0.3 Jaccard; the pair and the shared words are named. agentic-template's 19 skills peak at 0.17 |

Fixtures: `fixtures/lint/good/skills` (four skills, one deprecated) and one overlay per broken rule
in `fixtures/lint/broken/<rule>/`.

## simulate

`harness simulate <scenario.yaml>` or `harness simulate --project <root>` runs a seeded,
deterministic discrete-event model of the runtime contracts and checks 18 invariants after every
event. The world: a supervisor policy (the `orchestrating-work` protocol as code), author and
evaluator sessions with read-only helpers, CI, a merge queue that classifies conflicts and re-runs
checks on the merged result (for the branches it serves), the orchestrator's own merge under a
merge grant for a branch no queue serves, a scripted human with latencies who also merges an
integration branch into the target once nothing on it is in flight (`promote`), a forge whose
pushes are compare-and-swap on the task file and whose branches (the protected target and each
epic's integration branch) admit a merge only with an approval of the head, and a runtime whose
signals (working, blocked, done, idle, unknown) are lossy and duplicable, with events-lost notices.

A scenario names tasks (`depends_on`, `touches`, `size`, `risk`, `criteria`, `budget`, `lands_to`),
the policy tier and its `forbid`/`ask`/`budgets`, its grants (`grant`, or `grants` for several,
e.g. a work grant and a separate merge grant; each validated against the grant contract), the
supervisor's caps, the merge queue's `queue_targets` (default every branch), the
human's behaviour (`on_integration: merge|hold`), and faults: `concurrent_claims` (a rival runtime),
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
| `one-owner-per-claimed-task` | a claimed task has one owner from a CAS claim; one author session holds it; only the owner commits |
| `transitions-allowed` | every status change is a `workflow.yaml` transition from its from-state by a listed role, or the orchestrator under a live grant of its `grant`; reasons where needed; humans are humans |
| `guards-hold` | the transition's guards hold on the evidence (deps merged, an integrated dependency counting only in the same epic; checks green, criteria met and named in tests, independent review, independent verification by the evaluator for risk medium and up, lands on the protected or the integration branch as `lands_to` says, mechanical-only, merged checks green, integration landed, question answered); a grant adds its grant guards |
| `human-gates-by-humans` | gates are passed by a human approver, or by the orchestrator under a live grant where the gate is grantable |
| `signals-never-advance-workflow` | a commit decided on a runtime signal is one the evidence and authority justify on their own |
| `attention-consistent` | records carry attention only; needs-human names the next action; complete only when the human has nothing left |
| `merge-requires-authority` | a change lands on a branch only by the merge role, a human, or the orchestrator under a merge grant live when it decided for that exact branch; an agent lands only with its `land`/`integrate` commit and after checks on the merged result of that head; with an approval of that head by a human or such a grant, plus `authority.yaml`'s `always_requires`, and never over a semantic conflict or red merged checks |
| `lanes-disjoint` | claimed tasks never have overlapping `touches` |
| `cap-workers`, `cap-depth`, `cap-run`, `cap-spend` | workers, delegation depth, per-run turns and spend, per-task and runtime budgets |
| `no-progress-stops` | after a stalled run or a ceiling, no rerun until a human decides |
| `merged-criteria-covered` | a merged task has a test naming every criterion on the landed head |
| `asks-surface-to-human` | only a human answers a prompt; unattended, an ask is a denial; every prompt and denial reaches the human as needs-human |
| `walls-block` | a forbidden command never runs, in any tier |
| `stalls-surface` | at quiescence every unfinished task is parked by a human or waits on a needs-human record |
| `contracts-valid` | every run-record, return, grant and task record produced validates |

Transition tables, roles, gates, guards, side states, the merge requirements and the claimed statuses
are read from `state-machines/*.yaml` and the task schema. `--break <mutation>` swaps in one of 19
deliberately broken supervisors (`--list` names them); the tests run each, plus four broken world
bindings (bypass that skips walls, a forge without CAS, a merge queue that resolves semantic
conflicts, no branch protection), and require the named invariant to catch it. Among them:
`cross-epic-integrated` (a dependent in another epic treats an integrated dependency as merged:
`guards-hold`, deps-merged), `finalize-unverified` (a risk-medium PR marked ready with no evaluator
verdict: `guards-hold`, independent-verification) and `land-without-grant` (the orchestrator lands a
change no merge grant of its covers: `transitions-allowed`, `merge-requires-authority`).

Output: `.sim-out/<scenario>-seed<n>.jsonl` (one event per line: time, actor, task, the commits it
applied, effects, violations), `.summary.json` (merged, parked, needs-human, spend, makespan,
throughput, violations with seed and event index), `.run-records.jsonl` (each line names its `role`;
an evaluator's run ends in `verdict`, never an author's `advanced`) and `.task-records.json` in
their contracts' shapes. A violation prints a `reproduce:` command. Scenarios:
`fixtures/scenarios/{happy-path, parallel-overlap, crash-lost-events, merge-without-grant,
budget-exhaustion, unattended-ask, evaluator-rejection, grant-expiry, wall-bypass,
integration-branch}.yaml`; `integration-branch` is tier 2 and 3: the orchestrator lands an epic's
tasks on `integration/<epic>` under its merge grant, a same-epic dependent builds on an integrated
task, a dependent in another epic waits for merged, and the human merges the branch to main.

## compile-policy

`harness compile-policy <agent-policy.yaml> --profile <p> --engine claude|codex|gemini [--out <dir>]`
validates the policy, then emits one profile's settings, following `adapters/<engine>/README.md`.
`--out` also writes `report.json`: the tier, every warning (an ask or allow dropped, a mode
degraded), every accepted gap as `{field, message, reason}` (what it degrades and the operator's
reason) and the notes for the launcher, the same file the goldens hold, so what a compile gave up is
on disk beside what it wrote, not only on stderr:

| Engine | Files |
|---|---|
| claude | `settings.json` (permissions allow/deny/ask, `defaultMode` per tier, `auto` for the auto tier, `sandbox` with `allowUnsandboxedCommands: false` under a bypass that relies on it and `credentials` masks with `network.tlsTerminate`), `runner.json` (unattended: `--permission-mode dontAsk --allowedTools … --max-turns --max-budget-usd`) |
| codex | `config.toml` (or `<profile>.config.toml` unattended: a `harness` permission profile, approval policy, network domains), `rules/harness.rules` (`prefix_rule` allow / prompt / forbidden with justification and match examples), `runner.json` |
| gemini | `settings.json` (`defaultApprovalMode`, `tools.sandbox`, `tools.allowed`), `policies/harness.toml` (user-tier `[[rule]]` deny / ask_user / allow), `runner.json` |

A profile's own `sandbox` and `egress` are merged key by key over the top-level ones before
compiling (the merged egress still needs a default, and a deny default its allow list:
`egress-effective`). Fail closed: a deny-side field an engine cannot represent is an error that
prints the `accept_gaps` stanza that would accept it (credential masks on Codex and Gemini are a
`sandbox` gap; the auto tier's WebFetch outside a deny egress list, left to Claude's classifier, an
`egress` gap); a tier an engine has no mode for compiles to its stricter equivalent with a `degraded`
warning; an unrepresentable ask or allow is dropped with a warning; on any error
nothing is written. Refused outright: the bypass tier (`autonomous`) without a `requires` list naming
its outside preconditions, or without `sandbox.enabled`, `sandbox.fail_if_unavailable` and
`egress.default: deny` unless the missing field's gap is accepted by name (`accept_gaps` sandbox or
egress, with a reason) (HAR-4); `requires` goes into `runner.json` and the notes for the launcher;
an unattended tier without turn and spend caps (HAR-3); any `x-` extension that disables hooks (HAR-2); an `examples` entry its rule does
not match. No output may carry `disableAllHooks`, `hooksConfig.enabled: false`, `disableYoloMode`,
`tools.exclude`, a full-access mode, or a bypass key outside the bypass tier (checked on every
compile). Unattended, an `ask` compiles to a denial. `--diff <settings.json|settings.json.tmpl>`
compares the Claude output with a hand-written file.

Goldens: `fixtures/compile-policy/golden/expected/<engine>-<profile>/`, each with its `report.json`
(`UPDATE_GOLDEN=1` rewrites).
`fixtures/compile-policy/dotfiles/agent-policy.yaml` restates the user's Claude settings for the diff
test; stagehand's `herdr.rules` round-trips through the Codex compiler when the checkout is present.

## lock

`harness lock [--lock toolkit.lock]` fills each entry's `commit`, `tree` (the git tree id of `path`)
and `version` (from a semver tag, else `package.json`/`plugin.json` in the path). Local sources are
read with git plumbing, no network; remote sources use `git ls-remote` and a depth-1 blob-less fetch
into `~/.cache/harness/lock`, and an unreachable remote fails with the reason (`--offline` skips
remotes with a warning). `--check` changes nothing and exits 1 on drift: a pinned commit that is
gone, a different tree, a moved tag, a branch rewritten past the pin, a version the tag contradicts;
a branch that moved ahead is a warning. A CI checkout often has no local branch: a local source's ref
resolves as a tag, a branch, or `refs/remotes/origin/<ref>`, and when a detached or shallow checkout
holds none of them, `--check` verifies the pin by its recorded commit and tree ("ref not present;
verified by commit", warning `ref-absent`) instead of failing; a shallow clone that lacks the pinned
commit itself fails `commit-exists` with the fix (fetch the full history). `--update [name...]` moves pins within each entry's
`autoUpdate` (never to a prerelease), or a named entry to its newest tag. Comments survive.

## eval-routing

`harness eval-routing [dir]...` is a dry run: it prints each skill's case count and the router
prompt, and sends nothing. `--runner "<cmd>"` sends each case's prompt on stdin to any command that
prints text (a cheap-model CLI), takes the skill names on its last line, and judges: a trigger case
needs its skill; a no-trigger case needs it absent and, for an installed `route_to`, the neighbour
named. The router sees only installed, non-deprecated skills' names and descriptions, as an engine's
loader would. It reports failures and per-skill precision and recall. `--runs <k>` asks k times per
case and passes a case only when all k pass (pass^k); `--model <label>` names the model; `--out
<routing-results….jsonl>` writes one result per case in the evidence contract's `routingResult`
shape, which `harness validate` checks and an evidence entry cites as its measured source. Ported from agentic-template's
`scripts/skill-evals.mjs`. Tests use `fixtures/eval-routing/fake-router.mjs`; no test calls a model.

## import-evals

`harness import-evals <evals.md> --out <skill>/evals [--skill <name>] [--rename old=new,...] [--k n]
[--force] [--dry-run]` converts an agentic-template `evals.md` (a "Trigger routing" table, "Scenarios"
with Fixture/Assertions, an "Evidence" list) into `routing.jsonl`, `scenarios.md` and `evidence.md`
in the evidence contract's shapes. A trigger row is a positive case; a no-trigger row that names a
skill is a near-miss routed to it (after `--rename`); any other no-trigger row is a negative case
with `note: "needs route_to: <what the source said>"`. Scenarios keep their fixture and assertions
and get a `TODO(import)` prompt (the source has none); evidence keeps its date (day or month) and
text, kind audit or observed, citing the source file. Lint fails both markers
(`imported-needs-review`) until a human resolves them. It refuses to overwrite without `--force`.
Fixtures: two real evals.md files under `fixtures/import-evals/`.
