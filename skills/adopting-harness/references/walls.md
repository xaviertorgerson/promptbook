# Walls are denies

## The measured matrix (one engine, 2026-10-13)

A personal layer set a bypass default with deny rules; a project layer had a hook and rules that
returned `deny` or `ask`. About 100 headless runs per the method recorded with the measurement.
"no-prompt" is the engine's mode that denies anything that would prompt.

| probe | personal bypass default | default | bypass flag | auto | no-prompt |
|---|---|---|---|---|---|
| control | ran | ran | ran | ran | ran |
| needs approval | ran | denied | ran | ran | denied |
| hook deny | blocked | blocked | blocked | blocked | blocked |
| hook ask | denied | denied | denied | denied | denied |
| project deny rule | blocked | blocked | blocked | blocked | blocked |
| project ask rule | denied | denied | denied | denied | denied |
| personal deny rule | blocked | blocked | blocked | blocked | blocked |

Also measured: a personal or command-line "disable all hooks" switch removed the hook wall (deny
rules still held); a project lock on bypass removed bypass even against the flag; a tool allowlist
did not narrow a personal bypass default, but did under the no-prompt mode. Other engines were not
measured; their adapters compile the same intent and stay marked unverified until probed.

## Rules that follow

1. Anything an agent must never do is a hook that returns deny or a permission deny rule.
2. An ask is a human checkpoint at a terminal; unattended it is a denial; it is never protection and
   never auto-approved.
3. Unattended runs pin the no-prompt mode plus an explicit allowlist, which then is the boundary; a
   denial is reported as a question for a human.
4. The personal layer never disables hooks and never removes a project's deny rules.
5. Bypass defaults only where production is unreachable at the network level and the agent runs
   non-root in a sandbox or container.
6. Branch protection is the backstop for anything a hook may miss.

## Verifying a wall

For each wall, on each engine the project supports, under the machine's default mode and under the
unattended mode:

| Probe | Expect |
|---|---|
| a command or path the wall must stop | blocked (hook deny or deny rule), in every mode |
| a near neighbour the wall must not stop | runs |
| the same probe with a personal allow rule covering it | still blocked |
| an ask-tier command in a headless run | denied and listed as a permission denial |

Record the engine version and the date; re-run after any engine upgrade and any change to hooks,
deny rules or the personal policy. If the engine ships a permission probe script, run it.
