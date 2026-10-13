# Evidence — writing-tests

## 2026-09-21 · Tests existed but no test name carried a criterion id
- **Kind:** audit
- **Source:** agentic-template .claude/skills/test-author/evals.md @ bbfad58
- **Claim:** In the template audit, tests existed but none named a criterion id, so coverage of criteria was unverifiable.
- **Result:** Criterion ids go in test names, checked by a script before review (step 2, step 8).

## 2026-10-12 · Passing tests are not done; the verifier must be nearly perfect
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/building-c-compiler
- **Claim:** Anthropic's parallel-agents compiler project found the task verifier must be nearly perfect, and that passing tests can make work appear done when it is not.
- **Result:** Step 7: each test is shown to fail without the change; tests prove criteria, not just run green.

## 2026-10-12 · Agents told not to edit tests, and tracked features in JSON
- **Kind:** vendor-reported
- **Source:** https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Claim:** Anthropic's long-running-agent harness told agents it is unacceptable to remove or edit tests, and kept its feature list in JSON because models tamper with it less than with Markdown.
- **Result:** The never-weaken gate and scenario S4.

## 2026-10-13 · The coverage readers see only JS/TS test calls
- **Kind:** measured
- **Source:** node -e probe of tools/lib/ears.mjs testNames/namedIn (harness @ 4bdc755)
- **Claim:** The extractor finds AC-2 in `it('AC-2 …')` and `test('BILL-7 AC-2: …')`, but not in Go `t.Run("AC-2 …")`, JUnit `@DisplayName("AC-2 …")` or Python `test_ac_2_…`; the template's ears-coverage.mjs uses the same pattern.
- **Result:** references/naming.md says which forms are checked automatically and tells the agent to report, not claim, coverage elsewhere.
- **Revisit:** when the trace check reads other runners' names

## 2026-10-13 · Ported from the template's test-author
- **Kind:** observed
- **Source:** agentic-template .claude/skills/test-author/SKILL.md and evals.md @ bbfad58
- **Claim:** Priority order, Arrange–Act–Assert, fake at the boundary, a regression test per bug, never weaken tests, and criterion ids in test names are stack-neutral; the template ships them to every child project.
- **Result:** Kept all of them and the three scenarios. Dropped Vitest and Playwright, the per-branch database command, the core/adapters folder names and the code-review cross-reference; added the qualified BILL-7 AC-2 form, the fail-first proof and the negative permission test as stack-neutral rules.
