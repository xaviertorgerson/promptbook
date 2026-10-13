---
name: promoting-learnings
description: Use when a skill, rule, hook or verified learning should move to a wider scope or out of use — "promote this skill", "make this generic", "kick this up to the pack", "the next project should have this", "install it on all my machines", "deprecate", "retire" or "rename this skill", "pin this pack", "bump the lock" — or when an epic closes and its learnings must be harvested. Do not use for mining run records and failures for lessons (reflecting-on-runs), writing or running a skill's evals (evaluating-skills), or bringing a whole repository or machine onto the harness (adopting-harness).
license: MIT
compatibility: Any agent runtime that reads Agent Skills and works in git with pull requests. Lock and validation checks need Node 22 when the harness tools are present.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Promoting learnings

Good procedures are invented in one project and stay trapped there; promoted carelessly, a project
quirk becomes everyone's rule. Move a learning up one stage at a time, through explicit gates, under
a new name, pinned; and retire what it replaces so nothing lingers and keeps triggering.

## Inputs

- The candidate: a skill folder (`SKILL.md` frontmatter `name`, `description`, `metadata.version`,
  `metadata.layer`; `evals/`), a rule, a hook, a knowledge entry or a decision.
- Its evals: `evals/routing.jsonl`, `evals/scenarios.md`, `evals/evidence.md` (`evidence` contract).
- The destination's registry: the pack's manifest and changelog, or the harness `skills/`.
- Every consumer's `toolkit.lock` (`toolkit-lock` contract) and the L1 skill fan-out list.

## Procedure

Copy the list into your working notes and tick it as you go.

1. **Pick the form with the escalation ladder** ([ladder-and-homes](references/ladder-and-homes.md)):
   an instruction repeated becomes a **rule**; a procedure pasted twice becomes a **skill**;
   something that must happen every time becomes a **hook or gate**; a verified vendor fact becomes a
   **knowledge entry**; a choice with alternatives becomes an **ADR**. Promote the smallest form that
   holds the learning; never a skill where one rule line will do.
2. **Run the generic test.** Strip product names, numbers, prices, people and paths. If what remains is
   still true and useful in a project with another domain, it can go up. If it only makes sense with
   the domain in it, it stays in the project, or goes up as an attributed worked example inside a
   generic entry. Never promote an unverified claim; cite where it was verified.
3. **Choose the next stage and its home.** One stage per change:

   | Stage | Where | Gate to leave it |
   |---|---|---|
   | trial | an untracked folder on one machine | fired usefully at least twice |
   | project | L2 `.agents/skills/<name>/` | routing eval green; one evidence entry |
   | pack | L3 harness `skills/` if engine- and stack-neutral, else an L4 pack | all six gates below |
   | user | L1 fan-out to every machine, through a pin | the owner wants it everywhere |

4. **Check the gates** for pack (and therefore user) with [gates](references/gates.md); record each
   result in the pull request:
   1. generic test passed (step 2);
   2. routing at 100% on the cheapest model in use, near-misses included (evaluating-skills);
   3. scenarios passing at pass^k;
   4. at least three evidence entries from real failures, from two projects where possible;
   5. a security read if it carries hooks, MCP servers, executables or network calls;
   6. portable frontmatter: core fields only, `metadata.layer` set to the destination; engine extras
      in an adapter sidecar.
5. **Rename on promotion.** The promoted copy takes a new name (a gerund for L3, or the pack's prefix)
   and the lower copy is **deleted in the same change**. Never rely on one copy shadowing another:
   engines resolve name collisions in opposite directions.
6. **Generalize the text.** Rules in the generic voice; the source project, date and numbers go in a
   header line or one attributed worked example at the end.
7. **Register and log it.** Add it to the destination's manifest or skill list, and log one changelog
   line classed **additive** (new, nothing changes for consumers), **behavioral** (something
   existing acts differently) or **breaking** (consumers must change something), each with a
   one-line "verify in a consumer" step. An unregistered file never reaches the next consumer.
8. **Land through review.** Work on a branch and open a pull request in the destination repository;
   never push to its default branch, never merge your own pull request.
9. **Move consumers by pin** ([pinning](references/pinning.md)). Each consumer bumps its
   `toolkit.lock` entry (`ref`, `commit`, `tree`, `version`) in its own pull request, which runs the
   eval suite. Third-party packs are mirrored at a pinned commit with `autoUpdate: "off"`.
10. **Retire the old** when the promotion replaces something ([deprecation](references/deprecation.md)):
    1. set `metadata.deprecated` to the reason and the replacement's name, for one minor release;
    2. add a rename entry in the pack's manifest so installers move consumers forward;
    3. add routing cases that **fail if the deprecated skill triggers** on its old prompts, and the
       same prompts as positives in the replacement;
    4. delete it in the next minor release; git history is the archive.

## Outputs

- A pull request in the destination: the promoted artifact under its new name, its `evals/`, the
  registry entry, the changelog line, and the gate table filled in.
- In the source: the deletion of the lower copy, or a deprecation marker, in the same change set.
- Lock-bump pull requests in each consumer; for user scope, the L1 pin change.
- A report: what moved, where it lives, what stayed domain-only and why, the pull request links.

## Gates and stop conditions

Set attention `needs-human` and stop, with the question named, when:

- fewer than three evidence entries come from real failures: do not promote; report the gap (one
  entry written the day the skill was written is enthusiasm, not evidence);
- the generic test is ambiguous (is this a domain rule or a general one?): the owner decides;
- the security read finds code that runs outside the agent's sandbox, network egress, or a credential
  in reach: a human signs the read before it ships;
- someone asks to copy a project skill to user scope under the same name, or to set `autoUpdate` on
  a third-party source: refuse and explain;
- the change would alter or loosen a wall (a deny hook, a permission deny rule, branch protection):
  walls change only by an explicit human request;
- promotion would land on a default branch without review.

## References

- [references/gates.md](references/gates.md): the six gates as a checklist, with what counts as
  passing each.
- [references/ladder-and-homes.md](references/ladder-and-homes.md): the escalation ladder and the
  layer and home for each form.
- [references/deprecation.md](references/deprecation.md): marker, rename entry, failing eval, delete.
- [references/pinning.md](references/pinning.md): `toolkit.lock` entries, mirrors, bumps.
- [references/engine-notes.md](references/engine-notes.md): where precedence and rename maps differ by
  engine (adapters own the mapping).
