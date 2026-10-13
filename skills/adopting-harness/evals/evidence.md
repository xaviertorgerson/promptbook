# Evidence — adopting-harness

## 2026-10-13 · Routes on a 298-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill adopting-harness --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 45/45; precision 100%, recall 96% over every case in the catalog. The original 882-character description, same runner and cases: 42/45, precision 77%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-10-13 · Only denies are walls under a personal bypass layer
- **Kind:** measured
- **Source:** agentic-template DECISIONS.md ADR-0021 and scripts/permission-probe.mjs (branch docs/adr-permission-precedence, commit c177fa1)
- **Claim:** Under a personal bypass default, project hook denies and deny rules blocked in every mode; asks were denials headless; a personal or command-line disable-all-hooks switch removed the hook wall; an allowlist bounded tools only under the no-prompt mode.
- **Result:** Walls are denies; L1 never disables hooks; unattended runs pin the no-prompt mode with an allowlist.
- **Engine:** claude
- **Revisit:** on an engine upgrade, or when a second engine is probed

## 2026-09-23 · Ported from agentic-template's adopt-template
- **Kind:** observed
- **Source:** agentic-template .claude/skills/adopt-template/SKILL.md and evals.md (commit bbfad58)
- **Claim:** Adoption into an existing repo works when it is additive and reconciling: inventory first, extend an existing safety hook rather than add a parallel one, verify each hook fires, keep the owner's rules and docs, report what was added, reconciled and needs the owner's eyes.
- **Result:** Kept the golden rule, the inventory, hook reconciliation and verification, and the report. Dropped the plugin install commands, `.template-version`, the GENERIC/DOMAIN fences and the template's file manifest; replaced them with `toolkit.lock`, the rendered standards block and the layer decision test.

## 2026-10-13 · The layer guide is the source of every move
- **Kind:** observed
- **Source:** harness LAYERS.md and standards/engineering.md (commit 4bdc755)
- **Claim:** Each artifact belongs to one layer by who must see it and whether it names an engine; the standards block is rendered into L1 and L2; cloud sessions and CI see only L2.
- **Result:** The classification step and the deletion table; the "repos today → target" checklist generalizes the guide's per-repo tables.

## 2026-10-12 · One engine does not read the shared skills directory
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/skills
- **Claim:** Claude Code reads skills from its own user and project directories and plugins; its docs do not list `.agents/skills`, while Codex, Gemini CLI and others read it.
- **Result:** The fan-out links into `~/.agents/skills` and copies into engines that do not read it.

## 2026-10-12 · Precedence on skill name collisions differs by engine
- **Kind:** vendor-reported
- **Source:** https://geminicli.com/docs/cli/skills/
- **Claim:** Gemini CLI lets workspace skills override user skills, the reverse of Claude Code; Codex shows both.
- **Result:** Rename on collision; never rely on shadowing.

## 2026-10-12 · A public dotfiles pattern for skill fan-out
- **Kind:** observed
- **Source:** https://github.com/ryjo1026/dotfiles
- **Claim:** Pinned external sources cloned into `~/.agents/sources`, merged into `~/.agents/skills` as links by a run-on-change script, then fanned out to agents that do not read it; hand-made trial directories win on collision.
- **Result:** The machine procedure and the fan-out sketch.

## 2026-04-16 · Pin skills by commit and tree
- **Kind:** vendor-reported
- **Source:** https://github.blog/changelog/2026-04-16-manage-agent-skills-with-github-cli/
- **Claim:** `gh skill` pins by ref and compares tree SHAs on update.
- **Result:** Lock entries carry both commit and tree; the tree id detects a rewritten tag or a force-pushed mirror.

## 2026-02-12 · Instruction files help only with non-obvious rules
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2602.11988v1
- **Claim:** Repository context files generally did not improve task success and raised cost over 20%; specific instructions were followed; overviews did not help.
- **Result:** `AGENTS.md` stays a short map; duplicated and narrative rules are deleted.

## 2026-10-12 · Cloud sessions read only the project's settings
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/settings
- **Claim:** Cloud sessions read the clone's project settings but not user or local settings.
- **Result:** Anything that must hold in CI or a cloud session is L2, or pinned in `toolkit.lock`.

## 2026-10-12 · Bypass only non-root with restricted egress
- **Kind:** vendor-reported
- **Source:** https://code.claude.com/docs/en/devcontainer
- **Claim:** Skipping permissions is acceptable only for a non-root user in a container with egress restrictions.
- **Result:** A bypass or autonomous tier carries that precondition and the operator confirms it.
