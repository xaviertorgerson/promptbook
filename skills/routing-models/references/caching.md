# Caching

Agents read far more than they write (input:output around 100:1 in one vendor's measurement), so
cost is dominated by input and by cache misses.

## Economics (one vendor's published multipliers, 2026-10; check yours)

- A cache read costs a small fraction of base input (0.05× to 0.1× depending on model).
- A cache write costs 1.25× base input for a short lifetime (minutes) or 2× for a long one (an hour).
- A short-lived write pays for itself on the first reuse (1.25 + 0.1 < 2); a long-lived one after about two.
- A minimum prefix length applies; shorter prompts are not cached and nothing errors.
- In one vendor's agent-loop measurements caching cut cost 2.7–5.3×.

## What invalidates the cache

| Change | Invalidates |
|---|---|
| the tool list (added, removed, reordered) | everything |
| the system instructions | instructions and all messages after them |
| effort or thinking settings | messages |
| the model | everything (a different model has its own cache) |
| an edited earlier turn | everything after it |

## Rules

1. One stable prefix per role: instructions, then tools in a fixed order. No timestamps, run ids,
   random ordering or per-run data in it; put those in the first user message.
2. Append only. Do not rewrite earlier turns to "clean up" context; compact at a boundary instead.
3. Change model, effort or tools only at a task or subagent boundary.
4. Make cache-breaking changes on the request right after a compaction, when the prefix is being
   rebuilt anyway.
5. Long loops with pauses longer than the short lifetime use the long-lived cache.
6. Measure: cache hit rate = cache-read tokens ÷ (input + cache-read + cache-write tokens). A drop
   names a cause; find it before tuning anything else.
