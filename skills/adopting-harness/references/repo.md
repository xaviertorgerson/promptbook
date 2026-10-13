# A repository (L2) in detail

## toolkit.lock

Shape (`toolkit-lock` contract 1.1.0): `lock_version: 1`, optional `generated_at`, `generated_by`,
and `entries[]` of `{name, layer, kind, source, path, ref, commit, tree, version, autoUpdate,
mirrored}`. Names are unique; exactly one L3 entry is the harness (`kind: harness`, or no kind);
other L3 entries are `kind: skill-library`; L4 entries are engine-binding, stack-pack, runtime or
domain-pack.

Without the lock tool, resolve each entry by hand:

```sh
git ls-remote <source> refs/tags/<ref>          # or refs/heads/<branch>: the commit
git -C <clone> rev-parse <commit>^{tree}        # tree of the whole repo
git -C <clone> rev-parse <commit>:<path>        # tree of a subdirectory, when `path` is set
```

`commit` and `tree` are full 40- or 64-hex ids. The tree id detects a rewritten tag or a
force-pushed mirror. `autoUpdate`: `off` for anything third-party or mirrored; `patch` or `minor`
for your own packs. A third-party portable skill library is an L3 entry with `kind: skill-library`
(the lock holds exactly one `harness` and any number of skill libraries). A source with no releases
still needs a semver `version`; record `0.0.0+<short commit>` until it tags one.

Validate: `node tools/validate.mjs toolkit.lock`. In CI, compare the lock to what is installed and
fail on drift.

## The instruction map

```
# <Project>                      ← one paragraph: what it is, the pipeline, what's live
## North star                    ← the intent, pinned
<!-- standards:begin v1 -->      ← rendered from the pinned harness; never hand-edited
## Engineering invariants ...
<!-- standards:end -->
## Domain rules                  ← the handful of invariants only this project has
## Commands                      ← how to install, test, lint, validate, run
## Pointers                      ← where docs, specs, ADRs, playbook links are
```

Loader shims, one per engine (paths in `engine-notes.md`): a one-line import of `AGENTS.md`, or a
settings key naming it. Nothing else goes in a shim.

## Validation sequence

1. `node tools/validate.mjs specs DECISIONS.md` — every artifact against its contract.
2. `node tools/validate.mjs --trace . --tests "<test globs>"` — the trace graph; legacy adoption
   (no `docs/product/brief.md`) reports missing links as warnings.
3. Fix errors now; fix warnings as tasks are touched (the trace prints the exact
   `requirements: [...]` line where it can).
4. Add both to CI; flip `--strict` once the warnings are gone; generate readiness reports with
   `--readiness <dir>` at the spec gate.

## Deletions (what the layers now own)

| Found in the repo | Owner now | Action |
|---|---|---|
| rules restating the engineering invariants (tests, secrets, destructive actions, landing, commits, explicit failure, boundaries) | the standards block | delete the prose copies; render the block |
| taste rules (comment density, least abstraction, dead code, tool choice) not enforced by a linter | L1 | delete from L2; keep where a linter enforces them |
| doctrine docs restating the playbook (workflow states, concurrency, observability) | the playbook and contracts | keep project-specific parts, link the rest |
| scripts the validator supersedes (criteria lint, criteria coverage) | the validator | delete once CI runs the validator with the same checks |
| a version-pin file for the template or packs | `toolkit.lock` | delete after the lock is in CI |
| copies of skills that were promoted to the harness | the harness, pinned | delete the copy in the same change as the pin |
| engine-specific rule files that only some engines read | nested `AGENTS.md` from the stack pack | move |
| stack-specific rules, docs, workflows mixed into the generic layer | the stack pack (L4) | move |

Never delete: domain rules, ADRs, product docs, the task queue, or anything the owner has not seen
on the classification table.

## Walls checklist (per engine the project supports)

- secret files: deny read and write by path; secret scanning in CI;
- destructive shell, SQL and infrastructure commands: deny;
- force-push and push to the default branch: deny, plus branch protection;
- writes (including shell redirects) into protected paths: deny;
- each one probed: the deny case blocks, a benign case runs (`walls.md`).
