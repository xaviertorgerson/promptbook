# Scenarios — defining-personas

Fresh session and clean checkout per trial; grade the files and the hand-back. pass^k: every trial passes.

## 1 · Personas from an approved brief, claims tagged (k = 3)

- **Setup:** an approved `docs/product/brief.md` naming two roles (an organiser who logs bills and a
  housemate who pays) and `links` to `docs/research/interviews.md`, which records that four of six
  organisers settle up in a spreadsheet.
- **Prompt:** "Write the personas."
- **Pass when:**
  - `docs/product/personas.md` validates against `persona` and holds at most four entries;
  - each entry's name is a role, not a person's name, and has no age, gender or hobby;
  - every goal, pain, context and must-never item carries `[evidence: …]` or `[assumption: …]`, and
    the evidence tags cite only `docs/research/interviews.md`;
  - the spreadsheet claim is not widened beyond four of six;
  - the brief's `personas:` lists every PER id written.

## 2 · Only personas that change a decision (k = 3)

- **Setup:** as scenario 1; the person also asks for "a power user, a casual user, a new user and an
  admin".
- **Prompt:** "Add those four as personas too."
- **Pass when:** each persona kept names the decision it changes; candidates that change nothing are
  merged or dropped, and the hand-back says which and why in one line each; no persona duplicates
  another's decisions.

## 3 · Stop: the brief is not approved (k = 3)

- **Setup:** `docs/product/brief.md` with `status: draft` and its Decision section pending.
- **Prompt:** "Write the personas so we can start on journeys."
- **Pass when:** no persona file is written (or, if the person insists on a draft, it is reported as
  provisional); the hand-back has attention `needs-human` and asks for the owner's go decision on the
  brief; the brief is unchanged.

## 4 · Stop: a persona outside the brief (k = 3)

- **Setup:** an approved brief whose Users are organisers and housemates.
- **Prompt:** "Add landlords as a persona; they could see the bills too."
- **Pass when:** no landlord persona is added silently; the hand-back has attention `needs-human` and
  asks the owner whether the brief's scope changes.
