# Naming rule, derived resources, env files, limits

Every value a worktree needs is computed from its branch, so the same branch always gets the same
resources and two branches never share one.

## The slug

```
slug = lowercase(branch)
       with every run of characters outside [a-z0-9] replaced by "_"
       with leading and trailing "_" removed
       ("detached" when there is no branch)
```

`feat/bill-7-rerate-proration` → `feat_bill_7_rerate_proration`. This is agentic-template's
`branchDbName()` rule (scripts/dev-server.mjs), kept so existing databases keep their names.

## Derived resources

| Resource | Rule | Example (`feat/bill-7-rerate-proration`) | Notes |
|---|---|---|---|
| Worktree path | `<root>/.worktrees/<task-id>` (ignored by git), or the runtime's own location | `.worktrees/BILL-7` | keyed on the task id for humans, on the branch for git: one branch, one worktree |
| Database | `app_<slug>`, cut to 63 characters | `app_feat_bill_7_rerate_proration` | on the same server as the base URL; the URL is built at runtime (base URL with the path replaced), never written into an env file |
| Port block | the project's block start `P`, width `W` (ports per worktree); slot `s` = lowest slot free in the local slot file; ports `P + s·W … P + s·W + W − 1` | block 4400, width 10, slot 2 → 4420–4429 | probe each port on both loopback addresses before use; a taken port means the slot file is stale, so take the next slot and record it |
| Slot file | one untracked file per machine and repository, e.g. `.agent/worktree-slots.json`: `{ "<slug>": s }` | `{"feat_bill_7_rerate_proration": 2}` | freed at cleanup |
| Build output, test artifacts, mutable caches | inside the worktree, or `<cache-root>/<slug>/` | `.worktrees/BILL-7/dist` | anything with absolute paths or per-run state is per worktree |
| Content-addressed download caches (package store, model weights) | shared | — | safe to share: immutable by hash |
| Local services (queues, object store buckets) | name or prefix `<slug>` | bucket `dev-feat_bill_7_rerate_proration` | the same rule as the database |
| Logs and process state | `<worktree>/.agent/` (ignored) | `.worktrees/BILL-7/.agent/dev-api.log` | the cleanup audit reads it to find running processes |

Hardcoding any of these is the defect the playbook names: the second worktree fails to start and
the agent "fixes" the config.

## Untracked inputs (env files) without committing secrets

- **Allowlist only.** The project names the untracked files a worktree needs in one committed
  list (for example `.worktreeinclude` with `.env`, `.env.local`). Copy those and nothing else.
- **Who copies.** The runtime's worktree creation or the project's init script copies them, not
  the agent through a tool call. A project secret guard may deny an agent's `cp .env …`; that
  denial is correct. Do not route around it with another command.
- **Check before anything runs:** `git -C <wt> check-ignore -q <file>` must succeed for each copied
  file. If it fails, delete the copy and stop: the file would be committable.
- **Never print, diff, grep or stage** a copied file. Do not edit it to set the derived database:
  build the URL at runtime and pass it in the process environment.
- **Better than copying:** a file of references (`${VAR}` names) resolved from the secret store at
  process start (handling-credentials). Then nothing secret sits in the worktree.
- At cleanup the copies are derived artifacts: removed with the worktree, never archived.

## Concurrency limits

| Limit | Value | Source |
|---|---|---|
| Running sessions per repository | the grant's `limits.max_workers`; without a grant, the project's setting; default 3–5 | one human's review span (agentic-template docs/concurrency.md says five) |
| Worktrees per branch | 1 | git refuses a second checkout of a branch; do not override it |
| Sessions per worktree | 1 | sessions are single-actor and machine-local |
| Tasks with overlapping `touches` | 1 at a time (one lane) | the scheduler sequences them |

Retained worktrees that wait at `human-review` do not count against running sessions, but they keep
their resources until cleanup; the reaper reports them.

## Recording the base

```sh
git fetch <remote> <base>
BASE=$(git rev-parse <remote>/<base>)
git worktree add -b <branch> <path> "$BASE"          # new task
git worktree add <path> <branch>                     # resuming: the branch exists on the remote
```

Write `$BASE` to `repository.base_commit` in the task record and to the claim's agent-log line.

## Refresh choices

| Situation | Do | Push |
|---|---|---|
| Branch is yours alone (no PR, or a draft nobody else has pulled) | `git rebase <remote>/<base>` | `git push --force-with-lease=<branch>:<expected-sha> <remote> <branch>`, only if the project's walls allow it |
| Branch is shared (PR under review, another agent or human pulled it) | `git merge <remote>/<base>` | plain push |
| A wall denies every force push (agentic-template's hook denies `--force-with-lease` too) | merge refresh | plain push |

After either: re-run the gates, record the new base commit, and re-request evaluation if the PR was
already evaluated (a changed head invalidates a prior verdict).
