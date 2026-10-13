---
name: evaluating-skills
description: Use when a skill's routing or behavior needs testing — "write evals for this skill", "add routing cases", "add near-misses", "this skill triggers on the wrong prompts", "does this skill still trigger", "run the skill evals", "add a scenario", "what k should pass^k use", "log evidence for this skill" — or after a skill's description or body changed. Do not use for authoring a new skill's body (building-skills), moving a skill to another layer or deprecating it (promoting-learnings), or a harness-wide effort sweep and removal tests after a model release (reviewing-harness).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Routing runs need a cheap model callable non-interactively; validation needs Node 22 when the harness tools are present.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Evaluating skills

A skill's description is a routing trigger and its body is a procedure; both break silently when
someone edits them. Write and run the three evals that catch it: routing cases, outcome scenarios
graded at pass^k, and an evidence log that records why the skill is the way it is.

## Inputs

- The skill under test: `SKILL.md` frontmatter (`name`, `description`, `metadata.version`,
  `metadata.deprecated`) and body.
- The installed catalog: every skill the runtime would show beside it, names and descriptions only,
  including pinned third-party skills and deprecated ones.
- Its `evals/` folder: `routing.jsonl` and `evidence.md` (the `evidence` contract), `scenarios.md`.
- Real failures that involved the skill: run records, evaluator verdicts, review findings, incidents,
  misroutes a user reported.

## Procedure

Copy the list into your working notes and tick it as you go.

1. **Read the boundary.** From the description, list the triggers it claims and every neighbour its
   "Do not use for" names. Each neighbour gets at least one near-miss.
2. **Write routing cases** in `evals/routing.jsonl`, one JSON object per line
   ([routing-cases](references/routing-cases.md)):
   - at least 4 `positive`: `"expect": "trigger"`, no `route_to`. Phrases users actually type,
     varied: terse, slash-style, symptom-first, long-winded.
   - at least 3 `near-miss`: `"expect": "no-trigger"` with `"route_to": "<neighbour>"`. The prompt
     shares words with this skill but belongs to the neighbour.
   - at least 2 `negative`: `"expect": "no-trigger"`, `"route_to": "none"`.
   - Seed from real prompts and real misroutes first; invent only to fill the counts.
3. **Write scenarios** in `evals/scenarios.md` ([scenarios](references/scenarios.md)): setup, prompt,
   pass criteria on outcomes (end state, files written, gates respected, what was *not* done), and
   `k`. At least three, one of them a stop condition where the correct outcome is a hand-off to a
   human. Pick k by risk: 3 low, 5 medium, 10 high.
4. **Run routing** engine-neutrally ([routing-runner](references/routing-runner.md)). If
   `harness eval-routing` is available, use it. Otherwise, per case, ask a fresh cheap model with no
   tools and no history, given only the catalog and the prompt, which one skill it would load, or
   none. Grade:
   - `trigger`: the answer is exactly this skill's name.
   - `no-trigger`: the answer is not this skill. A `near-miss` answered with a third skill passes
     but is a boundary warning; write it down.
   - A skill with `metadata.deprecated` chosen for any prompt fails the run, whatever the case says.
   - About 20 cases gate a pull request; the full set runs on the default branch and when a new
     model is adopted. After a description change, run each changed skill's cases 3 times; any
     disagreement between runs is a failure.
5. **Run scenarios** at pass^k. Every trial starts in a fresh checkout or sandbox and cannot read an
   earlier trial's history, transcript or commits. Grade the end state, not the sequence of steps. A
   scenario passes only when all k trials pass; report it as `n/k`, never as the best run.
6. **Read the results** with the table below and fix the cause, not the case.
7. **Record evidence** in `evals/evidence.md` ([evidence-entries](references/evidence-entries.md)): a
   dated entry when a real failure taught something or a measurement changed a decision. A
   `measured` entry names the command and commit in `Source`, plus `Engine`, `Model` and
   `Skill version`. Write the rule for the class of failure; the instance goes in the entry.
8. **Validate** with `node tools/validate.mjs skills/<name>` (or `harness validate`) when the harness
   tools are present. Every routing line and evidence entry must conform.

| Result | What it means | Fix |
|---|---|---|
| positive missed | the description lacks the user's words | add trigger words; never add a procedure summary |
| near-miss triggered | the boundary is too wide | sharpen "Do not use for" here and the neighbour's triggers there; add the case to both skills |
| runs disagree | two skills both fit the prompt | decide the owner (a stop condition) and write the boundary into both descriptions |
| a cheap router ignores "Do not use for" | it routes on overlapping trigger words | put the deciding feature in the first clause of the owner's description and the neighbour's distinguishing words in the neighbour's triggers |
| scenario passes fewer than k times | a body step is ambiguous | rewrite that step; add a case for the failure seen |
| scenario passes with and without the skill | it measures nothing | delete it and say why in `evidence.md` |
| deprecated skill chosen | its description still attracts prompts | fix the replacement's triggers and the deprecated description (promoting-learnings) |

## Outputs

- `skills/<name>/evals/routing.jsonl`, `scenarios.md`, `evidence.md`, conforming to `evidence`.
- A results table (case, expected, got, pass; scenario, n/k) in the pull request or hand-back. Numbers
  that justify a change become a `measured` evidence entry.
- When dispatched as a subagent: a `return` whose `verification` lists each suite run with
  `pass | fail | skipped`.

## Gates and stop conditions

- **100% routing** on the cheapest model in use, near-misses included, before a description change
  ships. Below that, it does not ship: hand back the failing cases.
- **Never weaken an eval to pass.** Deleting or flipping a case needs an evidence entry saying why
  the old expectation was wrong; "it kept failing" is not a reason.
- **Curated, not self-written.** Cases and skills an agent drafted count only after a human has
  reviewed them.
- Set attention `needs-human` and stop when:
  - two skills both plausibly own a prompt and neither description settles it (the owner decides);
  - a scenario needs a real secret, production access, or a paid or outbound external action;
  - a failure points at a wall (a deny hook or permission rule): walls are not tuned by evals.

## References

- [references/routing-cases.md](references/routing-cases.md): the routing line format, its rules,
  examples, and the deprecated-skill rule.
- [references/scenarios.md](references/scenarios.md): scenario template, k by risk, grading and
  isolation.
- [references/routing-runner.md](references/routing-runner.md): the engine-neutral router prompt,
  grading code sketch, reading results.
- [references/evidence-entries.md](references/evidence-entries.md): entry format, kinds, required
  fields.
- [references/engine-notes.md](references/engine-notes.md): non-interactive model calls per engine
  (adapters own the mapping).
