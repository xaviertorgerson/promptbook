# Claim, living plan and hand-back: templates

Placeholders: `<ID>` task id, `<branch>` the task's `branch`, `<base>` the target base branch,
`<remote>` the forge remote (usually `origin`), `<me>` your agent identity.

## 1. The claim (compare-and-swap)

The `owner`/`status` pair is the lock and a rejected push is the swap failing. Agents never push to
the default branch, so the claim commit lives on the task branch, whose name is unique to the task.

```sh
git fetch <remote> <base>
BASE=$(git rev-parse <remote>/<base>)              # record this exact commit
git ls-remote --exit-code --heads <remote> <branch> && echo "taken: pick the next task"
# create the worktree on <branch> from $BASE (managing-worktrees), then inside it:
#   edit the task file: owner: null -> <me>; status: ready -> in-progress
#   append to the Agent log: "<date> <me> — claimed on <base>@<short BASE>; status → in-progress"
git add specs/<epic>/tasks/<ID>.md
git commit -m "chore(tasks): claim <ID>" -m "Compare-and-swap claim from <base>@<short BASE>."
git push -u <remote> <branch>                       # never --force; rejected = someone else won
```

- Rejected push, or the branch already exists: remove the worktree you just made (it holds nothing
  but your claim), re-fetch, pick the next dispatchable task. Never force, never rename the branch
  to get around it.
- A dispatcher that reads only the default branch still sees the task `ready`; it must also check
  for the task branch on the remote (`git ls-remote`) or an open PR before dispatching it.
- A human `owner` is never overwritten. Auto-dispatch claims only `owner: null`.

## 2. `## Working notes` (the living plan)

Place it after Open questions, before the Agent log. Rewrite it in place; keep it under a screen.

```markdown
## Working notes
Base: main@4f1c2d9 · Mode: spec-driven · Risk: medium · Budget left: ~60 turns

Plan (each step names the criterion it serves)
1. [x] Transactional replace of both segments — AC-1
2. [ ] Lock per (account, period) to reject a concurrent rerate — AC-2
3. [ ] Withdrawn plan change rates on the original plan — AC-3

Decisions inside scope
- Lock is a row lock on the period, not an advisory lock: survives a worker restart.

Outside this task (for the planner)
- The invoice preview also double-counts prorations; not in `touches`.

Next: write the AC-2 concurrency test, then step 2.
```

## 3. Agent-log line (append-only, newest last)

One line per real event: claim, draft opened, evaluation verdict, park, handoff.

```markdown
- 2026-10-13 coder-agent-2 — AC-1..AC-3 implemented and tested; evaluator pass on 9e3b1a7 (pass^2); draft PR #240; status → review (session 3f0c6c1e).
```

A park line names the prior status so the side state can resume to it:
`status was in-progress; status → needs-input: <the question>`.

## 4. The `sessions` entry (task frontmatter)

The agent appends it; the runner never writes the task file.

```yaml
sessions:
  - engine: claude              # slug of the engine that ran the session
    session_id: 3f0c6c1e-6d1f-4b55-9c49-1f1f6b7b0c11
    actor: coder-agent-2
    role: coder
    started_at: 2026-10-13T09:00:00Z
    ended_at: 2026-10-13T09:41:00Z
    outcome: advanced           # advanced | stalled | failed | abandoned | needs-human (verdict, read: an evaluator's or reader's session)
    run: .agent/loop-runs.jsonl # where the runner's run-record line is
```

## 5. The evaluator packet (what verifying-work receives, and nothing more)

```markdown
Evaluate <ID> on <remote>/<branch> at <head sha> against <base>@<base sha>.
Task file: specs/<epic>/tasks/<ID>.md (criteria AC-1..AC-n; Context; linked requirements).
Diff: git diff <base sha>...<head sha>
Run: <the project's test command>; criteria check: <ears-coverage command or equivalent>
Running app: <PR preview URL or the local start command and port>
Risk: <low|medium|high> → k = <1|2|3>
Return a verdict per AC-n with evidence; do not edit anything.
```

Not in the packet: your transcript, your Working notes, your opinion of the change.

## 6. Return file location

Write the JSON to `.agent/returns/<ID>-<session-short>.json` (gitignored runtime state), or emit it
as the runtime's structured output. Paths in `artifacts` are repository-relative or URLs.
