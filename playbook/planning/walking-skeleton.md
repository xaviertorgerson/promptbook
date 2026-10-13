# Walking skeleton

## Problem

Agents build features breadth-first and declare victory early. The integration risks (the deploy
path, auth, the data store, an external API) surface last, after many features depend on a wrong
assumption. Fixes then break existing behavior.

## Practice

Before feature tasks on a new product, or a feature that crosses a new one-way door:

1. **Name the riskiest assumption** from the brief and the one-way ADRs: the thing that, if wrong,
   invalidates the most later work.
2. **Cut the thinnest end-to-end slice** that exercises it through the real pipeline: one journey,
   one screen or endpoint, one write and read through the real data store, the real auth, built by
   real CI, deployed to the first real stage, checked by the real probe.
3. **Make it the first task.** Everything else `depends_on` it. Its acceptance criteria are the
   pipeline facts (built once, deployed by digest, health check green, journey passes in a browser),
   not feature completeness.
4. **Keep it running.** Later tasks extend the skeleton; none may leave it broken. A smoke test of
   the skeleton's journey runs at every session start and in CI.
5. **If the assumption fails, re-plan.** A failed skeleton sends the epic back to architecture, not
   forward into features.

A bug or a feature inside a proven skeleton skips this stage.

## Evidence

- 2025-11-26 · vendor · Anthropic's long-running harness started each session by running `init.sh`
  and an end-to-end test before new work, against failures such as one-shotting and premature victory
  ([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).
- 2026-02-05 · vendor · in Anthropic's 16-agent compiler run, fixes often broke existing behavior and
  CI was added late to stop regressions; "the verifier must be nearly perfect"
  ([Anthropic](https://www.anthropic.com/engineering/building-c-compiler)).
- 2025-07-14 · self-reported · Ralph relies on backpressure from tests and type checks and suits
  greenfield work ([ghuntley.com](https://ghuntley.com/ralph/)).
- 2026-09-23 · practice · agentic-template rehearses production on a laptop before the first deploy
  and requires the deploy shape (image by digest, `/health/ready`, probe) before launch
  ([ci-cd.md](https://github.com/xaviertorgerson/agentic-template/blob/master/docs/ci-cd.md)).
- recommendation · "riskiest assumption first" through the real pipeline is this playbook's rule;
  no source compares skeleton-first with feature-first for agents.

## Contracts used

`task` (the skeleton task, `risk: high`, every feature task `depends_on` it), `decision` (the
one-way ADRs it proves), `requirement` (the NFRs it measures first).

## Anti-patterns

- A skeleton built on mocks of the pieces that carry the risk.
- Features started in parallel "while the deploy is sorted out".
- A skeleton that passes once and is never run again.
- Treating the skeleton as a demo and skipping its criteria.

## Revisit when

Pack-provided starters make the pipeline proven on day one for a stack (then the skeleton shrinks to
the domain's riskiest assumption only).
