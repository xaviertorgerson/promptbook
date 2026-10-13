# Engine and forge notes

The procedure says "the forge", "the merge queue", "branch protection". These notes map them; the
harness `adapters/ci` owns the mapping.

## GitHub

- Branch protection or rulesets: require a pull request, require code-owner review, restrict who can
  push, do not allow bypass. Agents are not in `CODEOWNERS`.
- Merge queue: enable it on the protected branch (and on an integration branch if wanted); workflows
  must trigger on `merge_group` or required checks never report.
- agentic-template's `agent-merge.yml` wakes on `pull_request_review` with state `approved`, runs on
  a trusted runner with the only merge-capable token (`MERGE_FORGE_TOKEN`), runs
  `scripts/conflict-classify.mjs`, labels `needs-human-merge` on a semantic conflict, and lands with
  the forge shim's `pr-merge`. Job-level `permissions` is honored by GitHub.

## Forgejo

- Branch protection with restricted push and the owners check; scoped tokens and runner labels are
  the real gate: Forgejo Actions ignores the workflow `permissions` key (agentic-template docs/roles.md).
- No merge queue: the merge role serializes by hand.

## Claude Code

- The template's PreToolUse hook denies every `git push --force*`, including `--force-with-lease`
  (probed 2026-10-13); in those projects the rebase strategy's branch rewrite is a human action.
- `git push` with no target, or to `main`/`master`, is an `ask` in that hook; unattended it is a
  denial. Branch protection, not the ask, is the wall (ADR-0021).

## Terminal-multiplexer coordinators (stagehand)

- Merge authority is a separate grant naming repositories, target branches, strategy and required
  evidence; only the coordinator exercises it, through the forge's PR merge after a current-head
  independent review; it checks the actual base and head and records the result. Refreshing a PR
  branch by merging its base is not landing it.
