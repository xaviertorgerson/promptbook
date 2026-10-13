# Components: candidates and walls

## Candidates (compensate for what a model could not do alone)

| Component | Disable for the ablation by | Typical sign it is no longer load-bearing |
|---|---|---|
| a skill | removing it from the installed catalog for the run | routing and scenarios unchanged; the model does the procedure unprompted |
| an instruction block or rule section | deleting the block from the instruction file for the run | the rule is followed anyway, or never exercised |
| a subagent role (explorer, test-runner, a second reviewer) | routing its work to the main agent | same outcomes, lower cost |
| a review round, self-critique pass, or planning pass | skipping the round | same evaluator pass rate on the first round |
| a loop shape (context resets, sprint splits, a fresh session per step) | one continuous session with the engine's compaction | same outcomes, less wall time |
| an advisory hook (warns, adds context, never denies) | disabling that hook only | no behavior change on the cases it targets |
| an advisor or second model | running the executor alone | the advisor is rarely consulted or adds nothing |
| per-role model and effort defaults | the sweep itself | a cheaper model or lower effort scores within noise |

## Walls (never candidates)

They protect against rare events an eval suite does not sample; their absence would not show in the
numbers until the day it matters.

- deny hooks and permission deny rules (destructive commands, protected paths, secret reads);
- secret scanning at any rung, and the deny-read rules for secret-bearing paths;
- branch protection, required reviews, required checks, code owners;
- sandbox, network egress allowlists, the no-prompt mode plus allowlist of unattended runs;
- budget, turn, depth and no-progress caps (re-tune from data; never remove);
- the human gates: spec approval, pull-request approval, production release;
- test gates and criterion coverage (ENG-1): a test is never removed to save cost.

If a wall looks redundant, the right output is a question for a human, never an ablation.

## Inventory

List every candidate before ablating, with where it lives and why it was added (its ADR, evidence
entry or commit). A component whose origin is an incident is ablated only with the incident's case
in the suite.
