# The dispatch loop

Runtime-neutral pseudo-code. Every runtime runs the same loop; only what wakes it differs
(`runtimes.md`). Code should own as much of this as possible: selection, caps and the record writes
are mechanical; judgment is needed only to read answers and decide what a human must see.

```
on start, on wake, on a human message:
  grants   = live(load(".orchestrator/grants/*.yaml"), now)   # granted_at <= now < expires_at, not revoked
  records  = load(".orchestrator/tasks/*.yaml")
  evidence = { tasks: pull_and_read("specs/*/tasks/*.md"),
               forge: branches, PR heads, reviews, checks,
               runtime: live workers, sessions, pending wakes or a snapshot }
  for r in records: reconcile(r, evidence)        # recovery.md; save each changed record
  for wake in pending: handle(wake); ack(wake)    # reporting-state; never redispatch on a wake alone

  if stop_condition(grants, records): report(); sleep
  while capacity() > 0:
    t = next_dispatchable(evidence.tasks, records)
    if t is none: break
    dispatch(t)                                    # SKILL.md step 4
  report_needs_human(records)                      # one action per task, else "None."
  sleep until the next event                       # never poll
```

## Selection

```
next_dispatchable(tasks, records):
  merged    = { t.id | t.status == merged }
  in_flight = { r.task_id | r.state.name == working }
  busy      = union(t.touches for t in tasks if t.id in in_flight)
  candidates = [ t for t in tasks
                 if t.status == ready and t.owner is null
                 and all(d in merged for d in t.depends_on)
                 and epic(t).status in {approved, in-progress}
                 and mode_guard_holds(t)                     # contracts.md, Mode guards
                 and disjoint(t.touches, busy)               # missing touches = whole epic is busy
                 and not (risk_high_or_irreversible(t) and unattended()) ]
  return first(sort(candidates, by = (priority, id)))
```

Overlap uses the globs as written: two tasks overlap when any glob of one could match a path of the
other (same prefix up to the first wildcard is a practical test). When in doubt, they overlap.

## Capacity

```
capacity():
  cap   = grant.limits.max_workers if acting under a grant else started_by_human_cap (<= 5)
  live  = count(workers alive: authors + evaluators + readers)
  spent = sum(run_records.total_cost_usd where grant == g)
  if grant and spent >= grant.limits.budget.max_usd: return 0   # and record needs-human
  return cap - live - 1                                          # keep room for the task's evaluator
```

Count the evaluator when you plan the author: a task needs two slots once its draft opens.

## Per-run ceilings

Every run launches with its turn and spend ceilings (task `budget`, else the runtime defaults) and,
unattended, with the runtime's no-prompt mode and an explicit tool allowlist. After each run:

| Run result | Next |
|---|---|
| status advanced, no permission denials | continue; the evaluator runs when the draft is open |
| status unchanged (stalled) | stop the lane; `needs-human` with what was tried |
| turn or spend ceiling hit | stop; `needs-human`; options: split, re-scope, raise the budget |
| crash, no result | one retry after confirming no commits or PR landed; then `needs-human` |
| permission denials > 0 | `needs-human`: each denial is a question for a human |
| another task claimed instead | stop; `needs-human`; the assignment named the wrong task or the claim raced |

## Stop conditions for the whole loop

No dispatchable task; the grant expired, was revoked, or hit its budget; the grant's `stop_when`
outcome is met; the human said stop. On any of them finish the current step, save the records, and
report. Work that already landed stays landed.
