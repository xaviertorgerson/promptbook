---
name: writing-commit-history
description: Use when writing or fixing a commit message, splitting work into commits, or reading history to answer a question — "write a commit message", "split this into commits", "why did X change", "when did this change", "who introduced this line", "read the history", "what does git log say about…". Writes history a future agent can reconstruct the why from, and mines it before guessing. Do not use for a stack's whole definition of done (an L4 pack's ship skill), writing pull request text (preparing-pull-requests), or merging and landing a branch (landing-changes).
license: MIT
compatibility: Any agent runtime that reads Agent Skills and works in git.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Writing commit history

Git history is the project's durable chronology and the agent's long-term memory: a fresh session
knows only what the files and the log tell it. Write commits so a future reader can reconstruct why,
and read the history back before guessing.

## Inputs

- The staged and unstaged changes (`git status`, `git diff`, `git diff --staged`).
- The task the change belongs to (`task` contract: `id`, `status`), its criteria (`AC-n`), the
  requirements it cites (`REQ-n`, `NFR-n`), and any decision it applies (`ADR-nnnn`).
- The project's own commit conventions (types, scopes, trailers), if it states them.

## Procedure: writing

1. **One logical change per commit.** Stage intentionally (`git add -p` for mixed work, explicit
   paths otherwise); never blanket-add unrelated files. A refactor, a fix and a behavior change are
   three commits. A status transition of a task file may share the commit with the work it records.
2. **Subject:** Conventional Commits, `type(scope): summary` ([message-format](references/message-format.md)).
   Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `revert`.
   Imperative, about 72 characters at most, no trailing period. `!` after the scope, plus a
   `BREAKING CHANGE:` footer, for a breaking change.
3. **Body explains why**, not what (the diff is the what): the problem or force, the cause, the
   decision and what was rejected or traded away. Wrap at about 72 columns.
4. **Reference the contracts** in a final paragraph: the task id (`BILL-7`), the criteria it satisfies
   (`AC-1, AC-2`), the requirement (`REQ-3`) and decision (`ADR-0019`) it implements, the incident
   or run it fixes. A commit that moves a task's status says which transition it is
   (`BILL-7: in-progress → review`).
5. **Never include** secrets, tokens, internal URLs with credentials, personal data, build artifacts,
   or AI or assistant attribution lines.
6. **Write multi-line messages with a heredoc or a file**, never fragile inline quoting.
7. **Before committing**, check the staged diff is exactly the logical change, and that the
   project's lint, type and test gates pass (or say which you could not run).

## Procedure: reading

Before answering "why is this the way it is", read the history ([mining](references/mining.md)):

1. `git log --oneline -20` for the recent shape; `git log --grep '<term>'` (task id, ADR id, keyword)
   to find when and why something landed.
2. `git log -- <path>` for one file's history; `git log -S '<code>'` for when a string appeared or
   left; `git blame -w -C <file>` for a line's origin, then `git show <hash>` for the full message.
3. `git log <since>..<until>` for an incident window; `git log --merges --first-parent` for what
   landed on the default branch.
4. Answer with the commit (hash, subject, the relevant line of its body) and say when the history
   does not answer the question; do not invent a reason.

## Outputs

- Commits: one logical change each, Conventional subject, a why-body, contract references.
- For a reading question: the answer with the commits cited.

## Gates and stop conditions

- Never rewrite published history: no force-push to a shared branch, no amending or rebasing commits
  others have pulled, no history surgery to remove a mistake (a secret that reached a remote is
  rotated first, then removed by a human-run procedure).
- Never commit to the default branch directly; commits land through a reviewed pull request
  (landing-changes).
- Set attention `needs-human` and stop when:
  - the staged diff contains something that looks like a secret or personal data;
  - the work cannot be split into logical commits without the author's intent (ask which is which);
  - a commit message would need to state a decision nobody has made.

## References

- [references/message-format.md](references/message-format.md): the format, types, footers, worked
  examples.
- [references/mining.md](references/mining.md): history queries by question.
