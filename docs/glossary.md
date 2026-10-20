# Domain glossary: Leave & Shift Management System

The shared vocabulary for the app. Every definition comes from the BRD. Where the BRD is silent, the term is still defined as far as the BRD allows and the gap is listed under [Open questions](#open-questions) instead of being filled with a guess. Open questions are answered by a human (see `docs/build-order.md`, decision owners), never by Claude.

**Rule for code and docs:** use these exact terms in table names, API fields, UI labels and specs. If a new term is needed, add it here first.

## Roles

| Role | Can do (BRD) | Cannot do / not specified |
|---|---|---|
| **Employee** | Applies for leave. Requests shift swaps with a teammate. | See Q1–Q2. |
| **Manager** | Approves or rejects leave and swaps, with comments. Views coverage and expected attendance for their team. Is the **single approver**: there are no multi-level approval chains. | Who builds the roster is not stated (Q3). |
| **HR Admin** | Configures leave types, the accrual rule and minimum coverage thresholds. | Whether HR also approves anything is not stated (Q2). |

## Organisation

| Term | Definition | BRD source / limit |
|---|---|---|
| **Organisation** | The single company using the app. | Not multi-org. |
| **Department** | A grouping of employees. There are several. | "Multi department/team". |
| **Team** | The group of employees a manager approves for and views coverage for. Its relationship to a department is undecided (Q4). | "Multi department/team". |
| **Teammate** | An employee in the same team. This is who a swap may be requested with. | Depends on Q4. |
| **Seeded data** | Employees, departments and teams are loaded from a seed. There is no payroll or HRIS integration. | Out of scope: real integration. |

## Leave

| Term | Definition | BRD source / limit |
|---|---|---|
| **Leave type** | A category of leave (e.g. annual, sick), configured by HR Admin. There are several. | "Multiple leave-types". |
| **Leave balance** | The amount of one leave type an employee has available. There is one balance per employee per leave type. | "Per leave-type balances". Unit undecided (Q5). |
| **Accrual rule** | How a leave balance grows over time. There is **one** rule. It is not a country-specific policy engine. | "One accrual rule". Its exact shape is undecided (Q6). |
| **Carry-forward cap** | The maximum unused balance that moves into the next period. | Period and per-type vs. global undecided (Q7). |
| **Leave request** | An employee's application for leave of one type over a date range. It is routed to their manager, who approves or rejects it with a comment. | Feature 2. |
| **Balance deduction** | The reduction in a leave balance caused by a leave request. | Success criterion 1. *When* it happens is undecided (Q8). |

### Leave request states

| State | Meaning |
|---|---|
| **Pending** | Applied for and routed to the manager, with no decision yet. |
| **Approved** | The manager approved it, optionally with a comment. |
| **Rejected** | The manager rejected it, with a comment. |

The BRD doesn't mention withdrawing or cancelling a request (Q9).

## Shifts

| Term | Definition | BRD source / limit |
|---|---|---|
| **Shift** | A time period on a date that employees are assigned to work. | Feature 3. Time zones undecided (Q10). |
| **Slot** | Used alongside "shift" in the BRD ("shifts/slots"). Not defined (Q11). | Feature 3. |
| **Shift assignment** | One employee assigned to one shift. | Feature 3. |
| **Roster** | All shift assignments for a team over a period. Built with the roster builder. | Feature 3. |
| **Shift swap request** | A request to change who works a shift. An employee proposes it, the teammate accepts, and the manager approves. | Feature 4. Exchange vs. hand-over undecided (Q12). |

### Shift swap request states

| State | Meaning |
|---|---|
| **Proposed** | The employee asked a teammate. |
| **Accepted** | The teammate agreed. It now waits for the manager. |
| **Declined** | The teammate said no. *Implied by "accept", not named in the BRD.* |
| **Approved** | The manager approved it, and the assignments change. |
| **Rejected** | The manager said no. |
| **Blocked** | The system refused it because it involves someone on approved leave (success criterion 2) or would cause a coverage conflict. |

## Coverage

| Term | Definition | BRD source / limit |
|---|---|---|
| **Minimum headcount** | The fewest employees a shift must have working. Set by HR Admin as a minimum coverage threshold. Headcount only: no skills. | "Minimum headcount per shift". Granularity undecided (Q13). |
| **Coverage** | For a shift: the number of assigned employees who are not on approved leave. | Feature 5. |
| **Coverage gap** | A shift whose coverage is below its minimum headcount. The app exists so that a gap **can't slip through unnoticed**. | Objective. |
| **Coverage conflict** | An action that would create a coverage gap, or put someone on leave onto a shift. Coverage validation **blocks** these. | Feature 5: "blocks conflicts". Which actions are checked: Q14. |
| **Expected attendance** | Who is expected to work on a given day: assigned and not on approved leave. | Manager role. |
| **Team availability** | Who in a team is working, on leave or free over a period. | Feature 7. |

## Views & records

| Term | Definition | BRD source / limit |
|---|---|---|
| **Unified team calendar** | One view showing a team's leave and shift assignments together. | Feature 6. |
| **Manager dashboard** | A manager's single view of pending approvals, coverage gaps and team availability. It must show **today's** gaps and pending approvals together. | Feature 7, success criterion 3. |
| **Audit log** | An **immutable** record of who changed what, and when. Entries are never edited or deleted. | Feature 8. Who can read it: Q15. |
| **Notification** | An alert about an approval, a coverage issue or a reminder. | Feature 9. Channel and reminder triggers undecided (Q16). |

## Open questions

These are the decisions the cold-open app made by itself. Each one needs a human answer before the feature it blocks is specified.

| # | Question | Blocks |
|---|---|---|
| Q1 | Is a manager also an employee who applies for leave and works shifts? If so, who approves a manager's leave? | F2, F4 |
| Q2 | Does HR Admin ever approve, override or apply for leave? | F2 |
| Q3 | Who builds the roster: the manager, HR Admin, or both? | F3 |
| Q4 | Is a team a sub-unit of a department, or does it cut across departments? Does each team have exactly one manager? | Org model, F3, F4 |
| Q5 | Is leave counted in days, half days or hours? | F1, F2 |
| Q6 | What is the one accrual rule: a lump sum per year or monthly accrual, and is it pro-rated for joiners? | F1 |
| Q7 | Carry-forward: once a year on which date, and is the cap per leave type? | F1 |
| Q8 | Success criterion 1 says *applying* reduces the balance. Is it deducted when the request is submitted (and restored on rejection), or only when it's approved? | F1, F2 |
| Q9 | Can an employee withdraw a pending request, or cancel an approved one? | F2 |
| Q10 | The context mentions teams working internationally, but scope says not multi-location. Do shifts need time zones? | F3, F5 |
| Q11 | What is a "slot": a position within a shift, or another word for a shift? | F3 |
| Q12 | Is a swap always a two-way exchange, or can an employee hand a shift over? Can it cross teams? | F4 |
| Q13 | Is minimum headcount set per shift, per shift definition, or per team? | F5 |
| Q14 | Which actions does coverage validation check: leave approval, swap approval, roster edits, and leave *application*? Is a conflict a hard block, or can a manager override it? | F2, F4, F5 |
| Q15 | Who can read the audit log? | F8 |
| Q16 | Which channel do notifications use (in-app, email)? What triggers a reminder, and when? | F9 |
