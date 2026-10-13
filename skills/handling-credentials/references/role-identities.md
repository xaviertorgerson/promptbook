# Role identities and token scopes

One identity per role, each with its own credential. Scopes are named generically; engine-notes.md
maps them to a forge. "Lifetime" is the target; where the forge cannot mint short-lived tokens for
a role, record the gap and a rotation date.

| Role (workflow role) | Identity | Grants (scopes) | Must not have | Minted by | Lifetime |
|---|---|---|---|---|---|
| author (coder) | `coder-agent` bot / app installation | read repository; write to non-protected branches; open and update PRs (draft); comment | merge; approve; write to protected or integration branches; admin; secrets read; deploy | app installation token per run, limited to the task's repository | one run (about an hour) |
| reviewer / evaluator | `reviewer-agent` | read repository; read checks; comment on PRs (inline) | any write to code or branches; approve; merge; label changes beyond its own comments | app installation token per run, read + comment only | one run |
| planner | `planner-agent` | read repository; write task files on a planning branch; open PRs | code paths outside `specs/`; merge; approve | per run | one run |
| merger (merge) | `merge-agent` | read; write the PR head branch (mechanical resolutions); merge PRs into the protected branch (tier 1) or the integration branch (tier 2) | approve; deploy; admin; push directly to protected branches (protection forbids it anyway); force-push | per run, on a trusted runner only; the only merge-capable credential | one run |
| coordinator (orchestrator) | `orchestrator` | read; select and comment; under a live grant only what the grant names (for example merge into `integration/<epic>`) | anything not in a live grant; production | per run; scope narrowed to the grant's repositories | the run, and never beyond the grant's `expires_at` |
| releaser (train) | the release workflow's identity | read packages and deployment records; deploy to pre-production stages; request production deployment | approve its own production deployment; push code; merge | CI job token plus OIDC to the cloud per job | one job |
| production approver | a human owner | approve the protected production environment | — | the human's own account (strong second factor) | the human's session |
| auditor | `auditor` | read repository, checks, deployment records, audit logs, run records | any write; secrets read | per run, read-only | one run |
| CI build | the build job | read; push one immutable artifact to the registry | deploy to production; merge | CI job token (and OIDC for cloud registries) | one job |

Rules that apply to every row:

- Agent identities are never code owners and never production approvers.
- No row holds a cloud key; cloud access is federated per job.
- Two roles never share one credential, even if their scopes look alike today.
- The credential for a role is available only to the job or session running that role (a trusted
  runner label for the merge role; a protected environment for production).
- Every run records which identity it used (the runner's run-record and the forge's audit log).

## Checks after setup

| Check | How | Expect |
|---|---|---|
| reviewer cannot push | try a push to a scratch branch with the reviewer token | refused |
| coder cannot merge | try to merge a test PR with the coder token | refused |
| no agent can approve | try an approval with each agent token on a PR requiring code-owner review | the approval does not satisfy protection |
| production needs a human | start a production deployment with the release identity | waits for the required reviewer |
| tokens expire | inspect the minted token's expiry, or retry after the window | refused after expiry |

Run them once when the table is set up and after any change to it; record the results.
