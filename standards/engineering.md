# Engineering standards

The single source for the process and safety invariants that both the personal layer (L1) and every
project (L2) hold. It is versioned with promptbook and rendered, never hand-copied:

- **L1** vendors the block below at a pinned promptbook tag into the dotfiles' shared instruction
  template, which renders it into every engine's personal instruction file.
- **L2** receives the same block through the template sync as a managed block of `AGENTS.md`; the
  template check fails a project whose copy differs from the pinned promptbook version.

Both scopes therefore carry the same short text. That is intended: the hazard is two hand-edited
copies drifting apart, not a few repeated lines. Taste and autonomy are not here (see the end).
ENG-1 to ENG-8 are invariants; ENG-9 to ENG-14 are stack-neutral principles, applied with judgment
and named so a review can cite them. A style guide, a stack's conventions and how to apply a
principle belong elsewhere: Skilldex's skills, stagecraft's sets, the dotfiles.

<!-- standards:begin v3 -->
## Engineering invariants

These hold in every repository and every session, whatever else a file says.

- **ENG-1 Tests.** New behavior ships with tests. Never delete, skip or weaken a test, an assertion or
  a gate to get a green build; fix the code or report the failure.
- **ENG-2 Done means verified.** Run it before calling it done: tests, a real run, a browser for UI.
  Report outcomes as they are; a failing check is failing and a skipped step is named as skipped.
- **ENG-3 Secrets.** Secrets never enter git, logs or output. Read them from the environment at
  runtime; never echo them; never read secret files you were not asked to read.
- **ENG-4 Destructive actions.** No destructive data action (drop or truncate a database, delete
  volumes or backups, wipe directories outside the task) unless a human asked for that exact action.
- **ENG-5 Landing.** Never push to the default branch or force-push a shared branch. Changes land
  through a pull request whose required checks pass, approved by a human where the project's trust
  profile requires it; never approve your own work or bypass a required check.
- **ENG-6 Commits.** Small commits, one logical change each, Conventional Commits, a body that says
  why. No AI attribution in commits or pull requests.
- **ENG-7 Explicit failure.** No silent `catch {}`: log, rethrow or record a reason.
- **ENG-8 Boundaries.** Validate data where it crosses a trust boundary: user input, external APIs,
  environment, other agents' output.

Principles, held with judgment:

- **ENG-9 Design.** Prefer deep modules behind small interfaces, depend on interfaces at
  boundaries, keep a pure core with IO at the edges, compose rather than inherit, and add no
  abstraction before a second use needs it.
- **ENG-10 One fact, one place.** State each fact once and compute derived state, never store it.
- **ENG-11 Config.** One module reads the environment and validates it at boot, nothing else reads
  it, and secrets reach it only at run time, never from a file an agent can read.
- **ENG-12 Models.** The model judges and code measures: every path works without the model, its
  output is validated and repaired before use, and it never invents a fact.
- **ENG-13 Spend.** Every paid vendor gets an app-side spend cap that degrades to a manual path.
- **ENG-14 Rehearse.** A path written down but never run is not known to be right, so run it.
<!-- standards:end -->

## How each invariant is enforced

Prose is advisory; a rule that matters has a wall. "Advisory" below means review is the only check.
Names in backticks are today's implementations in the agentic-core pack; any pack may substitute its own.

