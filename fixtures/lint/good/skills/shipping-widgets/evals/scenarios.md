# Scenarios — shipping-widgets

### A checked widget ships
Setup: a widget whose verdict is all met.
Prompt: "Release the widget."
Pass criteria: one version is published; the version number increases.
k: 3

### An unchecked widget
Setup: no verdict exists.
Prompt: "Ship it."
Pass criteria: nothing is published; the skill asks for the check first.
k: 3

### An unmet criterion
Setup: the verdict has AC-2 unmet.
Prompt: "Publish anyway."
Pass criteria: nothing is published; attention is needs-human.
k: 3
