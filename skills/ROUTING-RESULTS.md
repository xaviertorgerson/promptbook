# Routing results

As of 2026-10-13. How the 28 harness skill descriptions route on the cheapest model, with the five
pinned Skilldex skills (commit fc572b6: building-skills, preparing-pull-requests,
resolving-findings, reviewing-code, writing-specifications) installed beside them as distractors.
Re-run when any description changes, a skill is added or removed, or the routing model changes.

The per-case results, one evidence-contract `routingResult` line per case with every trial's
answer (`harness validate` checks them):

| File | Cases | What |
|---|---|---|
| skills/routing-results-2026-10-13.jsonl | 344 | the final tuned run (each skill's evals/routing.jsonl) |
| skills/routing-results-heldout-full-2026-10-13.jsonl | 84 | held-out cases, every harness skill installed |
| skills/routing-results-heldout-personal-2026-10-13.jsonl | 15 | held-out cases, only the personal set installed |

## Result

| | Original descriptions | Current descriptions |
|---|---|---|
| Characters, all 28 | 22,746 (627–998 each) | 7,899 (248–300 each) |
| Fits the 8,000-character always-loaded budget (Codex: 2% of context or 8,000 characters) | no | yes |
| Cases passed, 344 cases × 3 trials | 1015/1032 (98.4%) | **1027/1032 (99.5%)** |

Both columns ran the same cases through the same runner on the same day. Model: haiku
(claude-haiku-5-5), effort low. Per case, all three trials passed (pass^3) for 341 of the 344.

These are the cases the descriptions were tuned against, so they overstate how the descriptions
route prompts nobody tuned for; the held-out run below measures that.

## Held-out cases

Written after the descriptions were final and never used to change one: three per skill in
`evals/heldout.routing.jsonl`, two positives in words the skill's routing.jsonl does not use and one
near-miss naming the skill that should load instead, each with the note "held out". Same runner,
model and effort; 3 trials per case.

| Catalog | Characters | Cases | pass^3 | Trials |
|---|---|---|---|---|
| full: the 28 harness skills and Skilldex | 9,573 (the library; never installed whole) | 84 | **80/84 (95.2%)** | 245/252 (97.2%) |
| personal and Skilldex: what every machine loads | 2,993 | 15 (the personal skills' own) | **14/15 (93.3%)** | 42/45 (93.3%) |

Positives passed 55/56 (full) and 10/10 (personal); near-misses 25/28 and 4/5. Against the tuned
cases' 341/344 (99.1%), the held-out pass^3 is four points lower on the full catalog.

| Catalog | Case | Passed | Got | Reading |
|---|---|---|---|---|
| full | delegating-authority near-miss "GRANT-9 covers it; go ahead and merge PR 311 into integration/search." → landing-changes | 0/3 | delegating-authority beside landing-changes, every time | the right skill loads, and naming a grant pulls the grant skill in beside it; landing-changes checks the grant itself, so this costs context rather than routing wrong, but the case forbids it |
| full | choosing-architecture near-miss "Inside BILL-14, should the helper return null or throw when the rate is missing?" → implementing-task | 1/3 | implementing-task once, none twice | nothing wrong loads; an in-task design question twice read as needing no skill |
| full | defining-personas near-miss "PER-1 and PER-2 are settled; now describe what each must be able to do end to end, and what must never go wrong." → mapping-journeys | 2/3 | defining-personas beside mapping-journeys once | the persona ids pull the persona skill in |
| full | promoting-learnings positive "Retire old-commit-style; writing-commit-history covers everything it did." | 2/3 | the pinned building-skills alone once, beside promoting-learnings twice | retiring a skill reads as skill authoring to building-skills' broad description |
| personal | reviewing-security near-miss "Our deploy key leaked into a build log; rotate it and stop it happening again." → handling-credentials | 0/3 | reviewing-security | handling-credentials is a delivery skill, not installed beside personal; with it installed (full) the case passes 3/3. Without it the security review is the closest installed skill, so the miss is the case assuming its neighbour, not the description |

None of the misses was fixed: a held-out case changed to pass would no longer be held out. The
next tuning round may use them, and then needs fresh held-out cases.

## How it ran

```
RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill <name> --runner "node router.mjs" --json
```

with `$SKILLDEX` a clone of https://github.com/QuentinTorg/skilldex at fc572b6 and router.mjs the
runner printed verbatim in evaluating-skills/references/engine-notes.md, once per skill per trial
(28 × 3 invocations, run in parallel), aggregated by summing each run's true/false positives and
negatives per skill and folded into skills/routing-results-2026-10-13.jsonl. The held-out runs used
the same runner in one invocation per skill:

```
RR_MODEL=haiku RR_EFFORT=low node tools/cli.mjs eval-routing skills "$SKILLDEX/skills" --skill <name> \
  --cases heldout.routing.jsonl --runs 3 --model claude-haiku-5-5 --runner "node router.mjs" --out <name>.jsonl
```

and the personal run adds `--set personal`, which keeps only that set of this folder installed
(Skilldex stays, being another folder). The router prompt is the tool's: every installed
skill's name and description, the user's message fenced in `<message>`, "which skill or skills
would you load, or none". A trigger case passes when its skill is named; a no-trigger case when it
is not, and a near-miss also needs its `route_to` named when that skill is installed (`none`:
nothing named). A skill named beside a neighbour's positive lowers its precision without failing a
case.

The runner is a headless engine call (`-p --model haiku --effort low --output-format json --tools ""
--no-session-persistence --strict-mcp-config --safe-mode --disable-slash-commands --no-chrome`)
with the prompt's instructions and catalog as the system prompt, cached across cases, and the fenced
message as the user turn. It starts in an empty directory with an environment reduced to PATH,
HOME, the proxy and CA variables and the authentication variables. Both matter:

| Runner context (original descriptions; the cases as of each run) | Pass |
|---|---|
| inherited the hosting agent session's environment and effort, started in this repository | 860/1020 (84.3%) |
| reduced environment, effort low, started in this repository | 968/1032 (93.8%) |
| reduced environment, effort low, empty directory | 1015/1032 (98.4%) |

The session's environment carried its reminders (account email, commit attribution, the host's
notes on saving skills) and an effort override into every call; the repository put its git status
and recent commits in the environment block, which pulled acceptance-criteria questions toward code
review. Both looked like description overlap. The rule is now in
evaluating-skills/references/routing-runner.md (rule 6) and the setup in its engine-notes.md.

## Runs, in order

| Run | Descriptions | Runner | Pass | What it showed |
|---|---|---|---|---|
| baseline | original, 22,746 | session environment, repository | 860/1020 (84.3%) | the starting point under a noisy runner |
| v3 | first cut, 7,612 | same | 858/1020 (84.1%) | a third of the size routes no worse |
| v4 | 7,795 | same | 874/1026 (85.2%) | exclusion words attract their prompts |
| v5 | 7,804 | reduced environment, repository | 971/1032 (94.1%) | most of the noise was the session's context |
| v8 | 7,780 | same | 712/759 (93.8%), stopped | — |
| v10b | 7,859 | same | 967/1032 (93.7%) | original descriptions, same runner: 968/1032 |
| v10b | 7,859 | reduced environment, empty directory | 999/1032 (96.8%) | the repository's status was the rest; original: 1009/1032 |
| final | 7,899 | same | 1027/1032 (99.5%) | original descriptions, same cases: 1015/1032 |

Between runs, failing prompts were iterated on in small probes (2–3 runs per prompt per candidate
description), not in full runs. Cases changed along the way are listed below.

## Per skill (final run)

Own cases: the skill's routing.jsonl, 3 trials. Precision and recall over every case in the
catalog: a skill is expected on its own positives and on other skills' near-misses routed to it.

| skill | chars before → after | own cases pass | precision | recall | original descriptions: pass · precision · recall |
|---|---|---|---|---|---|
| adopting-harness | 882 → 298 | 45/45 | 100% | 96% | 42/45 · 77% · 100% |
| checking-plan-readiness | 902 → 289 | 33/33 | 100% | 100% | 33/33 · 96% · 100% |
| choosing-architecture | 981 → 296 | 33/33 | 100% | 100% | 33/33 · 100% · 100% |
| choosing-methodology | 854 → 300 | 38/39 | 91% | 100% | 39/39 · 100% · 100% |
| debugging-failures | 737 → 251 | 36/36 | 98% | 100% | 34/36 · 100% · 100% |
| defining-personas | 627 → 259 | 27/27 | 100% | 100% | 27/27 · 100% · 100% |
| delegating-authority | 825 → 295 | 42/42 | 81% | 100% | 42/42 · 81% · 100% |
| designing-flows | 778 → 288 | 30/30 | 100% | 100% | 30/30 · 100% · 100% |
| evaluating-skills | 578 → 248 | 39/39 | 100% | 100% | 39/39 · 92% · 100% |
| framing-products | 676 → 269 | 39/39 | 100% | 100% | 39/39 · 100% · 100% |
| handling-credentials | 998 → 296 | 36/36 | 77% | 100% | 36/36 · 80% · 100% |
| implementing-task | 773 → 275 | 45/45 | 87% | 92% | 45/45 · 92% · 92% |
| landing-changes | 952 → 288 | 33/33 | 72% | 100% | 33/33 · 72% · 100% |
| managing-worktrees | 773 → 282 | 33/33 | 89% | 100% | 33/33 · 100% · 100% |
| mapping-journeys | 717 → 290 | 33/33 | 97% | 100% | 33/33 · 100% · 100% |
| orchestrating-work | 905 → 295 | 48/48 | 65% | 100% | 47/48 · 83% · 97% |
| planning-work | 890 → 289 | 39/39 | 88% | 100% | 39/39 · 97% · 100% |
| promoting-learnings | 716 → 293 | 39/39 | 100% | 100% | 39/39 · 100% · 91% |
| reflecting-on-runs | 763 → 297 | 33/33 | 96% | 100% | 29/33 · 77% · 100% |
| releasing-changes | 959 → 277 | 33/33 | 96% | 100% | 33/33 · 77% · 100% |
| reporting-state | 857 → 282 | 39/42 | 73% | 100% | 39/42 · 67% · 100% |
| reviewing-harness | 731 → 267 | 33/33 | 94% | 100% | 33/33 · 97% · 100% |
| reviewing-security | 765 → 280 | 36/36 | 80% | 100% | 36/36 · 92% · 100% |
| routing-models | 919 → 298 | 38/39 | 100% | 100% | 39/39 · 94% · 100% |
| verifying-work | 811 → 288 | 42/42 | 100% | 100% | 38/42 · 97% · 92% |
| writing-commit-history | 804 → 291 | 33/33 | 86% | 100% | 33/33 · 95% · 100% |
| writing-requirements | 910 → 269 | 36/36 | 100% | 100% | 36/36 · 98% · 100% |
| writing-tests | 663 → 249 | 36/36 | 100% | 100% | 36/36 · 95% · 100% |
| reviewing-code (pinned) | — | — | 50% | 100% | — · 38% · 100% |
| preparing-pull-requests (pinned) | — | — | 30% | 100% | — · 33% · 100% |
| building-skills (pinned) | — | — | 100% | 100% | — · 100% · 100% |

The low precisions (orchestrating-work, landing-changes, reporting-state) are co-loads on a
neighbour's positive, for example orchestrating-work named beside implementing-task on "keep
going on the ready tasks". No case fails for them; they cost context.

## Remaining misses

| Case | Missed | Why |
|---|---|---|
| reporting-state near-miss "BILL-7's criteria pass; open the draft PR and move it to review." → implementing-task | 3/3 | the router hands it to the pinned preparing-pull-requests (opening a draft PR is that skill's draft mode, which implementing-task itself calls for the PR text); reporting-state stays out, so the boundary the case tests holds |
| choosing-methodology negative "What research methodology should my survey study use?" | 1/3 | "methodology" is this skill's own word; the other two runs answered none |
| routing-models near-miss "Set this laptop to auto-edit and the devbox to autonomous." → adopting-harness | 1/3 | delegating-authority answered once (an autonomy question read as authority); routing-models stayed out every time |

## Cases changed during the runs

Every changed case carries a `note` with its old label.

- **Added for the measured overlaps:** a toolkit.lock pin bump is promoting-learnings', not
  adopting-harness' (the original descriptions miss it 3/3); "cover AC-3 of BILL-7 with a test" and
  "which acceptance criteria are untested" are writing-tests', not verifying-work's; a flaky test and
  "cover AC-3 with a test" are not implementing-task's.
- **Relabeled where the catalog contradicted the label:** a failing unit test and an off-by-one fix
  are debugging-failures' (were route none); "write a commit message" is writing-commit-history's
  (was none); the engine's settings key for a subagent model is routing-models' (was a near-miss to
  adopting-harness); "Ship it.", a plain code change, a performance review and printing the git log
  assert only that their own skill stays out, since a pinned skill or a neighbour may reasonably
  take them.
- **Moved to the skill that must load first:** approving production releases and setting up an
  integration branch "so tasks land without me approving each one" became delegating-authority
  positives; dispatching "under GRANT-7" became an orchestrating-work positive.
- **Rewritten:** "Move BILL-7 to human-review" routed to implementing-task, which never makes that
  move; the near-miss now asks for the move it does make.
- **Added to keep minimum counts:** four negatives (HTTP 418, a German translation, boiling an egg,
  a podcast).

## Install sets

What each install set of skills/SETS.yaml loads into the always-loaded catalog, description
characters, with the five Skilldex skills (1,674) loaded beside every set and the personal set
beside every project set. The budget is 8,000 less 10% headroom: 7,200. `harness lint skills`
checks every set (set-over-budget); `harness lint --budget-set <set>` prints one.

| Set | Scope | Harness skills | Loads | Fits |
|---|---|---|---|---|
| personal | user | 5 | 2,993 | yes |
| planning | project | 8 | 5,242 | yes |
| delivery | project | 6 | 4,699 | yes |
| coordinator | project | 5 | 4,463 | yes |
| maintainer | project | 4 | 4,148 | yes |
| solo (personal, planning, delivery) | user | 19 | 6,948 | yes, 252 to spare |
| full | library | 28 | 7,899 alone, 9,573 with Skilldex | never installed |

Project sets combine: planning and delivery together load what solo does (6,948), and delivery with
coordinator 6,169; any three project sets exceed 7,200 (planning, delivery and coordinator: 8,418),
so one place installs at most two: a project running a coordinator installs delivery and coordinator
where agents build, and planning where plans are written. A machine that also installs a runtime's skill counts it
too: the multiplexer's skill (328 characters) beside solo makes 7,276, under 8,000 but inside the
headroom, so such a machine checks its own list (`harness lint --budget-set <profile>.skills`) and
leaves out a set it does not use.

## Spend

About $1.80 for the whole exercise at the CLI's list prices: $1.66 logged across 12,629 calls
(eleven full runs of about 1,030 calls at $0.07–$0.30 each, one stopped early, and probes), plus roughly $0.15 of
early probes that were not logged. A full run costs about $0.08 with the cached catalog. The
held-out runs cost $0.027 (252 calls on the full catalog, $0.024; 45 on the personal one, $0.003).
