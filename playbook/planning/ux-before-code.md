# UX before code

## Problem

An agent asked to "build the screen" ships the happy path. Empty lists, slow loads and failures
appear later as bugs, each fixed separately. A prototype nobody walked through the journeys
validates the look, not the product.

## Practice

For every user-facing journey, before tasks are cut:

1. **Flow.** Write the screen-by-screen path of each CUJ in a `UX-n` entry: entry point, each screen
   or step, decisions, exits. Non-user-facing journeys (an upstream system) skip this stage.
2. **Four states.** Every screen that shows data names its **empty**, **loading**, **error** and
   **success** state: what the user sees and what they can do next. A screen without an empty state
   is incomplete.
3. **Prototype.** Make the cheapest artifact that can be walked: a clickable mock, a static HTML page,
   or a throwaway branch. Link it from the flow entry.
4. **Walk it against the journeys.** A human, or a separate evaluator with a browser, walks each CUJ
   through the prototype and records what failed. Fix the flow, not just the prototype.
5. **Carry the states into criteria.** Each state becomes an acceptance criterion on the task that
   builds the screen, and the browser check that proves it screenshots all four states.

The prototype is a planning artifact. Its code does not become the implementation unless a task says
so; a spike that proved something is turned into a spec, not merged as is.

## Evidence

- 2026-09-23 · practice · agentic-template's pending quality package: "Every screen has four states"
  and a visual-regression suite screenshots all four; a `ui-review` subagent reads them
  ([QUALITY.md](https://github.com/xaviertorgerson/agentic-template/blob/master/template-update/QUALITY.md)).
- 2026-09-23 · practice · its rule that UI changes are exercised in a browser before "done"
  ([style.md](https://github.com/xaviertorgerson/agentic-template/blob/master/.claude/rules/style.md)).
- 2025-11-26 · vendor · browser automation used "as a human user would" greatly improved Anthropic's
  long-running coding results
  ([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).
- 2026-03-24 · vendor · Anthropic's evaluator tested the live app through a browser against contracts
  agreed before coding ([Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
- 2025-11-20 · vendor · Antigravity's tenet: verify with artifacts such as screenshots and
  recordings, not logs ([Google](https://developers.googleblog.com/en/build-with-google-antigravity-our-new-agentic-development-platform/)).
- recommendation · walking the prototype against CUJs before tasks is this playbook's rule; no source
  measures it.

## Contracts used

`ux-flow` (`UX-n`: flows, states incl. empty/loading/error/success, prototype link), `journey`,
`task`. Trace: every user-facing CUJ reaches at least one UX entry; every UX state reaches an AC.

## Anti-patterns

- Designing in the implementation PR, so review argues about layout and logic at once.
- "Loading…" and a blank list as the only non-success states.
- A prototype checked for appearance and never walked through a journey.
- A prototype branch merged because it "basically works".

## Revisit when

Agents reliably produce all four states unprompted (an eval on several products shows it), or a
design-tool integration makes the prototype and the implementation the same artifact.
