# Flags: dark launch, kill switch, cleanup

## Dark launch, step by step

1. **Ship off.** The flag is created disabled in every environment, in the same PR as the code
   path it guards. The default branch can release at any time with the path dark.
2. **Team.** Enable for internal users or the team's accounts in production. Watch errors and the
   flag's own metrics for a day.
3. **Percentage.** Enable for a small percentage (for example 5%, then 25%, 50%), each step watched
   for a fixed window with an error-rate comparison between flag on and off.
4. **All.** Enable for everyone. Keep the flag as a kill switch for one release.
5. **Remove.** Delete the flag and the dead branch of code in a normal PR. The flag's removal date
   is a task in the queue, not a memory.

Outbound and money-moving side effects (emails to customers, payments, webhooks to partners) sit
behind enable toggles that default off outside production; a worker that finds its toggle off logs
what it would have done and exits.

## Kill switch

- Every risky flag can be turned off without a deploy, by a human on call, in under a minute.
- Turning it off is safe at any traffic step: the off path is the previously released behavior,
  tested in the same suite.
- An automatic rollback can flip a flag instead of redeploying when the flag isolates the breach.

## Flag registry entry

| Field | Example |
|---|---|
| key | `rating.rerate_v2` |
| owner | `maria` |
| task | `BILL-7` |
| default per environment | dev on · QA on · UAT on · production off |
| current rollout | team only |
| kill switch | yes; off restores v1 rerate |
| guards side effects | no |
| removal date | 2026-11-15 |

A flag past its removal date is reported for a human decision (remove, or record why it stays).
Flags that never close turn configuration drift into the product.

## Who may change a flag

Agents may set flags in previews and dev. Changing a production flag is a release decision: a
human, or automation the human configured (the rollback watcher flipping a kill switch).
