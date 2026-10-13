# Brief checklist

Use before handing the brief to its owner. Every "no" is fixed or written down as an open question.

## Rubric

| Check | Pass when |
|---|---|
| Problem | names who, when, and today's cost; contains no feature or technology |
| Users | roles, not invented people; one line each |
| Outcomes | 1–3 rows, each with a measure, a baseline (or "unknown") and a target with a date |
| Non-goals | at least one, naming something a stakeholder will plausibly ask for |
| Constraints | budget, deadline, compliance and existing systems are stated or marked "none known" |
| Assumptions | every belief the plan rests on is a row with a test and a threshold |
| Riskiest assumption | one row, chosen by the score below, with how and when it is tested |
| Open questions | each has the person who answers it |
| Length | one printed page; no section restates another |
| Owner | a named human; `status: draft` until they decide |

## What counts as a market fact

A statement about the world outside the codebase: who the users are and how many, what they do today,
what they would pay, what competitors offer, what a law or contract requires, what a vendor's limits
are. Each one is either:

- **cited**: the person gave you a source (an interview note, analytics, a contract, a vendor page);
  add it to `links` and keep the claim as narrow as the source; or
- **assumed**: a row under Assumptions, worded "We believe …", with a test.

Never fill a gap with a plausible number, a "typical" market size, or a competitor feature you have
not been shown. Write "unknown" and make finding out an open question or a test.

## Assumption test types (cheapest first)

| Test | Answers | Typical cost |
|---|---|---|
| Ask the data you already have | does the behaviour exist; how often | hours |
| Five conversations with people who have the problem | is the problem real and painful | days |
| A smoke page or a sign-up form | will people ask for it | days, small spend (a human approves spend) |
| A concierge or manual run | does the outcome happen when a person does the work | a week |
| A technical spike | can it be built within the constraint | days; the code is thrown away |
| The walking skeleton | does the real pipeline hold end to end | the first task (planning-work) |

## Choosing the riskiest assumption

Score each assumption 1–3 on **impact if wrong** (3 = the product is pointless or unsafe) and
**uncertainty** (3 = no evidence at all). The highest product wins; break ties toward the one that
is cheapest to test. A feasibility assumption that only the real pipeline can test becomes the walking
skeleton's purpose; a demand assumption is tested before any build.

## Scale

| Work | What this skill produces |
|---|---|
| Bug, chore, small task | nothing; it is a task |
| Feature in an existing product | nothing new; a check that it serves a stated outcome and hits no non-goal |
| New product, new system, a bet that changes outcomes | the full brief and the gate |
| Real money, personal data, safety, irreversible cost | the full brief, even when small |

## The gate message

Hand back with attention `needs-human` and one blocking decision for a human:

```
Go, reshape or kill <product>?
Recommendation: <go | reshape | kill> — <two lines of why>.
Riskiest assumption: A<n> <belief>; test: <how>, <cost>.
Options: go (personas, journeys and a walking skeleton next) · reshape (say what changes) · kill.
Brief: docs/product/brief.md
```

Record the answer in the brief's Decision section only after the owner gives it. Silence is not go.
