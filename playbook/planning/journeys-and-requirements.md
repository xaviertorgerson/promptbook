# Journeys and requirements

## Problem

An agent loops until something tells it to stop. If the stop condition is vague ("handle errors
gracefully", "make it fast"), it stops early, stops never, or stops on the wrong thing. Requirements
written as feature names cannot be tested, and quality attributes left implicit are discovered in
production.

## Practice

**Journeys (stage 3).** A critical user journey (`CUJ-n`) is one named, end-to-end path a persona
must be able to complete. Each has: actor (a `PER-n`), goal, trigger, numbered steps, an observable
success state, and the unwanted outcome the system must handle. Journeys are few; a path that
nobody would notice breaking is not critical.

**Functional requirements (stage 4).** Each `REQ-n` is one behavior in an EARS shape:

| Pattern | Shape |
|---|---|
| Ubiquitous | The <system> shall <response>. |
| Event-driven | When <trigger>, the <system> shall <response>. |
| State-driven | While <state>, the <system> shall <response>. |
| Unwanted | If <condition>, then the <system> shall <response>. |
| Optional | Where <feature>, the <system> shall <response>. |

A journey's trigger becomes an event-driven requirement, its success state a state-driven one, and
its unwanted outcome an unwanted-behavior one. If you cannot name the test that would prove a
requirement, it is not a requirement yet.

**Non-functional requirements.** Each `NFR-n` names a category and a measurable threshold:
performance, availability, security, privacy, accessibility, cost, operability, compatibility. "Fast"
is not an NFR; "p95 under 300 ms at 50 rps" is. NFRs drive the architecture options
([architecture-and-stack](architecture-and-stack.md)).

**Into tasks.** A task copies only the requirements it implements and restates them as acceptance
criteria `AC-n`, scoped to the task. Each AC id must appear in the name of the test that proves it;
that is the task's stopping condition.

## Evidence

- 2026-09-23 · practice · agentic-template writes EARS criteria with ids, lints their form
  (`ears-lint`) and refuses `review` until every id appears in a test name (`ears-coverage`)
  ([specs/README.md](https://github.com/xaviertorgerson/agentic-template/blob/master/specs/README.md)).
- 2026-09-23 · practice · its loop guidance: give success criteria, not step-by-step instructions,
  so the agent loops to done without supervision
  ([LOOPING.md](https://github.com/xaviertorgerson/agentic-template/blob/master/LOOPING.md)).
- 2026-01-09 · vendor · Anthropic's eval guidance: grade outcomes, not step sequences
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
- 2025-10-26 · controlled · MAST attributes about 44% of multi-agent failures to system design,
  including "unaware of stopping conditions" at 12.4%
  ([arXiv 2503.13657](https://arxiv.org/html/2503.13657v3)).
- 2026-10-02 · vendor · Kiro writes requirements as user stories with acceptance criteria and traces
  tasks back to requirement numbers ([Kiro](https://kiro.dev/docs/specs/)).
- 2025-10-15 · practitioner · 16 criteria for one small bug shows the opposite failure
  ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).

## Contracts used

`journey` (`CUJ-n`), `requirement` (`REQ-n`, `NFR-n` with category), `task` (`AC-n`). Trace:
PER → CUJ → REQ/NFR → TASK.AC → test name (validator).

## Anti-patterns

- Criteria that describe implementation ("add a column") instead of observable behavior.
- One requirement holding three behaviors joined by "and".
- NFRs without a number, or with a number nobody can measure.
- A task that restates the whole epic instead of the requirements it implements.
- Weakening a test so a criterion "passes".

## Revisit when

A controlled study compares EARS against other criteria forms for agent completion, or the validator
shows tasks routinely needing criteria the journeys did not predict.
