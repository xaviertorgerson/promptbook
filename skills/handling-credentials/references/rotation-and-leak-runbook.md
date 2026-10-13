# Rotation runbook and leak response

Credential changes are human actions. An agent may prepare the commands, the list of consumers and
the verification steps, and record the result; a human with the authority runs the revoke and issue
steps.

## Scheduled rotation (or on a role change, or after removing a tool)

1. **Inventory consumers**: every job, environment, box and person that uses the credential (the
   role-identity table, the forge's secret usage, the deployment config).
2. **Issue the new credential** with the same or narrower scope. Never widen during a rotation.
3. **Switch consumers** to the new one: update the forge secret or environment, the password
   manager entry, the box's config. Apply, do not hand-edit on a box (rebuild or redeploy).
4. **Verify** each consumer works with the new one (a run, a deploy to dev, a health check).
5. **Revoke the old one.** Then verify the old one fails.
6. **Record** it in the rotation log below.

Short-lived tokens minted per run need no rotation; rotate the thing that mints them (the app's
private key, the federation trust) on its own schedule.

## Leak response (a secret was committed, pasted, logged or read by an untrusted session)

Order matters: revoke first, clean up later. A secret pushed anywhere is compromised, whatever the
repository's visibility and however fast the commit was removed.

1. **Stop the bleeding (minutes).** Revoke or disable the credential at its issuer. If revoking
   breaks production, issue a replacement first, switch, then revoke, but keep the window short.
2. **Assume use.** Treat everything the credential could read as read and everything it could write
   as possibly written. Pull the issuer's audit log for the exposure window: who used it, from where.
3. **Contain.** Pause the agent runs and workflows that held it. If a tool or skill caused it,
   disable that tool everywhere (and run the trifecta checklist before re-enabling).
4. **Rotate** everything in the same blast radius: credentials stored next to it, ones the leaked
   one could read, and the agent's own credential if the agent session was compromised.
5. **Clean the history only after revoking.** Remove the secret from the branch (and from history
   only if policy requires, as a human-approved force-push of that one branch); ask the forge to purge
   cached views if it offers that. Deleting the commit is not a fix.
6. **Find the cause.** How did it get there: a missing deny rule, a scanner gap, an echo in a log, a
   tool with all three trifecta legs? Add the wall that would have stopped it (a deny rule, a
   scanner pattern, a hook), with a test.
7. **Record** an incident entry (what, when, window, impact, actions, the new wall) and a rotation
   log entry. The incident evidence belongs in the project's evidence or decision log.

Attention for the whole response is `needs-human` until step 5 is done.

## Rotation log entry

```markdown
- 2026-10-13 · REVIEWER_FORGE_TOKEN · scheduled · new: app installation token per run replaces PAT ·
  consumers: agent-reviewer workflow · verified: review run 4512 green; old PAT refused ·
  by: maria · next: n/a (per-run token)
```
