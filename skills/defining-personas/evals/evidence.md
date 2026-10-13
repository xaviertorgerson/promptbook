# Evidence — defining-personas

## 2026-09-23 · Ported from agentic-template's persona guidance
- **Kind:** observed
- **Source:** agentic-template docs/app-classes.md and FUTURE.md (PERSONA-CUJ entry) at commit bbfad58
- **Claim:** The template's universal rule is that one persona is the buyer and every other persona is a journey, not a login, and its app classes name personas by role (the pro and the pro's customer, who never logs in). A persona-and-journey skill was deferred until a second project wrote personas by hand.
- **Result:** personas are roles, include users who never log in and upstream systems, and are kept only when they change a decision.

## 2026-09-23 · Never fabricate domain facts
- **Kind:** observed
- **Source:** agentic-template .claude/skills/bootstrap/SKILL.md at commit bbfad58
- **Claim:** The bootstrap rule "Don't fabricate domain facts; ask" kept invented specifics out of project docs.
- **Result:** every persona claim is tagged evidence or assumption, and quotes must be verbatim from a cited source.

## 2026-06-03 · BMAD's planning phase writes a persona-heavy document set
- **Kind:** literature
- **Source:** https://codemyspec.com/blog/bmad-method-explained
- **Claim:** A competing vendor reports BMAD's planning documents running to tens of thousands of tokens; the source is a competitor and secondary.
- **Result:** personas are capped at about 15 lines each and at the ones that change a decision.

## 2026-10-12 · Overviews in context do not help agents
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2602.11988v1
- **Claim:** Repository overviews in context files did not improve task success and raised cost; specific instructions did change behaviour.
- **Result:** personas are cited by id from journeys rather than loaded whole into coding sessions.

## 2026-10-13 · No source measures persona format against outcomes
- **Kind:** audit
- **Source:** harness playbook planning/framing-and-personas.md (Evidence, recommendation line)
- **Claim:** "Only personas that change a decision" is the playbook's rule, not a measured result.
- **Revisit:** when the trace check shows orphan personas across several products, or an evaluation compares persona formats.

## 2026-10-13 · Template validates and evidence tags survive parsing
- **Kind:** measured
- **Source:** node tools/validate.mjs --contract persona skills/defining-personas/references/personas-template.md (harness 4bdc755)
- **Claim:** The template's two entries pass the persona contract; the Must never and Changes labels are ignored by the parser, and inline evidence tags stay inside the goal strings.
- **Skill version:** 0.1.0
