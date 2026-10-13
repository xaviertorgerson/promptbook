# Evidence — framing-products

## 2026-09-23 · Ported from agentic-template bootstrap
- **Kind:** observed
- **Source:** agentic-template .claude/skills/bootstrap/SKILL.md and evals.md at commit bbfad58
- **Claim:** Kept the stack-neutral, proven parts: a short adaptive interview of three to five questions that asks only what cannot be inferred, success criteria and explicit non-goals, "just enough, not spec-driven", and "don't fabricate domain facts; ask". Dropped the stack, port-block, env-schema, forge and design-preset steps (L4 template machinery).
- **Result:** the interview, the non-goals rule and the no-fabrication rule became procedure steps 2-3.

## 2026-09-23 · A deferred persona-and-journey skill names the gap this closes
- **Kind:** observed
- **Source:** agentic-template FUTURE.md at commit bbfad58 (PERSONA-CUJ entry)
- **Claim:** The template deferred a skill that writes personas and journeys before the first spec until a second child wrote them by hand; nothing framed the product itself before the spec.
- **Result:** the brief became its own stage, ahead of defining-personas.

## 2026-10-12 · Spec Kit's intake ends in go, needs-clarification or kill
- **Kind:** vendor-reported
- **Source:** https://github.com/github/spec-kit
- **Claim:** Spec Kit's idea-assessment extension runs intake, research, define, shape and decide, ending in go / needs-clarification / kill, so a framing stage that ends in a decision is established practice.
- **Result:** the skill ends at a go / reshape / kill gate the owner decides.

## 2026-10-12 · Product specs not in the repository are invisible to agents
- **Kind:** vendor-reported
- **Source:** https://openai.com/index/harness-engineering/
- **Claim:** OpenAI's agent-built product kept product specs in a docs/ system of record; knowledge outside the repository was effectively invisible to the agent.
- **Result:** the brief lives at docs/product/brief.md and is cited by section, not pasted into instructions.

## 2026-10-12 · Overviews in context files do not raise task success
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2602.11988v1
- **Claim:** Repository context files did not improve coding task success and raised cost over 20%; specific instructions were followed.
- **Result:** the brief is capped at one page and is not loaded into coding sessions.

## 2026-10-12 · Heavy planning documents are slow and get skipped
- **Kind:** literature
- **Source:** https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- **Claim:** Böckeler found spec-driven tools produced verbose documents that were overkill for small work and that agents still ignored.
- **Result:** the size table in step 1 skips the brief for bugs and features, and the brief has a word budget.

## 2026-10-13 · Brief template validates against the contract
- **Kind:** measured
- **Source:** node tools/validate.mjs --contract brief skills/framing-products/references/brief-template.md (harness 4bdc755)
- **Claim:** The template's frontmatter and four required sections pass the brief contract unfilled, and the filled copy in the planning proof project passes the trace check.
- **Skill version:** 0.1.0
