---
name: drafting-widgets
description: Use when someone asks to draft a widget spec, sketch a new widget, says "write up this widget idea", "spec out a widget", "what would a widget for X look like", "turn this note into a widget spec", "outline the widget parts", "number the acceptance criteria for this widget", or "start a widget from scratch" before any widget exists. Do not use for checking a finished widget against its spec (checking-widgets) or for releasing a widget (shipping-widgets).
license: MIT
metadata:
  version: "0.1.0"
  layer: L3
---

# Drafting widgets

Turn a widget idea into a one-page widget spec a builder can start from.

## Inputs

- The request, in the user's words.
- Any existing widget specs in the project.

## Procedure

1. Restate the widget's purpose in one sentence.
2. List the widget's parts, each with one acceptance criterion `AC-n`.
3. Write the spec from the template in [references/template.md](references/template.md).

## Outputs

A widget spec file with every criterion numbered.

## Gates and stop conditions

Stop and set attention `needs-human` when the purpose cannot be stated in one sentence.

## References

- references/template.md — the spec template.