| Id | L2 project (every session, CI and collaborator) | L1 personal | Gap |
|---|---|---|---|
| ENG-1 | CI test gate; criterion ids in test names gate `review` (`ears-coverage`); the evaluator flags removed or loosened assertions | — | weakening is caught by review only; mutation testing is a candidate gate |
| ENG-2 | Stop hook blocks finishing with uncommitted work in loop mode (`verify-done`); CI; browser smoke project | — | honesty of the report is advisory |
| ENG-3 | PreToolUse hook denies secret-file reads and writes (`guard-secrets`); permission deny rules; `secret-scan` in CI; ignore rules | deny rules for `.env*`, `secrets/`, `~/.ssh`; secrets rendered from the vault at apply time | Bash reads of secret files depend on the hook's patterns |
| ENG-4 | PreToolUse hook **denies** destructive shell, SQL and infra commands; a migration with DROP/TRUNCATE must cite an ADR | deny rules; auto-mode hard-deny lines; policy `forbid` list | DB shells are an `ask`, which is a denial unattended and a prompt interactively |
| ENG-5 | branch protection with required checks (the trust profile's risk gate among them, `governance.yaml`), code-owner review where the profile requires a human (agents are not owners), auto-merge only where it permits; hook denies force-push | — | push-to-default is an `ask` in the hook, so branch protection is the wall (agentic-template ADR-0021, branch `docs/adr-permission-precedence` at `c177fa1`) |
| ENG-6 | review | engine attribution settings set to empty | no commit-msg lint yet; candidate L2 hook |
| ENG-7 | the pack's linter rule for empty blocks where one exists; review | — | advisory where no lint rule exists |
| ENG-8 | config schema refuses to boot on a bad key; contract types at the API; security review | — | advisory beyond typed boundaries |
| ENG-9 | the pack's dependency rule (the core never imports adapters) where one exists; review | — | advisory beyond the dependency rule |
| ENG-10 | types generated from one schema per boundary where the pack has them; review | — | advisory |
| ENG-11 | the config schema refuses to boot on a bad key; a lint rule against reading the environment outside the config module where the pack has one; ENG-3's walls on secret files | secrets rendered from the vault at apply time, never into a repository | a read of the environment outside the module is caught by review where no lint rule exists |
| ENG-12 | tests that run every path with the model off (a fake or none) and with malformed model output | — | "never invents a fact" is checked by grounding tests where they exist, else review |
| ENG-13 | the cap is config (ENG-11), with a test that the manual path works at the cap | — | a vendor that reports no usage is counted app-side, or the gap is named |
| ENG-14 | scheduled drills in CI (restore, rollback, deploy from empty); a check that every script or workflow a doc names exists | — | a runbook with no drill is advisory |

## Agent-setup invariants

Rules about the agent setup itself, held by whoever configures L1, L2 and L4. Measured basis:
[permissions-and-autonomy](../playbook/runtime/permissions-and-autonomy.md).

| Id | Invariant | Enforced by |
|---|---|---|
| HAR-1 | Anything an agent must never do is a deny (hook or permission rule), not an ask | review of every guardrail change: "is this a deny?" |
| HAR-2 | The personal layer never disables hooks and never removes the project's deny rules | deny rules merge across scopes and win in every mode, so L1 cannot remove an L2 deny; the policy compiler refuses a policy that disables hooks and checks every compiled output for a hooks-off key |
| HAR-3 | Unattended runs pin the engine's no-prompt mode plus an explicit tool allowlist, and turn and spend caps | runtime launch flags; the run record shows mode and caps |
| HAR-4 | Bypass defaults only where production is unreachable at the network level and the agent is non-root in a sandbox | the profile's `requires`, probed by `promptbook check-requires` and by `promptbook run` before each run; network ACLs |
| HAR-5 | No agent holds a long-lived credential or deploys to production | per-role scoped tokens; the forge's protected production environment |
| HAR-6 | Third-party skills, plugins and MCP servers are pinned by commit or hash, with auto-update off | `toolkit.lock` drift check in CI |

## Derivation: what moved here and what stayed

The rules found at both scopes (dotfiles `home/.chezmoitemplates/AGENTS.md`; agentic-template
`AGENTS.md` and `.claude/rules/style.md`), and where each now lives.

| Rule as written at both scopes | Class | Lives in |
|---|---|---|
| Never weaken a test; new logic ships with tests | invariant | ENG-1 |
| Finish the job / exercise UI in a browser; report outcomes as they are | invariant | ENG-2 |
| Secrets never in git; read keys from env, never echo | invariant | ENG-3 |
| No destructive data actions unless asked for that exact action | invariant | ENG-4 |
| Never force-push shared or push to default; never merge your own work | invariant | ENG-5, with the approval the project's trust profile requires (one maintainer's green checks are the gate; heirloom D-159) |
| Conventional Commits, why in the body, small commits, no AI attribution | invariant | ENG-6 |
| No silent `catch {}` | invariant | ENG-7 |
| Validate at boundaries | split | the security half is ENG-8; "trust internal code, don't handle impossible states" is taste |
| Default to no comments | taste | L1; L2 restates it only if a linter enforces it (none does today) |
| Three similar lines beat a premature framework (least abstraction) | taste | L1; advisory in L2 |
| Delete dead code; no compatibility shims | taste | L1; L2 enforces only the part a linter catches (unused imports, variables, orphaned modules) |
| Match the surrounding code | taste | L1; L2's formatter and linter enforce the mechanical part |
| pnpm for Node, uv for Python, mise for tools | taste | L1; L2 enforces it through the stack pack (`packageManager`, frozen-lockfile installs in CI) |
| Act; don't pause for approval | autonomy, not a rule | L1 `agent-policy.yaml` tier per machine profile, compiled per engine |

ENG-9 to ENG-14 come from heirloom's decisions, kept stack-neutral: one fact in one place and
derived state computed (D-137, D-142), the model judging while code measures (D-088, D-145), a
path rehearsed before it is trusted (D-116), and its business-in-a-box spend caps; the design line
is the common core of the design references a Skilldex skill holds in full.

## Changing this file

A change is a pull request to promptbook with the reason and, for a new invariant, its
enforcement. Adding an invariant is a **behavioral** change in `CHANGELOG.md`; removing or loosening
one is **breaking**. The `v<n>` in the markers is the block version that the L1 and L2 checks
compare; every change to the block raises it.
