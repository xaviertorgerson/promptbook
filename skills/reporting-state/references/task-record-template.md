# Task record template (task-record contract 1.3.0)

One per task per runtime, at `.orchestrator/tasks/<task_id>.yaml`, untracked. Omit unused fields.
Unknown fields are errors except `x-*`.

```yaml
task_id: BILL-7                 # required: the workflow task id, or the runtime's stable id
runtime: <slug>                 # which runtime keeps this record
mode: development               # engagement: development | reviewer-only | delegated-work | workspace-only
objective: <the human-authorized outcome>
intent_ref: specs/<epic>/tasks/BILL-7.md   # plan, PR, issue, task file or human request
grant: GRANT-7                  # only when acting under a grant
repository: { name: <owner/name>, root: <path>, worktree: <path>, remote: origin, base: main, base_commit: <sha>, branch: <branch> }
workspace: { id: <runtime workspace id>, label: <live label> }
agents: { author: <name>, reviewer: <name> }          # only roles actually created
role_sessions:
  author: { session_id: <id>, engine: <slug>, model: <model>, effort: <effort> }
wake: { watches: { author: <watch id>, reviewer: <watch id> } }
pull_requests: [<url>]
state:                          # required
  name: working                 # working | needs-human | complete
  summary: <3-5 words, max 120 chars>
  next_role: author             # author | reviewer | evaluator | worker | workspace_agent | orchestrator | null; omit when complete
  next_action: <one concrete step>   # required for needs-human; absent when complete
signals:                        # last observation per role; evidence, never a transition
  author: { source: herdr, value: blocked, observed_at: "<ISO 8601>" }   # herdr | a2a | mcp-tasks | claude-headless | codex-exec | loop-outcome | ci | forgejo | gitlab | other
result: <latest result or verification reference>
reviews: [{ pr: <url>, head: <sha>, role: evaluator, outcome: pass, by: <evaluator>, ref: <verdict path> }]   # evaluator: pass | fail; reviewer: pass | changes-requested | comment
resources: { slug: <branch slug>, worktree_path: <path>, database: <name>, ports: { slot: <n>, first: <port>, last: <port> } }   # managing-worktrees; audit and worktree_removed_at at cleanup
decisions: [{ decision: <what the human decided>, source: <where>, scope: <task or grant>, at: "<ISO 8601>" }]
updated_at: "<ISO 8601>"
```

Rules the validator enforces: `needs-human` needs `next_action`; `complete` forbids `next_action`
and `next_role`; `state.name` is attention, never a workflow status; review `head` is a git sha;
`grant` is `GRANT-n`.
