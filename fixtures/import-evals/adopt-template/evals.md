# adopt-template evals

## Trigger routing

| Prompt | Expected |
| --- | --- |
| "Adopt the template into this repo." | trigger |
| "Retrofit the agentic framework here without losing our docs." | trigger |
| "Add the agentic hooks and skills to this existing project." | trigger |
| "Bootstrap this fresh project." (near miss) | do not trigger (`bootstrap`) |
| "Pull the latest template updates." (near miss) | do not trigger (`scripts/sync-template.mjs`) |

## Scenarios

### An existing safety hook
Fixture: the repo has a destructive-command hook wired only for Copilot.
Assertions: it is wired into Claude Code and extended to recognize `Bash`; no second hook is added;
each hook is probed and the deny is observed.

### Plugin and settings both wired
Fixture: the plugin is installed and `.claude/settings.json` still lists the safety hooks.
Assertions: the settings entries are removed (or the plugin is not installed); a hook never fires
twice; the SessionStart dev-server hook stays in settings.

### A richer AGENTS.md
Fixture: the repo's `AGENTS.md` has thirty domain rules and no fences.
Assertions: the rules are wrapped in `DOMAIN` fences; `GENERIC` blocks are pasted where missing;
nothing the operator wrote is deleted.

## Evidence

- **2026-09, a mature repo.** Its Copilot-shaped hook silently missed Claude Code's `Bash`; adopted
  by wiring, not replacing. Generalized to step 2's "wire or extend".
