---
name: checking-widgets
description: Use when someone asks whether a finished widget meets its spec, says "check this widget", or wants each acceptance criterion verified. Do not use for writing a new widget spec (drafting-widgets) or for releasing a widget (shipping-widgets).
license: MIT
metadata:
  version: "0.1.0"
  layer: L3
---

# Checking widgets

Judge a finished widget against its spec, criterion by criterion; never fix it.

## Inputs

- The widget spec with its `AC-n` criteria.
- The widget itself.

## Procedure

1. Run the widget against each criterion.
2. Record met or unmet with evidence for each.

## Outputs

A verdict per criterion.

## Gates and stop conditions

Hand to a human (needs-human) when a criterion cannot be checked objectively.

## References

None.
