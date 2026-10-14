# Adapter: CI and the forge

The forge (GitHub, or Forgejo through the same workflow files) is where the three human gates are
enforced and where event-driven agents wake. It is a runtime, not an engine: it runs engines
headless and records their results. Facts are from agentic-template `docs/roles.md`,
`docs/workflow.md`, `scripts/loop.mjs` (branch `fix/agent-run-caps`) and ADR-0021, as of 2026-10-13.

## Gates → forge controls

| `workflow.yaml` gate / rule | GitHub | Forgejo |
|---|---|---|
| `pr-approval` (human) | branch protection: require a PR, require Code Owner review; agents are not in `CODEOWNERS` | owners file + required approvals |
| `task.land` only by `merge` | the merge job runs on a trusted runner label and holds the only push-capable token | same: runner labels + scoped tokens |
| `production-release` (human) | the `production` GitHub Environment's required reviewer | no environment approvals: the production hop is `workflow_dispatch` only |
| `merge` grant (`authority.yaml`) | must still satisfy branch protection; a grant cannot stand in for a required Code Owner review | same |

Job-level `permissions` is honored by GitHub and ignored by Forgejo; the load-bearing least privilege
is token scope + branch protection + runner labels + the engine's allowlist (`docs/roles.md`).

## Events → agents (event-driven, never polled)

| Forge event | Wakes | Contract it reads | Contract it writes |
|---|---|---|---|
| a spec lands / epic approved | planner | `epic`, `journey`, `requirement` | `task` files (spec-draft), a readiness report |
| a task file → `ready` | coder | `task` | the task's agent log, a draft PR, a `run-record` line |
| PR push | reviewer | the diff, `task` criteria | inline comments only |
| human approval | merge | `task`, the PR | `task.status` → merged |
| schedule / `workflow_dispatch` / `train:hold` | train | the release machine | deployments |

## Runs → `run-record` and attention

Every unattended engine run is `claude -p --permission-mode dontAsk --allowedTools <list>
--output-format json --max-turns N --max-budget-usd X` (ADR-0021), or the Codex/Gemini equivalent from
their adapters. The runner appends one `run-record` line: exactly the shape `scripts/loop.mjs`
writes, plus optional `engine`, `runtime`, `permission_denials`, `attention`. A non-empty
`permission_denials` is a question for a human, so the run is `needs-human` even when `subtype` is
`success`.

Check-run results map to attention through `state-machines/attention.yaml` → `sources.ci`
(`status`: queued, in_progress, waiting, requested, pending; `conclusion`: success, failure,
neutral, cancelled, skipped, timed_out, action_required, stale —
[GitHub check runs](https://docs.github.com/en/rest/checks/runs)). A green check is evidence for the
`checks-green` guard; the actor still commits the transition. A `skipped` required check is not a
pass.

## Validation in CI

```yaml
- run: pnpm --dir harness install --frozen-lockfile
- run: node harness/tools/validate.mjs specs DECISIONS.md          # every artifact against its contract
- run: node harness/tools/validate.mjs --trace . --tests "apps/**/*.spec.ts"   # the trace graph
```

`--trace` exits 1 on any error; `--strict` makes warnings fail too, which is the switch a project
flips once it has a `docs/product/brief.md` and has cleared its legacy warnings.

> ADR-0021 is agentic-template's measured permission matrix (Claude Code 2.1.296), on branch `docs/adr-permission-precedence`, commit `c177fa1`, until it lands on master.
