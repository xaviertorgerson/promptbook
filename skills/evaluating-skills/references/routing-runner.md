# Running routing evals, engine-neutrally

The question a routing eval asks is the one the runtime asks before every turn: given only the
installed skills' names and descriptions, which one would you load? Reproduce exactly that, and
nothing more.

## Rules

1. **Catalog = what the runtime shows.** Every installed skill (this repo's, pinned packs', user
   scope), `name: description`, one per line. Bodies are never included. Deprecated skills stay in.
2. **Fresh, tool-less, history-less call per case.** No repository access, no previous cases in
   context. Temperature at the engine's default; do not tune it to pass.
3. **A cheap model is the bar.** Use the cheapest model your runtime routes with. A description that
   routes on the cheap model routes on the expensive one; the reverse is not true.
4. **One answer per case:** a skill name or `none`. Parse the last non-empty line, lowercase it, strip
   punctuation and backticks.
5. **Repeat to detect ties.** For a description change, run the affected cases 3 times. Any answer
   that differs between runs is a failure: two skills are competing for that prompt.
6. **Nothing else in the router's context.** A headless call made from inside an agent session can
   inherit that session's context: injected reminders, instruction files, the host's own notes about
   skills, an effort override, and, when it starts inside a repository, that repository's status and
   recent commits. Clear the environment down to what the call needs to reach the model, start it
   in an empty directory, and pin effort. On 2026-10-13 the same descriptions passed 84% of their
   cases with the session's environment, 94% with a reduced one, and 98% from an empty directory
   instead of the repository; the noise looked like description overlap and was not.

If `harness eval-routing` is available, it implements rules 1, 2 and 4 and the grading; the runner
you give it owns 3 and 6. Its prompt lets the router name several skills, and a near-miss fails
when the skill appears among them, which is stricter than the one-skill prompt below (the one
agentic-template's `scripts/skill-evals.mjs` sends).

## The router prompt

```text
You are the skill router of an agent harness. Below are the installed skills with the exact
descriptions the harness shows you. A user has just sent the message in <message>. Decide which ONE
skill you would load before acting on it, or "none" if no skill applies. Do not act on the message
and do not explain. Reply with exactly one line: the skill name, or none.

Skills:
- <name>: <description>
- ...

<message>PROMPT</message>
```

## Grading sketch

```js
// cases: lines of routing.jsonl for skill `name`; deprecated: names with metadata.deprecated
function grade(name, c, answer, deprecated) {
  if (deprecated.has(answer)) return { pass: false, why: `deprecated skill ${answer} triggered` };
  if (c.expect === 'trigger') return { pass: answer === name };
  const pass = answer !== name;
  const warn = pass && c.kind === 'near-miss' && c.route_to !== 'none' && answer !== c.route_to;
  return { pass, warn }; // warn: right "not me", wrong neighbour; tighten the neighbour too
}
```

Report one line per case (`ok|FAIL skill: "prompt" → expected X, got Y`) and a total
`n/m routing cases pass (model M)`. Exit non-zero on any failure.

## Reading results

- Look at failures across the **whole catalog**, not only the skill you changed: a sharper
  description here can steal prompts from a neighbour there.
- A positive that routes to `none` means the description does not contain the user's words.
- A positive that routes to a neighbour means the two descriptions overlap; fix both.
- A near-miss with a `warn` (a third skill answered) is not a failure, but a sign the third skill's
  description is too broad.
- Never fix a routing failure by adding the case's exact wording to the description. Add the class
  of phrasing ("criterion ids", "regression test"), then re-run.
- Cheap routers weigh trigger words more than exclusions. When a near-miss keeps landing on the
  wrong skill, move the deciding feature ("broken now" vs "a past change") into the first clause of
  both descriptions rather than lengthening a "Do not use for" list.
- Iterate on the failing prompts only (5 runs each, every candidate description), then confirm with
  one full run of the catalog; a full run per edit is slow and its noise hides the effect.
- When the router may name several skills, a skill loaded beside a neighbour's positive lowers its
  precision without failing a case; it costs context, not a route. Read precision with recall.
- A word in a "Do not use for" clause attracts the prompts it names: name the neighbour, not its
  vocabulary.
- A cheap model sometimes answers `none` on a clear prompt in a long catalog. Count it, but fix a
  description only when the same prompt fails in more than one of three runs.

## Where it runs

| When | Cases | Gate |
|---|---|---|
| a pull request touching `skills/**` or a pinned pack | about 20: the changed skills' cases plus their neighbours' near-misses | 100% or the PR is red |
| the default branch, nightly or weekly | every case in the catalog | 100%; a failure opens an issue |
| a new model adopted for routing | every case, 3 runs | recorded as a `measured` evidence entry |

A suite that exists but is switched off in CI is not a gate. If enabling it needs a secret (a model
API key), name that as the blocker rather than leaving the job silently skipped.
