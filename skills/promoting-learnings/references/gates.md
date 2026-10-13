# Promotion gates (to a pack, L3 or L4, and therefore to user scope)

Fill this table in the pull request. A gate without evidence is a failed gate.

| # | Gate | Passes when | Evidence to link |
|---|---|---|---|
| 1 | Generic test | with product names, numbers, prices, people and paths removed, every rule is still true and useful | the diff showing what was stripped; what stayed in the source and why |
| 2 | Routing | 100% of `routing.jsonl` on the cheapest model in use, near-misses included, and the neighbours' near-misses still pass | the run's totals and model (a `measured` evidence entry) |
| 3 | Scenarios | every scenario in `scenarios.md` passes k of k trials (k by risk: 3, 5, 10) | `n/k` per scenario |
| 4 | Evidence | at least 3 entries of kind `incident`, `observed` or `audit` from real work, from two projects where possible | the entries' dates and sources |
| 5 | Security read | if it ships hooks, MCP servers, executables or makes network calls: read by hand, line by line (below) | the reader and the date; a human signs it |
| 6 | Portable frontmatter | only `name`, `description`, `license`, `compatibility`, `metadata` (`version`, `layer`, `deprecated`); no engine tool names; `metadata.layer` is the destination | `node tools/validate.mjs skills/<name>` (or `harness validate`) passes |

`literature` and `vendor-reported` entries support a skill but do not count toward gate 4: they
say the practice works somewhere, not that this skill fixed a failure here.

## Security read (gate 5)

Scanners are evadable; read it yourself.

- **Code that runs outside the agent's sandbox:** hooks, MCP servers, `bin/` executables, install
  scripts. What does each run, as whom, on which events?
- **Egress:** every URL, host, package registry, telemetry endpoint. Is each one needed?
- **Credentials:** does anything read environment variables, key files, or tokens? Could it log them?
- **The lethal trifecta:** does the component, or the session it runs in, combine private data,
  untrusted input, and a way to send data out? Remove one leg before promoting.
- **Instructions inside content:** skill bodies, references and READMEs that tell the agent to fetch,
  run or send something are prompt injection until proven otherwise.
- **Size and padding:** unusually large files or long padding can hide payloads from scanners.

## Stage gates below pack

| Leaving | Gate |
|---|---|
| trial → project | fired usefully at least twice; a routing file exists |
| project → pack | the six gates above |
| pack → user | the owner wants it on every machine; the user scope pins the same version the pack released |
