---
name: writing-requirements
description: Use when an epic needs its requirements written or checked — functional ones as EARS sentences, non-functional ones with a category and a measurable target, each tied to the journeys it serves. Do not use for writing a task's acceptance criteria (decomposing-epics) or for choosing an architecture (deciding-architecture).
license: MIT
compatibility: Any agent that reads Agent Skills; needs Node 22 for tools/validate.mjs.
metadata:
  version: 1.0.0
  layer: L3
  author: promptbook
---

# Writing requirements

Write each requirement as one checkable behaviour, then run `node tools/validate.mjs specs/<epic>/spec.md`.
