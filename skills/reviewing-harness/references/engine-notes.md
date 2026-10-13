# Engine notes: model and effort selection for sweeps

The procedure is engine-neutral; the adapters own the exact flags and settings. Check them before a
review, because effort levels and defaults change with model releases.

## Claude models (Claude Code, the API)

- Effort is a request setting with levels from low to max; the documented default differs by model,
  and on some recent models omitting it runs a level lower than on their predecessors. Record the
  effort explicitly for every run instead of relying on the default.
- Anthropic's cost guidance says to sweep effort on the strong model alone first; that run is the
  baseline any multi-model setup must beat.
- Changing effort mid-session invalidates part of the prompt cache; set it per run.

## Codex and OpenAI models

- Reasoning effort is set per run or per subagent definition. OpenAI's guidance for its latest model
  is to prune prompts one instruction group or tool at a time against evals, which is the same
  ablation discipline.

## Gemini CLI and Antigravity

- Model choice is per run; effort controls, if any, are in the installed version's settings. Not
  verified here.

## Any engine

Record `engine`, `model` and effort in every run record of the review so the report's numbers can be
reproduced.
