# Conflict classes: mechanical vs semantic

Ported from agentic-template `scripts/conflict-classify.mjs` (commit bbfad58), the merge agent's
gate: exit 0 only if every conflicted file is mechanical, exit 1 (a human merges) if any is
semantic. Conservative by design: anything not confidently mechanical is semantic. One rule is
corrected below after a measurement.

Get the conflicted files with `git diff --name-only --diff-filter=U`. Merge with
`-c merge.conflictstyle=diff3` (or `zdiff3`) so each hunk shows the common base; the correction
needs it.

## The table (first matching row wins, per file)

| # | File or hunk | Class | Resolution | Ported rule |
|---|---|---|---|---|
| 1 | A lockfile: `package-lock.json`, `pnpm-lock.yaml`, `npm-shrinkwrap.json`, `yarn.lock`, `Cargo.lock`, `go.sum`, `poetry.lock`, `composer.lock`, `Gemfile.lock` (any directory) | mechanical | regenerate from the merged manifest with the project's install command; never pick a side, never hand-merge | `LOCKFILE` regex |
| 2 | Generated or build output: a path segment `dist/`, `build/`, `out/`, `coverage/`; a name containing `.generated.`; a `.snap` file | mechanical | regenerate with the project's generator or test update command; never hand-merge | `GENERATED` regex |
| 3 | A generated projection the project declares (a board file rebuilt from task files) | mechanical | regenerate | the template's "regenerate the board" step |
| 4 | Unreadable or binary file | semantic | a human | `unreadable / binary` |
| 5 | Text file with no conflict markers (add/add of binaries, rename/delete, mode or submodule gitlink conflicts) | semantic | a human | `no textual conflict markers` |
| 6 | Every hunk identical on both sides (after trimming whitespace at the ends) | mechanical | take either side | `identical` |
| 7 | **Correction:** a hunk where one side is empty and the base is not empty (one side deleted lines the other side kept or changed) | semantic | a human | not in the original classifier |
| 8 | Every hunk one-sided, and in each the empty side's base is empty too (only one side added lines) | mechanical | take the side that added | `one-sided` |
| 9 | Any hunk where both sides are non-empty and differ (overlapping logic) | semantic | a human; never pick a side | `overlapping hunk(s)` |
| 10 | A task file's frontmatter (`status`, `owner`), or any file on the project's protected list (hooks, permission rules, CI workflows, owner files) | semantic | a human | a task's status lives on its branch and the default branch's copy changes only by a human or a landing, so a conflict there means a human edited it; walls change only by human review |
| 11 | Anything else, or any doubt | semantic | a human | "unknown → semantic" |

The PR as a whole is mechanical only if every conflicted file is.

## Why row 7 exists (measured 2026-10-13, git 2.43)

Base `a b c d e`. One branch deleted `c`; the other changed `c` to `C-CHANGED`. The merge produced
a hunk with an empty HEAD side and `C-CHANGED` on the other, and the original classifier reported
"MECHANICAL — all hunks one-sided or identical" in both default and diff3 styles. Its rule "take
the present side" would silently undo the deletion. A second probe (one side deleted `c`, the
other inserted a line after `c`) was also classified mechanical. In default style the base is not
shown, so the two cases cannot be told apart from a pure insertion: use diff3 style, and treat an
empty side over a non-empty base as semantic. Reported upstream as a classifier gap; the template's
script is unchanged.

## After a mechanical resolution

1. Commit the resolution on the PR branch with a message listing each file and its row.
2. Re-run the full required checks on the merged result, not only the PR's last run.
3. The head changed: list the resolution commit in the land record. If anything beyond rows 1, 2,
   3, 6 or 8 changed, the independent review must cover the new head before landing.

## On a semantic conflict

1. `git merge --abort` (or abort the rebase). Leave the PR branch as it was.
2. Label the PR for a human merge and comment: the files, the row that made each semantic, and the
   overlapping hunks' locations.
3. Record `return-to-human` (`merging` → `human-review`) with the reason in the agent log.
4. Attention `needs-human`, `next_action`: "Resolve the semantic conflict in <files> on PR <n>".
