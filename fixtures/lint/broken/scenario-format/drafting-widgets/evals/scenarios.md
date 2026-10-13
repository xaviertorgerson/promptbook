# Scenarios — drafting-widgets

## A clear idea becomes a spec
- **Setup:** an empty project with no widget specs.
- **Prompt:** "Draft a spec for a widget that sorts invoices by due date."
- **Pass criteria:** one spec file exists; its purpose is one sentence; every part has an `AC-n`.
- **k:** 3

## Two ideas in one request
- **Setup:** an empty project.
- **Prompt:** "Draft a widget that sorts invoices and also emails them."
- **Pass criteria:** the skill drafts two specs or asks which one first; it never merges them.

## A purpose nobody can state
- **Setup:** a request with contradictory goals.
- **Prompt:** "Draft a widget that is both read-only and edits every invoice."
- **Pass criteria:** no spec is written; attention is needs-human with the contradiction named.
- **k:** 3
