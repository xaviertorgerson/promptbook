# Decisions

<!-- Entries for DECISIONS.md (or one file per ADR under docs/adr/). One-way door: 15-30 lines,
     Status Proposed until a human accepts. Two-way door: about five lines. Ids are four digits and
     never reused; accepted entries are never edited, only superseded. Each **Label:** starts a line;
     a field runs to the next label. Satisfies uses <epic>/NFR-n or <epic>/REQ-n.
     Check: harness validate DECISIONS.md (or --contract decision <file> elsewhere). -->

## ADR-0001: <the decision, as a statement>
**Status:** Proposed
**Date:** 2026-01-01
**Decision:** <what we will do, specific enough to check>
**Why:** <the ranked quality attributes and constraints that force the choice, in two or three lines>
**Options considered:**
- <option A: the pack's default or "do nothing"> — rejected: <which ranked attribute it fails, and how>
- <option B> — rejected: <why>
- <option C, chosen> — <why it wins on the ranked attributes>
**Door:** one-way
**Reversed when:** <a measurable condition, e.g. "p95 exceeds 300 ms at 20 rps for a week" or "a second region is required">
**Satisfies:** my-epic/NFR-1, my-epic/REQ-2
**Fitness function:** <the automated check that fails when the code drifts from this decision>
**Consequences:** <what becomes easier, what becomes harder, what this rules out>

## ADR-0002: <a cheap, reversible choice>
**Status:** Accepted
**Date:** 2026-01-01
**Decision:** <one line>
**Why:** <one line naming the attribute it serves>
**Door:** two-way
**Reversed when:** <the condition that would switch it>
**Satisfies:** my-epic/NFR-2
**Consequences:** <one line>

## ADR-0003: Deviate from the <pack> stack pack: <what differs>
**Status:** Proposed
**Date:** 2026-01-01
**Decision:** Use <alternative> instead of the pack's <default> for <scope>.
**Why:** <the NFR the pack's default cannot meet, with the measure>
**Options considered:**
- Keep the pack's <default> — rejected: <measured or argued shortfall against the NFR>
- <alternative, chosen> — meets <NFR> at <cost>
**Door:** one-way
**Reversed when:** <the trigger that ends the deviation, e.g. "the pack ships <capability>" or "load falls below N">
**Satisfies:** my-epic/NFR-3
**Fitness function:** <the check that keeps the deviation contained to its scope>
**Consequences:** <what the project now maintains outside the pack>
