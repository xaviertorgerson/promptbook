# Reflection loop

## Problem

Lessons from failures evaporate unless someone writes them down, and nobody does consistently. Left
to itself, an agent that rewrites its own instructions shrinks them into generic advice, deletes what
it does not understand, and absorbs whatever a poisoned input told it. Self-improvement without an
external signal makes things worse.

## Practice

Three roles, kept separate:

| Role | Does | Never |
|---|---|---|
| Generator | the ordinary agents doing work; their run records, transcripts, evaluator verdicts and evidence logs are the input | edits instructions mid-task |
| Reflector | a scheduled job reads recent failures (red verdicts, `needs-human`, reverts, repeated corrections) and extracts candidate lessons, each tied to evidence | writes to instruction files |
| Curator | turns accepted lessons into **small itemized deltas** against one skill, rule, knowledge entry or eval, merged by deterministic tooling | rewrites a file wholesale |

- **Deltas are pull requests, never auto-merged.** Each PR names the evidence, the target file, the
  delta, and the eval that will catch a regression. A human merges it.
- **Escalate by recurrence:** an instruction repeated becomes a rule; a procedure pasted twice becomes
  a skill; something that must happen every time becomes a hook or a gate.
- **Fix the source, not the output.** A correction that keeps recurring is fixed in the stage
  contract, skill or reference that produced it.
- **Only external signals count.** Tests, evaluators with rubrics, humans' review findings and reverts
  are signals; an agent's opinion of its own work is not.
- **Guard against collapse and misevolution.** Reject a delta that shrinks a file by more than a set
  fraction, removes evidence-backed lines, or arrives from untrusted content (an issue, a web page)
  without a human-authored failure behind it. Keep memory as versioned files so every change can be
  reverted.

## Evidence

- 2026-03-29 · controlled · ACE (ICLR 2026): generator/reflector/curator with deterministic delta
  merges gained 10.6% on AppWorld; a wholesale rewrite collapsed 18,282 tokens to 122 and fell below
  the no-context baseline; label-free online learning fell below baseline when feedback was unreliable
  ([arXiv 2510.04618](https://arxiv.org/abs/2510.04618)).
- 2026-03-08 · controlled · "Your Agent May Misevolve": safety alignment degraded as memory accumulated
  ([arXiv 2509.26354](https://arxiv.org/abs/2509.26354)).
- 2026-05-21 · controlled · MemEvoBench: about 75% attack success from adversarial memory injection in
  round one ([alphaXiv 2604.15774](https://www.alphaxiv.org/abs/2604.15774)).
- 2023–2026 · controlled · Reflexion, the Darwin Gödel Machine and GEPA improved only with external
  signals ([2303.11366](https://arxiv.org/abs/2303.11366); [2505.22954](https://arxiv.org/abs/2505.22954);
  [2507.19457](https://arxiv.org/abs/2507.19457)).
- 2026-05-19 · vendor · Managed Agents "dreaming" can auto-apply or require review; a customer's 6×
  completion claim has no stated method ([Claude blog](https://claude.com/blog/new-in-claude-managed-agents)).
- 2026-03-26 · secondary · Claude Code's Auto Dream reportedly deletes contradictions with no changelog
  ([Level Up Coding](https://levelup.gitconnected.com/your-ai-coding-agent-now-needs-sleep-heres-what-dream-actually-does-81d32977ec25)).
- 2026-03 · self-reported · ICM's Edit-Source Principle fixes recurring corrections in the stage
  contract ([arXiv 2603.16021](https://arxiv.org/html/2603.16021)).
- 2026-09-23 · practice · agentic-template's escalation ladder: repeated instruction → rule; twice a
  procedure → skill; every time → hook ([REFLECTION.md](https://github.com/xaviertorgerson/agentic-template/blob/master/template-update/REFLECTION.md)).

## Contracts used

`evidence` (input and output), `run-record` (failure signals), `skill`, `task` (a delta PR is a task
with `risk` set by its target).

## Anti-patterns

- An agent that appends "lessons" to its instruction file at the end of each session.
- A reflector that rewrites a whole skill "for clarity".
- Auto-merging consolidation output.
- Learning from transcripts that contain untrusted instructions.

## Revisit when

A controlled study shows label-free reflection improving coding agents without human review, or the
project's own reflector PRs are accepted unmodified for months.
