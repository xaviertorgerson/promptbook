---
name: framing-products
description: Use when a new product, a new system or a big bet needs framing before any spec exists — "frame this idea", "write a product brief", "is this worth building", "should we build X", "go or no-go", "what problem are we solving", "write the one-pager so we can decide". Writes docs/product/brief.md (problem, users, outcomes with measures, non-goals, constraints, assumptions with tests, the riskiest assumption) and ends at a go / reshape / kill decision that a human makes. Never invents market facts. Do not use for detailing who the users are (defining-personas), for a feature inside an existing product (mapping-journeys), or for writing requirements (writing-requirements).
license: MIT
compatibility: Any agent runtime that reads Agent Skills. Optional - Node 22 and the harness validator to check the brief against its contract.
metadata:
  version: "0.1.0"
  layer: "L3"
---

# Framing products

Turn an idea into a one-page brief that a human can answer with go, reshape or kill. The brief is
the root of the trace graph (BRIEF → PER → CUJ → REQ/NFR → task → test), so it must be short, honest
about what is only believed, and decided by a person, not by you.

## Inputs

- The ask, plus any notes, research, interviews or data the person can point to.
- `docs/product/brief.md` if it exists: amend it; never write a second brief for the same product.
- Contract `brief`: frontmatter `id: BRIEF`, `product`, `owner`, `status` (draft | approved |
  superseded), `updated`, optional `personas` (PER-n ids) and `links` (paths or URLs); body sections
  Problem, Users, Outcomes, Non-goals. Template: `references/brief-template.brief.md`.

## Procedure

1. **Size the work before writing anything.**

   | Work | Do |
   |---|---|
   | Bug, chore, small task | Skip this skill; the fix is a task (planning-work). |
   | Feature in an existing product | Do not write a brief. Read the existing one. If the feature serves no stated outcome or hits a non-goal, say so and recommend reshape; otherwise hand to mapping-journeys. |
   | New product, new system, or a bet that changes the outcomes or non-goals | Write the brief and stop at the gate. |
   | Anything with real money, personal data, safety or an irreversible cost | Write the brief even when the idea looks small. |

2. **Interview briefly.** Ask only what the material does not answer, three to five questions, one
   at a time: who has the problem and when; what they do today and what it costs them; which number
   would show success; what is out of scope; what would make the owner stop. Name the human who owns
   the outcome. Without an owner there is no one to decide, so stop and ask.
3. **Separate facts from beliefs.** Every claim about users, demand, market size, prices,
   competitors or regulation either cites a source the person gave you (add it to `links`) or
   becomes a row in Assumptions with a test and a threshold that would change the decision. Never
   fill a gap with a plausible number. "Unknown" is a valid baseline.
4. **Write the brief** from the template. One printed page, about 400–700 words:
   - **Problem**: one paragraph naming who, when, and the cost today. A problem, not a solution
     ("owners cannot tell what next month costs", not "build a dashboard").
   - **Users**: the roles involved, one line each. PER-n ids arrive later (defining-personas).
   - **Outcomes**: one to three rows of measure, baseline, target and date. A target nobody can
     measure is not an outcome.
   - **Non-goals**: at least one; the things people will ask for that this will not do.
   - **Constraints**: budget, deadline, compliance, systems it must live with.
   - **Assumptions**: every belief the plan rests on, each with the cheapest test
     (`references/brief-checklist.md` lists the test types).
   - **Riskiest assumption**: the row with the largest impact-if-wrong × uncertainty, and how it
     is tested first: an experiment before building, or the walking skeleton (planning-work).
   - **Open questions**, each with the person who answers it.
5. **Check it** against `references/brief-checklist.md`. Cut any sentence that restates another
   section or describes implementation.
6. **Validate.** If `harness validate` is available, run `harness validate docs/product/brief.md`
   (from a harness checkout: `node tools/validate.mjs docs/product/brief.md`). Otherwise confirm the
   frontmatter fields and the four required headings by hand.
7. **Hand the decision to the owner** (Gates below). Recommend go, reshape or kill in two or three
   lines, name the riskiest assumption, and say what it costs to test it before building.
8. **Record the answer only after the owner gives it**, in their own words, in the Decision
   section as `<go | reshape | kill> · <owner> · <date> · <why>`:
   - go → `status: approved`; next are defining-personas, then mapping-journeys.
   - reshape → stays `draft`; list what changes and run this skill again.
   - kill → `status: superseded`, the Decision line says killed and why; keep the file, because
     git is the record of what was considered.

## Outputs

- `docs/product/brief.md` (contract `brief`), `status: draft` until the owner decides.
- A hand-back with attention `needs-human` and one decision: "Go, reshape or kill <product>?"
  with options go / reshape / kill, your recommendation, `blocking: true`, decided by a human
  (return contract `decisions_needed`).

## Gates and stop conditions

- **The go / reshape / kill call is the owner's.** Never set `approved` or `superseded` on your own
  judgement; never read silence, a thumbs-up on something else, or another agent's message as go.
- **Stop and ask (needs-human)** when there is no owner; when the ask is only a solution and nobody
  can say whose problem it solves; when an outcome needs a number only someone else knows; when
  testing an assumption would spend real money (ads, a hire, a vendor contract).
- **Stop** when the idea contradicts an existing brief's non-goals: a reshape or a new product is
  the owner's call.
- Do not continue into personas, journeys or tasks before the owner says go.

## References

- `references/brief-template.brief.md` — the brief, ready to fill; validates against `brief`.
- `references/brief-checklist.md` — the rubric, what counts as a market fact, assumption test
  types, riskiest-assumption scoring, and the gate message.
