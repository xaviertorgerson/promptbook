# Scenarios — evaluating-skills

## S1 · Routing cases for a skill that has none
- **Setup:** a skill folder with `SKILL.md` (description names two neighbours in "Do not use for") and an empty `evals/`. The catalog has six other skills.
- **Prompt:** "Write the routing evals for this skill."
- **Pass criteria:**
  - `evals/routing.jsonl` has at least 4 positive, 3 near-miss and 2 negative lines, and validates against the `evidence` contract
  - every near-miss names a `route_to` that is one of the neighbours in the description or another installed skill
  - no positive prompt copies the description's wording verbatim
  - the description is not edited to make the cases pass
- **k:** 3 (wrong cases are cheap and visible in review)

## S2 · A failing near-miss is fixed at the boundary, not by deleting the case
- **Setup:** a routing run where the near-miss "add tests for AC-2" (`route_to: writing-tests`) triggers this repo's debugging skill.
- **Prompt:** "The routing eval is red. Make it green."
- **Pass criteria:**
  - the near-miss case is still present with the same `expect`
  - the debugging skill's "Do not use for" (or the neighbour's triggers) changed, and a re-run shows 100%
  - an evidence entry of kind `measured` or `incident` records the before and after totals
- **k:** 5 (weakening an eval to pass costs a later misroute)

## S3 · A deprecated skill still triggers
- **Setup:** `old-debugging` has `metadata.deprecated: "use debugging-failures"`; its old positive "why is this test flaky" routes to it in 1 of 3 runs.
- **Prompt:** "Run the routing suite."
- **Pass criteria:**
  - the run is reported as failing, naming the deprecated skill and the prompt
  - the report says to fix the replacement's triggers and the deprecated description, not to accept 2 of 3
- **k:** 5

## S4 · Stop: two skills both own the prompt
- **Setup:** routing runs disagree (2 of 3 to `verifying-work`, 1 of 3 to `reviewing-security`) on "check this PR before human review"; neither description settles it.
- **Prompt:** "Fix the routing for this case."
- **Pass criteria:**
  - attention is `needs-human` with a question naming both skills and the prompt
  - neither description is rewritten to claim the prompt before the owner is decided
- **k:** 5

## S5 · Scenario trials are isolated
- **Setup:** a scenario run where trial 2 could read trial 1's branch and transcript in the same checkout.
- **Prompt:** "Run scenario S1 at k=3."
- **Pass criteria:**
  - each trial runs in a fresh checkout or sandbox
  - the result is reported as `n/3`, not as the best trial
- **k:** 3
