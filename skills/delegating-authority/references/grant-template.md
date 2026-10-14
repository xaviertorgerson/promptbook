# Grant template

A blank grant with every field explained. Placeholders in `<...>` do not validate; fill them from the
human's words, then run `node tools/validate.mjs --contract grant <file>` if the validator is available.

```yaml
# A blank grant (grant contract 2.0.0). Delete what the human did not say; never add what they did not say.
id: GRANT-<n>                       # never reused
granted_by: <human handle>          # the human who holds the authority (owner or engineer)
granted_to:
  role: orchestrator                # orchestrator | merge | planner; workers never hold a grant
  # agent: <exact agent identity>   # only when the grant is for one session
  # runtime: <runtime slug>         # e.g. the loop, the CI orchestrator, the multiplexer coordinator
granted_at: "<ISO 8601, the moment the human confirmed>"
source: "<where the human said it: commit, issue comment URL, transcript reference>"
scope:
  objective: <the outcome, in the human's words>
  repositories: [<owner/name>]      # at least one
  # epics: [<epic-slug>]
  # tasks: [<TASK-n>]
  # requirements: [<epic>/REQ-n]
  # non_goals: [<what is explicitly out>]
actions:                            # each is separate; finalize is not merge
  - select-tasks
  # - approve-plan
  # - { action: dispose-findings, policy: "<how findings are split between fix-now and follow-up>" }
  # - finalize
  # - publish-review
  # - action: merge
  #   repo: <owner/name>
  #   target: <one exact integration branch, no wildcard; never the protected branch>
  #   protected_branch: <the repository's protected (default) branch, e.g. main>
  #   strategy: merge               # merge | squash | rebase
  #   requires: [independent-review, required-checks, current-head]
limits:
  max_workers: <1-32>               # every live worker counts: authors, evaluators, readers
  budget: { max_usd: <number> }     # also max_turns, max_minutes, max_tokens
  stop_when: [<the agreed outcome>, <repeated non-progress>]
expires_at: "<ISO 8601, required>"
revocable: true                     # always
# narrowed: [{ at: "<ISO 8601>", by: <handle>, change: <what was removed> }]
# revoked_at: "<ISO 8601>"
# revoked_by: <handle>
# revocation_reason: <why>
```
