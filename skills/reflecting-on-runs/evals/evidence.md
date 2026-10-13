# Evidence — reflecting-on-runs

## 2026-10-13 · Routes on a 297-character description in the 8,000-character catalog
- **Kind:** measured
- **Source:** node tools/cli.mjs eval-routing skills <Skilldex fc572b6>/skills --skill reflecting-on-runs --runner "<clean-context headless runner>" --json, 3 trials, 2026-10-13 (harness feat/reconcile-skills after 8816da6; runner and full table in skills/ROUTING-RESULTS.md)
- **Claim:** With all 28 descriptions cut to 7,899 characters and the 5 pinned Skilldex skills installed, this skill's own cases passed 33/33; precision 96%, recall 100% over every case in the catalog. The original 763-character description, same runner and cases: 29/33, precision 77%, recall 100%.
- **Result:** Misses: none.
- **Engine:** claude
- **Model:** haiku (claude-haiku-5-5), effort low
- **Skill version:** 0.1.0
- **Revisit:** when any description in the catalog changes, a skill is added, or the routing model changes

## 2026-03-08 · Safety degrades as memory accumulates
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2509.26354
- **Claim:** "Your Agent May Misevolve": misevolution appears across memory, tool and workflow pathways; safety alignment degraded after memory accumulation.
- **Result:** Deltas are pull requests a human merges; the walls guard refuses anything that weakens a deny or gate.

## 2026-03-29 · Wholesale rewrites collapse context; label-free learning drifts
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2510.04618
- **Claim:** ACE: generator, reflector and curator with deterministic delta merges gained 10.6% on AppWorld; a wholesale LLM rewrite collapsed 18,282 tokens to 122 and scored below the no-context baseline; label-free online learning fell below baseline when feedback was unreliable.
- **Result:** One operation on one item per delta; the 10% shrinkage guard; the drift guard.

## 2026-05-21 · Adversarial memory injection mostly succeeds
- **Kind:** literature
- **Source:** https://www.alphaxiv.org/abs/2604.15774
- **Claim:** MemEvoBench measured about 75% attack success from adversarial memory injection in the first round, and safety prompts helped little.
- **Result:** Inputs are data; untrusted content without a human-authored failure behind it cannot produce a delta; imperative text in inputs is reported as possible injection.

## 2026-09-23 · The template's escalation ladder
- **Kind:** observed
- **Source:** agentic-template template-update/REFLECTION.md @ bbfad58
- **Claim:** "If you find yourself repeating an instruction, it becomes a rule; twice a procedure, a skill; every time, a hook."
- **Result:** Step 5 chooses the form by recurrence; hooks and gates are proposed for a human, never written by the reflector.

## 2026-10-12 · Improvement holds up only with an external signal
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2303.11366
- **Claim:** Reflexion's gains come from reflections grounded in execution results; the Darwin Gödel Machine (https://arxiv.org/abs/2505.22954) and GEPA (https://arxiv.org/abs/2507.19457) also improved only against a metric or test.
- **Result:** Step 2 keeps only external signals; the drift guard drops lessons without one.

## 2026-10-12 · Self-correction without feedback can make reasoning worse
- **Kind:** literature
- **Source:** https://arxiv.org/abs/2310.01798
- **Claim:** Intrinsic self-correction without external feedback can degrade reasoning.
- **Result:** An agent's opinion of its own work is listed as not a signal.

## 2026-10-13 · The 10% shrinkage threshold is a default, not a measurement
- **Kind:** audit
- **Source:** playbook: reflection-loop (harness @ 4bdc755)
- **Claim:** The playbook says to reject a delta that shrinks a file "by more than a set fraction" without fixing the number; no source measures a safe fraction.
- **Result:** The skill sets 10% as an adjustable default capped at 25%, and the report shows each rejection so the number can be tuned from evidence.
- **Revisit:** after the first ten reflector pull requests are merged or closed
