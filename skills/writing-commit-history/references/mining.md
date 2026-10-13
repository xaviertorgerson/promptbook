# Mining history

| Question | Query |
|---|---|
| what happened recently | `git log --oneline -20`; `git log --graph --oneline --all -30` for branch shape |
| why does this feature exist | `git log --grep '<task id or keyword>' --format='%h %ad %s' --date=short`, then `git show <hash>` |
| what implemented a decision | `git log --grep 'ADR-0019'` |
| who and why for this line | `git blame -w -C -L <start>,<end> <file>`, then `git show <hash>` |
| when did this string appear or vanish | `git log -S '<string>' --oneline -- <path>`; `-G '<regex>'` for regex |
| history of one file, across renames | `git log --follow --oneline -- <path>` |
| what changed in an incident window | `git log --since='<start>' --until='<end>' --oneline`; add `--stat` |
| what landed on the default branch | `git log --first-parent --merges --oneline <default-branch>` |
| which commit broke it | `git bisect start <bad> <good>; git bisect run <repro>; git bisect reset` |
| what a task's commits did | `git log --grep '<task id>' --stat` |

Rules:

- Read the message before inferring intent from the diff; the why is usually written down.
- Cite what you found: hash, date, subject, and the line of the body that answers the question.
- When the history is silent (a squash with no body, a "wip" commit), say so and say what you would
  need; do not fill the gap with a plausible story.
- History is read-only here: no rebase, amend, reset or force-push while mining.
