# Framing and personas

## Problem

Without a written frame, every later artifact re-argues what the product is for, and agents fill the
gap with plausible guesses. Personas written as marketing prose add tokens without changing a single
decision.

## Practice

**Brief (stage 1).** One page, written by the human who owns the outcome, the planner assisting:

- the problem and who has it, in one paragraph;
- the outcome that would count as success, with a number where one exists;
- in scope, and **non-goals** stated explicitly;
- constraints (budget, deadline, compliance, existing systems);
- the riskiest assumption, which the walking skeleton tests first;
- open questions, each with an owner.

The brief is read by the planner and by humans at the gates. It is not loaded into every coding
session; tasks cite the section they need.

**Personas (stage 2).** Write only personas that change a decision. Each one carries:

- a stable id (`PER-n`) and a role name, not a fictional biography;
- the job they hire the product for and the context they use it in (device, frequency, expertise);
- what they must never experience (data loss, a blocked payment, an inaccessible screen);
- which journeys they own (filled in at stage 3).

A product usually has one login persona per role plus any upstream system that acts like a user. A
persona that owns no journey is deleted at readiness.

**Scale.** A feature in an existing product reads the brief and personas and adds one only when the
feature introduces a new kind of user. A bug skips both.

## Evidence

- 2026-02-11 · vendor · OpenAI's agent-built product kept product specs in a `docs/` system of
  record; what is not in the repo is effectively invisible to the agent
  ([OpenAI](https://openai.com/index/harness-engineering/)).
- 2026-02-12 · controlled · repository overviews in context files did not improve task success and
  raised cost over 20% ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988v1)), which is why the
  brief is cited by section, not loaded every turn.
- 2026-06-03 · secondary · BMAD's planning phase opens with a brief before the PRD
  ([CodeMySpec](https://codemyspec.com/blog/bmad-method-explained)).
- 2026-09-30 · practice · stagehand requires context that separates "required behavior, constraints,
  and non-goals" ([design principles](https://github.com/QuentinTorg/stagehand/blob/main/docs/design/01-design-principles.md)).
- 2026-09-23 · practice · agentic-template's spec template carries Problem and Scope In/Out, and its
  FUTURE.md defers a persona-and-CUJ skill until a second child writes personas by hand
  ([agentic-template](https://github.com/xaviertorgerson/agentic-template/blob/master/FUTURE.md)).
- recommendation · "only personas that change a decision" is this playbook's rule; no source measures
  persona format against outcomes.

## Contracts used

`brief` (`docs/product/brief.md`, id `BRIEF`), `persona` (`PER-n`). Trace: every persona must be
reached from the brief and must own at least one journey (`plan-readiness`).

## Anti-patterns

- A brief with no non-goals; scope then grows through review.
- Personas with names, ages and hobbies and no journey.
- The brief pasted into an always-loaded instruction file.
- Planning starting from a solution ("build a dashboard") instead of a problem.

## Revisit when

The validator shows orphan personas across several products (the stage is producing noise), or an
evaluation shows briefs change agent output measurably.
