# Promotion and deprecation

## Problem

Good procedures are invented inside one project and stay trapped there; the next project rediscovers
them. Promoted carelessly, a project quirk becomes everyone's rule. Old skills linger and keep
triggering, and because engines resolve name collisions in opposite directions, "shadow it with a
newer copy" behaves differently in each engine.

## Practice

**Promotion path:** trial → project → pack → user.

| Stage | Where | Gate to the next stage |
|---|---|---|
| trial | an untracked folder on one machine | fired usefully at least twice |
| project | L2 `.agents/skills/<name>/` (portable) | routing eval green; one evidence entry |
| pack | L3 `skills/` if engine- and stack-neutral, else an L4 pack | all gates below |
| user | L1 fan-out to `~/.agents/skills` (and engine copies) via a pin | the owner wants it everywhere |

Gates to L3 or an L4 pack:

1. **Generic test:** strip product names, numbers and paths; what remains is still true and useful.
2. **Routing eval at 100%** on the cheapest model in use, including near-misses.
3. **Scenario evals** passing at pass^k.
4. **At least three evidence entries** from real failures, in at least two projects where possible.
5. **Security read** if it carries hooks, MCP servers or executables.
6. **Portable frontmatter**: core fields only; engine extras in an adapter sidecar.

**Rename on promotion.** The promoted skill takes a new name (or prefix) and the project copy is
deleted in the same change. Never rely on precedence to shadow one copy with another.

**Pinning.** Every consumer pins what it uses in `toolkit.lock` (source, ref, commit, tree hash,
`autoUpdate: false` for third parties). Bumps arrive as pull requests that run the eval suite.
Third-party packs are mirrored into your own marketplace at a pinned commit, never consumed live.

**Deprecation.**

1. Set `metadata.deprecated` with the replacement's name, for one minor release.
2. Add a rename entry in the pack's manifest so installers move consumers forward.
3. Add an eval that **fails if the deprecated skill triggers** on its old prompts.
4. Delete it in the next minor release. Git history is the archive.

## Evidence

- 2026-10 · vendor · precedence differs: Claude Code lets personal skills override project ones,
  Gemini CLI the reverse, and Codex shows both ([Claude Code](https://code.claude.com/docs/en/skills);
  [Gemini CLI](https://geminicli.com/docs/cli/skills/); [Codex](https://learn.chatgpt.com/docs/build-skills)).
- 2026-02-05 · practitioner · 13.4% of 3,984 public skills had a critical issue, 76 malicious
  ([Snyk](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub)); 2026-06-23 · practitioner ·
  malicious skills passed scanners ([Unit 42](https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain-risk/)).
- 2026-10 · vendor · with plugin auto-update on, reviewed files can change on disk
  ([plugin security](https://code.claude.com/docs/en/plugins/security)); marketplace entries can pin a
  40-char `sha` ([reference](https://code.claude.com/docs/en/plugins/marketplace-reference)).
- 2026-04-16 · vendor · `gh skill` pins by ref and compares tree SHAs on update
  ([GitHub](https://github.blog/changelog/2026-04-16-manage-agent-skills-with-github-cli/)); APM's lockfile
  pins versions and content hashes ([APM](https://microsoft.github.io/apm/)).
- 2026-09-23 · practice · agentic-template's `promote-to-template` applies a generic test, picks a home
  by kind and logs changes as additive, behavioral or breaking
  ([SKILL.md](https://github.com/xaviertorgerson/agentic-template/blob/master/.claude/skills/promote-to-template/SKILL.md)).
- 2026-08-11 · practice · Skilldex retired a superseded skill outright
  ([commits](https://github.com/QuentinTorg/skilldex/commits/main)).
- recommendation · the four stages, the three-evidence gate and the deprecation eval are this
  playbook's rules; no source documents skill deprecation metadata in any engine.

## Contracts used

`skill` (`metadata.version`, `metadata.deprecated`, `metadata.layer`), `toolkit-lock`, `evidence`;
`tools/lock.mjs` (drift fails CI), `tools/lint-skills.mjs` (portable frontmatter).

## Anti-patterns

- Copying a project skill to user scope under the same name.
- `autoUpdate: true` on a third-party marketplace.
- A deprecated skill left installed "in case".
- Promoting on enthusiasm, with one evidence entry from the day it was written.

## Revisit when

The Agent Skills spec adds version or deprecation fields, or engines converge on one precedence order.
