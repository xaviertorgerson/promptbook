# A machine (L1) in detail

## Files the config manager owns

| Source (in the dotfiles) | Renders or installs |
|---|---|
| a data file of pinned sources (the L1 lock: same entries as `toolkit.lock`) | external-source entries that clone each at its commit into `~/.agents/sources/<name>/` |
| a personal instruction template with the rendered standards block | each engine's personal instruction file |
| `agent-policy.yaml` | each engine's user settings, rules and sandbox config (compiled) |
| a per-role model and effort file for personal sessions | each engine's subagent and model settings |
| a run-on-change fan-out script | `~/.agents/skills/` links and engine copies |
| the package and tool manager config | agents and runtimes at exact versions |

Profiles (laptop, workstation, devbox, CI runner) select which engines are installed, which tier
applies and which skill sources are fanned out.

## Fan-out script sketch (POSIX sh)

```sh
#!/bin/sh
# Link pinned skills into ~/.agents/skills, then copy them into engines that do not read it.
set -eu
src="$HOME/.agents/sources"
dst="$HOME/.agents/skills"
mkdir -p "$dst"
for skill in "$src"/*/skills/*/; do
  [ -f "$skill/SKILL.md" ] || continue
  name=$(basename "$skill")
  if [ -e "$dst/$name" ] && [ ! -L "$dst/$name" ]; then
    echo "skip $name: a hand-made skill of that name exists (rename one)" >&2; continue
  fi
  ln -sfn "$skill" "$dst/$name"
done
for link in "$dst"/*; do                      # prune links whose source is gone
  [ -L "$link" ] && [ ! -e "$link" ] && rm "$link"
done
# Engines that do not read ~/.agents/skills get real copies (see engine-notes.md):
for engine_dir in $ENGINE_SKILL_DIRS; do     # set per profile by the template
  mkdir -p "$engine_dir"
  for link in "$dst"/*; do
    name=$(basename "$link")
    rm -rf "$engine_dir/$name.tmp" && cp -RL "$link" "$engine_dir/$name.tmp"
    rm -rf "$engine_dir/$name" && mv "$engine_dir/$name.tmp" "$engine_dir/$name"
  done
done
```

Copy rather than link into engine directories that do not follow symlinks reliably or that skip
links pointing outside a working directory. Hand-made trial skills are real directories the script
never touches.

## Policy compile checklist

- Every tier compiles for every engine listed in its profile, or the compile fails; an
  unrepresentable deny is an error unless `accept_gaps` names it with the operator's reason.
- No output sets a "disable all hooks" switch; no output removes or loosens a project deny.
- Unattended tiers emit nothing into settings that would loosen a project; the runner passes the
  no-prompt mode, the allowlist and the budget.
- An `allow` or `ask` that a `forbid` covers is a warning (it never takes effect); fix the policy.
- The bypass tier names its preconditions in the profile's `requires` (production unreachable by
  network ACL: `prod-unreachable-from-this-host`; non-root in a container: `non-root-container`); the
  compile refuses the tier without them and the operator confirms they hold on that machine.

## Runtime pins

Pin each agent, multiplexer and plugin to an exact version. A bump is a change that: reads the
release notes for removed APIs; checks each plugin's minimum-version floor; compares the runtime's
published API schema before and after; runs the coordinator's smoke scenarios.

## Verify

1. Render all templates for each OS and profile; review the diff.
2. Apply; list skills in each engine; open one fanned-out skill in each.
3. Probe walls under the machine's default mode (`walls.md`).
4. Confirm no personal file appears in a repository (secrets, history, app state are never committed).
