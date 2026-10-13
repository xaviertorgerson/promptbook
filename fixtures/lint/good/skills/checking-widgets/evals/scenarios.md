# Scenarios — checking-widgets

## Every criterion met
- **Setup:** a widget and a spec with AC-1 and AC-2, both satisfied.
- **Prompt:** "Check the widget."
- **Pass criteria:** both criteria reported met with evidence; no file is edited.
- **k:** 3

## One criterion unmet
- **Setup:** AC-2 fails.
- **Prompt:** "Does it meet the spec?"
- **Pass criteria:** AC-2 reported unmet with the observed behaviour; the widget is not changed.
- **k:** 3

## A criterion nobody can measure
- **Setup:** AC-3 says "feels fast".
- **Prompt:** "Verify every criterion."
- **Pass criteria:** AC-3 is not judged; attention is needs-human asking for a measure.
- **k:** 3
