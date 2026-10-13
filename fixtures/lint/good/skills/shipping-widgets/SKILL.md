---
name: shipping-widgets
description: Use when someone says "release the widget", "ship it to the catalog", or wants a checked widget published. Do not use for checking a widget against its spec (checking-widgets) or drafting one (drafting-widgets).
license: MIT
metadata:
  version: "0.1.0"
  layer: L3
---

# Shipping widgets

Publish a widget that passed its check, once, with a version.

## Inputs

- The checking verdict.

## Procedure

1. Confirm every criterion is met.
2. Publish the widget with a new version.

## Outputs

A published widget version.

## Gates and stop conditions

Stop (needs-human) when any criterion is unmet.

## References

None.
