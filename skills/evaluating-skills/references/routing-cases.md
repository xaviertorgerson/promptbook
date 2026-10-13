# Routing cases (`evals/routing.jsonl`)

One JSON object per line. The fields are the `evidence` contract's `routingCase`:

| Field | Required | Values |
|---|---|---|
| `prompt` | yes | the user's message, 1–2000 chars |
| `expect` | yes | `trigger` or `no-trigger` |
| `kind` | recommended | `positive`, `near-miss`, `negative` |
| `route_to` | for `near-miss` | the skill that should load instead, or `none` |
| `note` | no | why the case exists (a real misroute, a boundary) |

Rules the validator enforces:

- `expect: trigger` means `kind: positive` and no `route_to` (`trigger-case-is-positive`).
- `kind: near-miss` must name `route_to` (`near-miss-names-route`).
- No other fields.

Minimum per skill: 4 positive, 3 near-miss (each naming a neighbour from the description's "Do not
use for"), 2 negative.

## Example

```jsonl
{"prompt":"Write the requirements for the invoicing epic.","expect":"trigger","kind":"positive"}
{"prompt":"/writing-requirements billing","expect":"trigger","kind":"positive","note":"slash form"}
{"prompt":"Our NFRs just say 'fast'. Make them measurable.","expect":"trigger","kind":"positive","note":"symptom-first"}
{"prompt":"Can you go through spec.md and make sure every requirement ties back to a journey and has a test we could write for it?","expect":"trigger","kind":"positive","note":"long-winded"}
{"prompt":"Break the approved invoicing spec into tasks.","expect":"no-trigger","kind":"near-miss","route_to":"planning-work"}
{"prompt":"Which database should we pick for the ledger?","expect":"no-trigger","kind":"near-miss","route_to":"choosing-architecture"}
{"prompt":"Draw the screens for the refund journey.","expect":"no-trigger","kind":"near-miss","route_to":"designing-flows"}
{"prompt":"What's the weather in Lisbon?","expect":"no-trigger","kind":"negative","route_to":"none"}
{"prompt":"Rename this variable to camelCase.","expect":"no-trigger","kind":"negative","route_to":"none"}
```

## Writing good cases

- **Real first.** Copy prompts from transcripts, issues and misroute reports. A prompt that
  actually misrouted becomes a case with a `note` naming the date.
- **Vary the form.** Terse imperative, question, symptom ("the tests pass but…"), slash command,
  pasted error, long request with the trigger buried mid-sentence.
- **Near-misses share vocabulary.** "Review the security of this PR" vs "review this PR" is a good
  pair; "deploy" vs "weather" is not a near-miss, it is a negative.
- **One owner per prompt.** If you cannot say which single skill owns a prompt, the catalog has an
  overlap; settle it before writing the case.
- **Mirror boundaries.** A near-miss here (`route_to: X`) is usually a positive in X's file. Add it
  there too.

## Deprecated skills must never trigger

A skill whose frontmatter carries `metadata.deprecated` stays in the catalog for one minor release so
that its users are moved forward. During that release:

- Its own `routing.jsonl` keeps its old positive prompts, rewritten as
  `{"expect":"no-trigger","kind":"near-miss","route_to":"<replacement>","note":"deprecated <date>"}`.
- The replacement's `routing.jsonl` gets the same prompts as positives.
- The runner fails the whole run if the deprecated skill is chosen for **any** prompt in the catalog,
  whether or not a case mentions it.
