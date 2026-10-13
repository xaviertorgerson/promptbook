# Flow checklist

## Four states, per screen that shows data

| State | Pass when the flow says |
|---|---|
| Empty | what a first-time user sees and the one action offered; and what a filter with no matches shows |
| Loading | what stays usable; skeleton or progress rather than a blank; what happens after about 10 s |
| Error | what failed in the user's words; what input is kept; how to retry; where help is after repeated failures |
| Success | the populated screen and how the user knows the action worked |

Add `Partial` (some items failed) or `Offline` when a failure path in the journey needs one. "Loading…"
and a blank list are not designs.

## Accessibility (WCAG 2.2 AA unless the project's NFR sets another bar)

- [ ] Every step of the journey completes with the keyboard alone, in a logical order.
- [ ] Focus is visible, and after each action it lands somewhere stated (the new item, the error, the dialog title).
- [ ] Every control has a visible label; icon-only buttons have an accessible name that includes the object ("Delete bill for Rent").
- [ ] Errors are announced, tied to their field, and say how to fix; colour is never the only signal.
- [ ] Status changes that appear without a page load (saved, settled, loading done) are announced.
- [ ] Text contrast is at least 4.5:1 (3:1 for large text and for control boundaries).
- [ ] Touch targets are at least 24 × 24 CSS pixels; nothing needs a precise drag without an alternative.
- [ ] Motion respects reduced-motion preferences; nothing flashes.
- [ ] Dialogs trap focus while open and return it on close; Escape closes them.
- [ ] Data tables have headers and a caption; charts have a table or text alternative.
- [ ] Time limits can be extended; a session timeout warns before it discards input.

Write in the flow's `Accessibility` field only what is specific to it (focus targets, announcements,
the keyboard path). The checklist itself is not copied into every flow.

## Walkthrough protocol

For each CUJ a flow serves:

1. Start from the journey's **Trigger**, in the prototype, as the journey's persona would (their device
   size, keyboard-only for at least one walk).
2. Follow the **Steps**; note any step the prototype cannot reach or where the next action is unclear.
3. Reach the **Success** state and check it matches the journey's observable success.
4. Force the **Unwanted** outcome and each **Failure path**; check the error state lets the user recover.
5. Visit each data screen's empty and loading states.
6. Record one row in Walkthroughs: date, CUJ, who walked (a human, or a separate evaluator; the agent
   that drew the prototype records a self-check, not the walk of record), prototype link or version,
   pass or fail, what failed, what changed.

A walk fails when a step is unreachable, a state is missing, the success differs from the journey, or
the user cannot recover from a failure path. Fix the flow, re-walk, add a new row; never edit an
old row's result.

## Scale and length

| Work | Flows | Prototype | Walks |
|---|---|---|---|
| No user-facing journey | none | none | none |
| Bug in a screen | none; the fix task names the wrong state | none | the affected CUJ, in the real app, by the task's evaluator |
| One-screen change | amend one flow | the changed screen | the CUJs through it |
| Feature or product | one per user-facing CUJ | every step, all four states | every CUJ, at least one keyboard-only |

Target length: about 20 lines per flow; the file about two printed pages for a feature.
