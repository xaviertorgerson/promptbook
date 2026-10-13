# Engine notes: precedence and rename maps

The procedure renames on promotion precisely because engines disagree. The adapters own the
mapping; re-check them before relying on any line here.

## Name collisions across scopes (as documented 2026-10)

- **Claude Code:** personal skills override project skills of the same name.
- **Gemini CLI:** workspace skills override user skills; within a tier the shared `.agents/skills/`
  directory beats the engine's own.
- **Codex:** duplicate names from different scopes both appear.
- **Amp:** first match wins, with user-global locations checked first.

Consequence: a same-named copy in another scope behaves differently per engine. Rename.

## Rename maps in plugin marketplaces

- A Claude Code plugin marketplace can carry a `renames` map that migrates installs from an old
  plugin name to a new one, and entries can pin a 40-character `sha`.
- Codex reads a plugin marketplace from `.agents/plugins/marketplace.json`; whether it honors a
  rename map was not verified.
- Skill-level renames inside one plugin have no manifest field in any engine read; the deprecation
  marker and the failing routing eval carry them.

## Auto-update

With plugin auto-update on, files you reviewed can change on disk. Keep it off for third-party
sources and let the lock bump pull request be the update.
