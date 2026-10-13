# Releasing

## Problem

A build made on a box, or rebuilt per stage, is not the build that passed testing. An evaluator that
only reads the diff cannot see the running product. A risky change shipped to everyone at once has no
dimmer, and a rollback that needs a human at 3 a.m. comes late.

## Practice

- **Build once, promote by digest.** CI builds one immutable artifact per merge. Every stage (dev,
  QA, UAT, production, or whatever the pack names) runs that digest; no stage rebuilds. Nothing is
  built or fixed by hand on a box; a box is rebuilt from code.
- **A preview environment per PR.** Each PR gets an ephemeral, isolated deployment with its own data,
  so the evaluator and the human judge the running change, not a description of it. Closing the PR
  removes it.
- **Dark launch behind flags.** Risky behavior ships off, then opens to the team, then to a
  percentage. Outbound and money-moving side effects default off outside production.
- **Probes decide rollback.** An off-box probe and an error-rate check watch each rollout; a breach
  rolls back to the previous digest automatically and freezes promotion. Rollback is "deploy the
  previous digest", rehearsed, not improvised.
- **Promotion checks itself.** Each hop runs its own gates (CI green on the digest, probe green for
  the dwell, error rate under threshold, smoke suite on the target) and stops on the first red. It
  never retries silently; it opens an issue.
- **Agents never deploy to production.** Production promotion sits behind a human approval in the
  forge's protected environment. Agents may deploy previews and dev.

## Evidence

- 2026-09-23 · practice · agentic-template's train promotes one image by digest through four stages,
  with per-hop gates, canary watch with automatic rollback, flags for risky api behavior, and a
  required human approval for production ([ci-cd.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/ci-cd.md)).
- 2026-09-23 · practice · its roles matrix forbids every agent from deploying to production
  ([roles.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/roles.md)).
- 2026-09-23 · practice · its hard rule: nothing is built on a box; the box pulls by digest
  ([AGENTS.md](https://github.com/xaviertorgerson/agentic-template/blob/master/AGENTS.md)).
- 2026-03-24 · vendor · Anthropic's evaluator judged the live app, not the code
  ([Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
- 2025-06-13 · vendor · Anthropic used rainbow deployments to shift traffic without breaking
  in-flight agents ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)).
- 2026-10 · vendor · GrowthBook's flag workflows ship new flags disabled and guard rollouts with
  automatic rollback ([growthbook/skills](https://github.com/growthbook/skills)).
- 2026-03-25 · vendor · auto mode is "not a drop-in replacement" for human review on high-stakes
  infrastructure ([Anthropic](https://www.anthropic.com/engineering/claude-code-auto-mode)).

## Contracts used

`task` (`evaluator` names the preview), `grant` (no grant covers production),
`state-machines/authority.yaml` (production is human-only), `run-record`.

## Anti-patterns

- Building the production image from the release tag after QA passed a different one.
- An evaluator asked to approve a PR it cannot run.
- Flags that never close; config drift becomes the product.
- "Rollback" that means checking out an old commit and rebuilding on a struggling box.
- An agent workflow holding the production deploy credential.

## Revisit when

A pack's deploy target cannot run an artifact by digest, or automated promotion has run untouched
long enough that the pack's own trigger for removing the human production gate fires.
