# Architecture and stack

## Problem

Architecture chosen by feature comparison ("this tool is better") adds a second way of doing
something and rarely serves a stated need. Decisions made in chat are re-argued by every new session.
Stacks chosen per project fragment the toolkit, so no skill, gate or lesson transfers.

## Practice

1. **Quality attributes first.** List the NFRs that constrain structure (from
   [journeys-and-requirements](journeys-and-requirements.md)) and rank them for this product. The
   ranking is the decision criterion; a tool's feature list is not.
2. **Options.** For each decision with real alternatives, write two or three options and how each
   meets the ranked attributes, including "do nothing" or "the pack's default".
3. **Door type.** Classify the decision:
   - *two-way door*: cheap to reverse (a library behind an interface, a config value). Decide fast,
     record in one line, move on.
   - *one-way door*: expensive to reverse (a data model, a public API, a datastore, an auth model, a
     deploy shape). Write an ADR, have a human approve it, and walk the skeleton through it first.
4. **ADR.** An `ADR-nnnn` records the decision, options considered, the door type, the NFRs/REQs it
   satisfies, and a **reversal trigger**: the measurable condition that reopens it. Accepted ADRs are
   immutable; a change is a new ADR that supersedes the old one.
5. **Stack = choose a pack.** Pick an L4 stack pack and pin it in `toolkit.lock`. Departing from the
   pack is a *deviation*: an ADR that names what differs and the trigger that ends it. A deviation
   without a trigger is a defect.
6. **Enforce the boundaries the ADR draws.** Dependency direction, module boundaries and contract
   shapes become lint rules, types or structural tests in the same change.
7. **Keep always-loaded text current.** When an ADR supersedes another, a check fails any
   always-loaded instruction that still names the retired choice.

## Evidence

- 2026-09-23 · practice · agentic-template's ADR register is immutable once accepted, and newer ADRs
  carry "Reversed when" triggers; its mandate makes a deviation without a trigger a defect
  ([DECISIONS.md](https://github.com/xaviertorgerson/agentic-template/blob/master/DECISIONS.md)).
- 2026-09-23 · practice · its reflection on four stack reversals: arguments that one tool was better
  usually added a second way of doing something
  ([REFLECTION.md](https://github.com/xaviertorgerson/agentic-template/blob/master/template-update/REFLECTION.md)).
- 2026-10-12 · practice · AGENTS.md and an always-on rule still described a stack that ADR-0015 and
  ADR-0019 had superseded on 2026-09-23 ([AGENTS.md](https://github.com/xaviertorgerson/agentic-template/blob/master/AGENTS.md);
  [DECISIONS.md](https://github.com/xaviertorgerson/agentic-template/blob/master/DECISIONS.md)); branch
  `fix/stack-drift` adds `scripts/decision-drift.mjs`, which fails a retired term in always-loaded text.
- 2026-02-11 · vendor · OpenAI enforced layered domains with custom linters whose errors carry
  remediation ([OpenAI](https://openai.com/index/harness-engineering/)).
- 2026-07-01 · vendor · Google: "If you can clearly map the workflow, use determinism"
  ([Google](https://developers.googleblog.com/why-we-built-adk-20/)).
- recommendation · the one-way/two-way door test and "stack = pack or deviation" are this playbook's
  rules, adapted from the user's mandate; no source measures them.

## Contracts used

`decision` (ADR with options, door, reversal trigger, satisfies), `requirement` (NFR categories),
`toolkit-lock` (the pinned pack). Trace: every ADR links the NFR/REQ it satisfies, and every
one-way NFR has an ADR (validator).

## Anti-patterns

- An ADR that records the winner but not the options or the trigger.
- Editing an accepted ADR instead of superseding it.
- A per-project stack with no pack and no deviation record.
- Boundaries described in prose and enforced nowhere.
- Instruction files still teaching a superseded decision.

## Revisit when

A reversal trigger fires, a pack's own ADRs change, or decision-drift reports grow faster than they
are fixed.
