# Persona checklist

## The decision test

Keep a candidate only if you can finish this sentence with something concrete:

> Without PER-n we would decide **<X>** differently.

| Kind of decision | Example of a persona that changes it |
|---|---|
| A requirement exists at all | a recipient who never logs in forces "works from a link, no account" |
| An NFR threshold | a field worker on a phone over a weak network sets the page-weight budget |
| A permission boundary | a finance lead may see every invoice; an owner sees only their own |
| A screen state | a first-time user makes the empty state the most important screen |
| Accessibility | a screen-reader user sets the accessibility bar for a flow |
| Price or packaging | a five-person team versus a 500-seat buyer |

If two candidates change the same decisions in the same way, merge them. If a candidate changes
nothing, drop it and say so in one line of the hand-back. A persona that owns no journey at readiness
is deleted (the trace check warns `persona-has-journey`).

## Evidence or assumption

| Tag | Use when | Example |
|---|---|---|
| `[evidence: <ref>]` | a source the person gave you says it: an interview note, a ticket export, analytics, a contract | `[evidence: docs/research/interviews.md]` |
| `[assumption: <test>]` | anything else, including things that "everyone knows" | `[assumption: ask 5 pilot households]` |

Rules:
- The claim is no broader than its source. "Two of six interviewees" stays two of six.
- No demographics (age, gender, income) unless a cited source shows they change a decision.
- No invented quotes. `Quote` is verbatim from a cited source, or omitted.
- `Evidence` entries are paths or URLs without spaces (the contract's `docRef`).

## Wording jobs

Write a goal as a job, not a feature: "when <situation>, <what they want>, so <outcome>".
"When the month ends, see who owes what in one screen, so nobody has to chase" — not "a dashboard".

## Fields the contract does not read

`Must never` and `Changes` are kept for people and for journeys; the persona parser ignores labels it
does not map, so they never fail validation. In the one-file-per-persona form, put them in
`x-`-prefixed frontmatter keys. Do not list a persona's journeys here: the trace check derives them
from `cuj.md`, so a second copy would only drift.

## One file per persona (alternative form)

```markdown
---
id: PER-3
name: <role name>
role: <one line>
goals:
  - when <situation>, <what they want>, so <outcome> [assumption: <test>]
context: <device · frequency · expertise> [assumption: <test>]
evidence: [<path-or-url>]
x-must-never: [<what they must never experience>]
---

# <role name>
```

Path: `docs/product/personas/<slug>.md`. Do not mix both forms for the same id.

## Scale

| Work | Personas |
|---|---|
| Bug, chore | none; reuse the journey's persona |
| Feature in an existing product | none new, unless the feature brings a new kind of user |
| New product | one to four, each passing the decision test |
