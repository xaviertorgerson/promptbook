---
id: BRIEF
product: Tally
owner: dana
status: approved
updated: 2026-10-13
personas: [PER-1, PER-2]
links:
  - docs/research/interviews.md
---

# Tally

<!-- From Skilldex skills/framing-products/assets/brief-template.brief.md. Fictional sample data. -->

## Problem
People who share a household cannot see who owes whom without rebuilding a spreadsheet each month.
Today the organiser keeps the sheet and chases housemates in a group chat; four of six interviewees
settle up this way, and three of six call the chasing the worst part (docs/research/interviews.md).

## Users
- Organiser — logs shared bills and wants the month settled without chasing.
- Housemate — pays their share and wants to see it from a link, without an account.

## Outcomes
| Outcome | Measure | Baseline | Target | By |
|---|---|---|---|---|
| Months settle without a spreadsheet | share of pilot households that settle a month entirely in Tally | unknown | 4 of 5 | 2027-01-31 |
| Less chasing | reminders the organiser sends per settled month, self-reported | unknown | at most 1 | 2027-01-31 |

## Non-goals
- Moving money: Tally records who paid whom; it never collects or transfers payments.
- Personal budgeting or expense categories beyond the shared household.

## Constraints
- One part-time developer; first pilot by 2026-12-15.
- Personal data stays minimal: names and email addresses only.

## Assumptions
| # | We believe | Evidence or test | Reshape or kill if |
|---|---|---|---|
| A1 | Housemates will open a link and mark a share paid without creating an account | five-household pilot | fewer than 3 of 5 households settle a month |
| A2 | One organiser per household logs most bills | interviews (docs/research/interviews.md) | pilot shows bills logged evenly by everyone |
| A3 | Link-based access can keep one household's bills invisible to another | the walking skeleton with two households | any cross-household read in the negative-path suite |

## Riskiest assumption
A3, because a leak between households ends the product and nothing yet shows link-based access can
be isolated. Tested first by the walking skeleton (SPLIT-1), about two days.

## Open questions
- [ ] Do pilot households want email reminders at all? — answered by dana after the pilot

## Decision
go · dana · 2026-10-13 · test A3 in the skeleton, then pilot with five households (fictional proof decision)
