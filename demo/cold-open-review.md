# Cold-open review: decisions nobody signed off on

The exercise from Topic 1b: open the output and count the decisions that were made without you. Each row below is one. The "BRD says" column shows whether the intent existed somewhere and simply never reached the prompt. The "Caught by" column shows which course topic would have stopped the guess.

## 1. Against the BRD: what it got wrong or missed

| # | What the app decided | What the BRD says | Caught by |
|---|---|---|---|
| 1 | **No minimum-headcount rule.** "Coverage" is a 14-day chart of people away vs. shifts scheduled, with no threshold and no notion of a gap. | Coverage validation is "minimum headcount per shift", and it blocks conflicts. This is the app's core objective. | T17–T19 spec, T24 acceptance criteria |
| 2 | **Approving leave cancels the clashing shifts** ("Approve and release them?"). No replacement is assigned and no gap is raised. | A coverage gap must not slip through unnoticed. | T15 / T26 (the coverage ADR), T11 Plan Mode review |
| 3 | **HR cannot configure coverage thresholds.** There is no setting for them at all. | HR Admin "configures … minimum coverage thresholds". | T18 interrogating the idea |
| 4 | **No accrual.** The full annual allowance is granted on 1 January. Only a year-end carry-over exists. | "One accrual rule", "accrual rules, carry-forward caps". | T19 SPEC (Constraints) |
| 5 | **No teams.** `department` is a free-text column on the user, and a manager's team is "same department or reports to me". | Multi department/team. | T22 HLD, T23 data model |
| 6 | **The manager dashboard shows no "today's coverage gaps"**, because gaps don't exist as a concept (see #1). | Success criterion 3: the manager sees today's coverage gaps and pending approvals in one view. | T24 acceptance criteria |
| 7 | **Swaps check approved leave only.** A swap onto someone with *pending* leave for that day goes through. | Success criterion 2 covers approved leave, so this one is technically met. Whether pending leave counts is a question nobody asked. | T18, T31 |
| 8 | **Notifications are in-app only** (a bell with an unread count). There are no reminders and no coverage alerts. | "Approval, coverage, and reminder alerts". | T19 Scope |

## 2. Invented rules: plausible, but nobody chose them

| # | Decision | Why it matters |
|---|---|---|
| 9 | A shift needs 8 hours of rest before it, can be at most 16 hours long and at least 30 minutes | These are labour-law-style rules, which vary by country and contract. A policy decision is hard-coded in `shifts.js`. |
| 10 | Leave counts Monday to Friday minus public holidays, and there is a holiday calendar | This bakes in a five-day week, while the BRD explicitly mentions teams that work "throughout the week". |
| 11 | Half days are allowed, but only for single-day requests | A feature that wasn't asked for, with a rule attached. |
| 12 | Pending requests reserve balance | A reasonable choice, but it's a business rule. |
| 13 | Leave types can skip approval and are recorded instantly, unless the person is rostered | The BRD says single manager approval. This adds a second path. |
| 14 | Leave types can allow a negative balance | A policy decision. |
| 15 | **A swap is auto-approved when no approver is found** | It quietly bypasses the "manager approves" step. |
| 16 | Swaps only between people in the same department, and only from tomorrow onwards | Team boundaries were never defined (see #5). |
| 17 | Teammates' leave shows as "Away" with the type hidden | A privacy decision. Sensible, and also unrequested. |
| 18 | Only HR can read the audit log | Who reads the audit log is an access-policy decision. |
| 19 | The low-balance warning fires at 2 days or fewer remaining, for allowances of 5 or more | Magic numbers on a dashboard. |
| 20 | "Copy a week" in the roster, and CSV export of the audit log | Features nobody asked for. |

## 3. Architecture: decided silently

| # | Decision | Note |
|---|---|---|
| 21 | Node 22's experimental built-in `node:sqlite` with zero dependencies | It needs Node ≥ 22.13. The choice was clever, not agreed, and it's an ADR nobody wrote (T26). |
| 22 | A hand-rolled HTTP server, router and static file server instead of a framework | It's 4,100 lines the team now owns. |
| 23 | A vanilla-JS single-page app with hash routing | The frontend stack was never discussed. |
| 24 | Email and password auth with sessions, cookies and CSRF tokens; the cookie has no `Secure` flag | Auth wasn't in the BRD at all. Should it have been SSO, or a demo role picker? |
| 25 | The schema: 13 tables, including `leave_request_days` per-day rows and status enums | Data model before API (T23b). Nobody reviewed it against an API. |
| 26 | The seed data's names, departments and passwords | It is synthetic, which is good (T6), but the shape of the org was invented. |

## 4. What it got right, and why that's the trap

Overlap checks, the self-approval guard, append-only audit triggers, and blocking a shift on approved leave are all real and decent. A demo would show a working app. **The tests pass because they test what the code does, not what the BRD asked for** (Topic 41). There is even a test named `approval with rostered shifts needs explicit release`, which asserts that the gap-creating behaviour works.

## Suggested use in class

- **Topic 1:** run the app, then hand out this file with the right-hand columns blanked and have the class fill them in from the BRD.
- **T5:** "Which of rows 9–20 would you have let through in review?"
- **T31:** diff the planned swap implementation against `src/shifts.js` here, especially rows 7, 15 and 16.
- **T41:** read `test/app.test.js` and find the test that locks in row 2.
