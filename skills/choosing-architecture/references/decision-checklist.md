# Decision checklist

## Quality-attribute scenarios

Turn each structural NFR into a scenario with six parts, so options can be scored against it:

| Part | Question | Example |
|---|---|---|
| Source | who or what causes it | a housemate on a phone |
| Stimulus | what happens | saves a bill |
| Environment | under what conditions | at the evening peak, over 4G |
| Artifact | which part responds | the balances API |
| Response | what it does | returns every new share |
| Measure | how it is checked | p95 < 300 ms at 20 rps in the CI load test |

Rank two to five scenarios. Rank 1 decides ties. Scenarios without an NFR behind them are opinions:
add the NFR (writing-requirements) or drop the scenario.

## Door test

Ask: if this is wrong in six months, what does undoing it cost?

| Two-way door | One-way door |
|---|---|
| a library behind an interface; a config value; an internal module split; a UI component choice | the primary datastore; the data model others depend on; a public API or event schema; the auth, tenancy or permission model; the deploy shape; a vendor holding customer data |
| decide in minutes; one line, or a five-line ADR if it satisfies an NFR | full ADR, Status Proposed, a human accepts, the walking skeleton exercises it |

When unsure, it is one-way. A one-way door still names its reversal trigger: the condition that would
make paying the reversal cost worthwhile.

## Options

- Two or three options, always including the pack's default (or "do nothing").
- Score each against the ranked scenarios, then cost to build, cost to run, reversal cost.
- Write why each loser lost against a ranked attribute. "Less popular" or "worse DX" is not a reason
  unless an attribute says so.
- A decision whose only argument is a feature list is not ready.

## Pack or deviation

1. The project pins a stack pack in `toolkit.lock`: its choices are the defaults; following them needs
   no ADR.
2. A choice the pack does not make: an ordinary ADR.
3. A choice that departs from the pack: a deviation ADR whose title starts "Deviate from …", with the
   NFR the default cannot meet, the scope of the deviation, a fitness function that keeps it in that
   scope, and a **Reversed when** naming the trigger that ends it. No trigger, no deviation.
4. No pack fits at all: the stack is a one-way-door ADR whose reversal trigger is when to adopt or
   write a pack.

## Per-ADR rubric

| Field | Pass when |
|---|---|
| Title | the decision as a statement, not a question |
| Status | Proposed until a human accepts a one-way door |
| Decision | specific enough that a reviewer can tell if code violates it |
| Why | names the ranked attributes, not tool features |
| Options considered | at least two, each loser with its reason |
| Door | one-way or two-way |
| Reversed when | measurable, even for a one-way door |
| Satisfies | qualified ids (`<epic>/NFR-n`) that exist; the rows' ADR column agrees |
| Fitness function | an automated check exists or is a task criterion |
| Consequences | what gets harder, not only what gets easier |
| Length | 15–30 lines one-way; about 5 lines two-way |

## Scale

| Work | Architecture work |
|---|---|
| Bug, chore, a task inside the architecture | none |
| Feature | only an ADR for a one-way door it crosses or an ADR it breaks |
| New product or system | scenarios, pack or deviation, views, data model, ADRs, fitness functions |
| `risk: high` | every structural choice treated as one-way |
