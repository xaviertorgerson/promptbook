# Evidence entries (`evals/evidence.md`)

The failure log a skill's next revision reads first. One entry per lesson or measurement, newest
last. The format is the `evidence` contract's `entry`:

```markdown
# Evidence — <skill-name>

## YYYY-MM-DD · <what happened, in a few words>
- **Kind:** measured | observed | incident | audit | vendor-reported | literature
- **Source:** a URL, a repository path, a commit, or a run reference
- **Claim:** the one thing this entry establishes
- **Result:** what changed in the skill or its evals because of it
- **Engine:** <engine slug>            (measured runs)
- **Model:** <model id>                (measured runs)
- **Skill version:** 0.1.0            (the metadata.version the entry applies to)
- **Revisit:** when to re-check it
```

| Kind | Use for | Must have |
|---|---|---|
| `measured` | we ran it: routing totals, scenario n/k, a cost comparison | `Source` naming the command and commit |
| `observed` | seen in real work: a misroute in a transcript, a port from another repo | `Source` (path, commit, run) |
| `incident` | it went wrong in real work | `Source`; `Result` naming the eval that now covers it |
| `audit` | a review found it | `Source` |
| `vendor-reported` | a vendor's claim about its own product or model | an `https://` `Source`; say it is the vendor's claim |
| `literature` | published research | an `https://` `Source` |

Rules:

- **Real failures, not opinions.** An entry an agent wrote about its own success is not evidence.
- **Generalize, never paste.** The entry holds the instance (the prompt, the run, the date); the skill
  holds the rule for the class.
- **No source, no entry.** Never invent a URL or a number; a claim you cannot cite is a question.
- Quotes under 15 words.
- Fields other than these are rejected by the validator.

## Mini-example

```markdown
## 2026-10-14 · A near-miss for debugging routed to test writing
- **Kind:** incident
- **Source:** run 3f0c6c1e (.agent/loop-runs.jsonl), task BILL-7
- **Claim:** "Why does AC-2's test fail only on CI?" loaded writing-tests, which added a test instead of diagnosing.
- **Result:** writing-tests' description now says "Do not use for diagnosing a failing test"; the prompt is a near-miss in its routing.jsonl and a positive in debugging-failures'.
- **Skill version:** 0.1.1
```
