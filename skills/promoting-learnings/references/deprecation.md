# Deprecating a skill

Old skills linger and keep triggering. Retire them in two releases, with an eval that proves they
have stopped.

## Release N (minor): mark

1. In the old skill's frontmatter:

   ```yaml
   metadata:
     version: "1.4.0"
     layer: "L3"
     deprecated: "Replaced by debugging-failures (same procedure, engine-neutral). Removed in 1.5.0."
   ```

   The value names the reason, the replacement and the release that removes it.
2. Shrink the old description to a pointer so it stops attracting prompts:
   `Deprecated, replaced by debugging-failures. Do not use for any request (debugging-failures).`
   A deprecated skill is the one case where the description does not open with "Use when".
3. Add a rename entry in the pack's manifest (old name → new name) so installers move consumers
   forward. Where the pack is consumed through `toolkit.lock`, the next bump pull request in each
   consumer carries the change.
4. Rewrite the old skill's positive routing cases as near-misses to the replacement, and add the same
   prompts as positives to the replacement:

   ```jsonl
   {"prompt":"Why is this test flaky?","expect":"no-trigger","kind":"near-miss","route_to":"debugging-failures","note":"deprecated 2026-10-13"}
   ```

5. The routing run fails if the deprecated skill is chosen for **any** prompt in the catalog.
6. Changelog: **behavioral** (consumers see a different skill load), with "verify in a consumer: the
   old prompts load the replacement".

## Release N+1 (next minor): delete

1. Delete the folder; git history is the archive.
2. Remove the old name's routing cases from the replacement only if they are duplicates.
3. Changelog: **breaking** if anything referenced the old name by path or slash command; otherwise
   behavioral.

## Rules

- Never "deprecate" by installing a newer copy under the same name in another scope.
- Never leave a deprecated skill installed "in case": the marker lasts one minor release.
- Retiring outright (no marker) is fine when nothing outside the pack references the skill.
