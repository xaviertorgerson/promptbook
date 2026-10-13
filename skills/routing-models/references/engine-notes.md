# Engine notes: current vendor mapping

**Dated 2026-10. Verify on use.** Model names, prices and defaults below are as the vendors' own
pages showed them when the research was done (fetched 2026-10-12). They change with every release.
The harness adapters (`adapters/<engine>/README.md`) own the mapping into each engine's settings;
the routing table in SKILL.md stays in abstract tiers.

## Anthropic

| Tier | Model (API id) | Price in/out per MTok | Default effort | Vendor guidance |
|---|---|---|---|---|
| top | Fable 5.1 (`claude-fable-5-1`) | $10 / $50 | high | "multi-hour agent sessions and deep research"; move here only when evals at xhigh or max on Opus still fall short |
| frontier | Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | medium | "start with Claude Opus 5.5 for most workloads" |
| standard | Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | high | everyday speed and capability |
| fast | Haiku 5.5 (`claude-haiku-5-5`) | $0.10 / $0.50 (prompts ≤ 100K) | medium | labeled for "sub-agent tasks" |

Effort levels low, medium, high, xhigh, max; "tuning effort is often a better lever than switching
models". Cache reads 0.05× on Opus and Sonnet 5.5, 0.025× on Fable 5.1, 0.1× otherwise. Claude Code
subagents accept `model` and `effort` per definition and default to the parent's model.

Vendor-reported measurements (platform docs, "optimizing for cost and intelligence"): Haiku and
Sonnet 5.5 executors with an Opus 5.5 advisor consulted it on 0 of 198 questions (+12–25% cost); an
Opus 5.5 executor with a Fable 5.1 advisor gained 1.7 points at about 2.1× cost, about what more
effort buys; low effort with failures re-run at high reached 97.0% at $0.17/task against 95.3% at
$0.29 for high alone. An earlier vendor post: a Sonnet executor with an Opus advisor gained 2.7
points at 11.9% lower cost on one benchmark.

## OpenAI

| Tier | Model | Price in/out per MTok | Vendor guidance |
|---|---|---|---|
| top | GPT-6 Astra (`gpt-6-astra`) | $10 / $50 | "the most demanding and important projects" |
| frontier | GPT-6.1 Sol (`gpt-6.1-sol`) | $2 / $10 | "for demanding, multi-step work"; near-Astra at lower cost |
| fast | GPT-6 Luna (`gpt-6-luna`) | $0.10 / $0.50 | "fast, narrow, high-volume work" |

Effort levels (Codex): ultra, max, xhigh, high, medium, low. Codex custom agents set `model` and
`model_reasoning_effort` per agent and inherit the parent's otherwise.

## Google

| Tier | Model | Price in/out per MTok | Vendor guidance |
|---|---|---|---|
| frontier (as positioned for agents) | Gemini 3.6 Flash | $1.50 / $7.50 | the general-purpose agent model |
| fast | Gemini 3.5 Flash-Lite | $0.30 / $2.50 | "can run as a subagent under 3.6 Flash" |

Gemini 3.8 Flash is listed as the newest stable Flash; Gemini 3.1 Pro is in preview. Gemini CLI
subagents default `model: inherit` and cannot nest.

## Cross-family evaluator pairings (to measure, not assume)

An author on one family's frontier tier with the evaluator on another family's frontier or standard
tier is the default independence choice. No source measured a specific pairing on coding work.
