# Leave & Shift Management System: the business case

**Who this is for:** Sponsors and budget holders deciding whether the product is worth the money and time.

Generated from commit 73db64c on 2026-10-30

## 1. The problem in one paragraph

Most teams run leave and rosters on spreadsheets, chat messages and memory. Someone asks for a day off. A manager checks a balance in one place and the roster in another. HR updates a sheet by hand each month. Then three people turn out to be off on the same day and a shift runs short. Nobody saw it coming, because no single place held both leave and shifts. Shift swaps agreed in a chat never reach the manager. When a balance is disputed, there is no clean record of who changed what.

## 2. What the product does about it

One system holds leave, balances, rosters and swaps. Each outcome below is something the system enforces. Each was checked against the working code and its automated tests.

- **Leave can't be approved into a coverage gap.** Each shift has a minimum headcount. A leave request is refused if any of the person's shifts would fall below that minimum. Other people's pending leave counts. The check runs again when the manager approves.
- **A swap involving someone on leave is blocked.** If either person is on approved or pending leave on either date, the swap can't go ahead. The check runs when the swap is proposed, accepted and approved.
- **Leave requests can't overdraw a balance.** A request must fit within the balance left after other pending requests. Weekends are never charged.
- **Balances are built, not typed.** One twelfth of each leave type's yearly entitlement is credited every month. The twelve credits always add up exactly to the yearly figure. At year end, unused days carry forward up to a cap and the rest lapse.
- **Every change is recorded and can't be edited.** Changes to people, teams, rules, balances, leave, rosters and swaps are logged with who made them and what changed. The database itself refuses to alter or delete log entries.
- **A manager sees today's gaps and waiting approvals on one screen.** This is the third success test in the business requirements, and it is automated.

## 3. Where the time and money are saved

**Admin time on leave and balance tracking.** The monthly credit and the year-end carry-forward run on their own at server start. HR can also run either on demand, and repeating a run does no harm. Each approved request deducts its days once. HR no longer keeps a balance sheet by hand. Balance corrections are a single entry with a mandatory reason.

**Manager time building and fixing rosters.** The roster grid shows people against the minimum for every shift, so a gap is visible while you build. "Copy previous week" fills a week in one click and lists anything it had to skip, with the reason. People on leave, double bookings and overlapping shifts are refused. When leave is approved, the person is taken off the shifts they would have missed. A cancellation puts them back where it still works.

**Cost of understaffed shifts.** Leave that would leave a shift short is stopped at the request, not discovered on the day. The manager gets an alert when a future shift newly falls below its minimum because of someone else's change. Today's gaps and the next seven days of gaps are on the home screen.

**Errors in balances and accrual.** Balances are always the sum of recorded movements, so every figure has a reason attached. Accrual can't be applied twice for the same month. Cancelling approved leave refunds day by day, and a day is held back only if the person's shift could not be restored.

**Audit and dispute effort.** A manager or HR can open the log, filter by type of change and date, and see the before and after of each change. Rejections must carry a written reason. Password data is never written to the log.

## 4. ROI model

Every number below is an input you supply. Nothing here is measured. The repository holds no usage, pricing or salary data.

| Input | What it is | Where it comes from | Your value |
|---|---|---|---|
| Roles | Employee, Manager, HR Admin | Built into the product | 3 |
| Approval steps per request | One approver per request | Built into the product | 1 |
| Accrual | One twelfth credited monthly | Built into the product | 1/12 |
| L: leave requests per month | All teams together | Your records | |
| m_L: minutes saved per request | Requester, approver and HR time | Assumption | |
| E: employees | People with a leave balance | Your records | |
| m_B: minutes saved per employee per month | Balance tracking and corrections | Assumption | |
| T: teams | Teams that run a roster | Your records | |
| W: roster weeks per team per month | Usually 4 or 5 | Your calendar | |
| m_R: minutes saved per team-week | Building and fixing the roster | Assumption | |
| S: swaps per month | Agreed shift swaps | Your records | |
| m_S: minutes saved per swap | Chasing and recording the swap | Assumption | |
| G: short shifts avoided per month | Gaps the checks would have prevented | Assumption | |
| C_G: cost of one short shift (₹) | Overtime, lost service, rework | Assumption | |
| D: balance or audit disputes per month | Disputes needing a manual trail | Your records | |
| m_D: minutes saved per dispute | Time to reconstruct what happened | Assumption | |
| H: loaded hourly cost (₹) | Pay plus overheads of the people whose time is saved | Your finance team | |
| One-off cost (₹) | Setup, loading people and teams by hand, training, hosting setup | Your quote | |
| Running cost (₹ per month) | Hosting, backups, someone to look after it | Your quote | |

Formulas:

```
hours saved per month = (L × m_L + E × m_B + T × W × m_R + S × m_S + D × m_D) ÷ 60
time saving (₹/month) = hours saved per month × H
shortfall saving (₹/month) = G × C_G
gross saving (₹/month) = time saving + shortfall saving
net saving (₹/month) = gross saving − running cost
payback (months) = one-off cost ÷ net saving      (if net saving ≤ 0, it does not pay back)
```

**Illustrative, not measured.** The values below are placeholders chosen to show the arithmetic. They are not data about any organisation. Only the leave-request lever is counted, so the result understates the full model.

- L = 40 requests per month, m_L = 10 minutes, H = ₹500 per hour.
- Hours saved: 40 × 10 ÷ 60 = 6.67 hours per month.
- Time saving: 6.67 × 500 = ₹3,333 per month.
- Assume running cost ₹1,000 per month. Net saving: 3,333 − 1,000 = ₹2,333 per month.
- Assume one-off cost ₹60,000. Payback: 60,000 ÷ 2,333 = 25.7 months.

Add your own values for the other levers before drawing any conclusion.

## 5. Cost and effort to run

The product is one application and one database file. It calls no outside services. It has no email, SMS, single sign-on or payment gateway to pay for. Notifications appear inside the product only.

What that means for cost:

- **Hosting is small.** One server runs the whole thing. Backing up means copying the database file.
- **Upkeep is light but real.** Someone must run upgrades, keep a signing key configured (otherwise everyone is signed out whenever the server restarts), serve it over HTTPS, take backups and reset forgotten passwords.
- **Monthly credits depend on a restart or a button.** There is no scheduler. The monthly credit and year-end close run when the server starts, and when HR presses the button. On a server that stays up for months, someone must press it on the 1st or restart the server.

What this does not cover: no high availability, no container or cloud deployment kit, no automated database upgrades, and no continuous-integration pipeline. Checks are run on a developer's machine before each release. A browser-level end-to-end test suite has been designed but not built yet. At the time of writing, 146 backend tests and 59 front-end tests pass.

## 6. Risks and limits

These are decided exclusions, not oversights. Be clear about them before you commit.

- **No payroll or HR system link.** People are added one at a time by HR. There is no bulk import.
- **Single approval level.** An employee's leave goes to their team manager. A manager's goes to HR. There are no chains and no delegates. If a manager is away, their team's requests wait.
- **No email, SMS or push.** People see requests only when they open the product. The unread count refreshes about once a minute.
- **No single sign-on and no two-step login.** Sign-in is email and password. HR sets and resets passwords. There is no self-service "forgot password".
- **One organisation, one location, Indian Standard Time only.**
- **Whole days only, Monday to Friday.** No half days. Public holidays are not excluded, so a holiday on a weekday is still charged.
- **One accrual rule.** No country-specific policy engine.
- **No export** of any data, including the audit log.
- **Coverage means headcount only.** It does not check skills or roles.
- **A short shift can still happen.** The checks stop leave and swaps from causing gaps. A manager who removes someone from a roster can still create one. It shows as "Short", and the system alerts managers to gaps caused by other people's changes.
- **Manual balance corrections can go below zero.** Leave requests can't, but an HR correction can. It needs a written reason and is logged.

## 7. Decision asked of the reader

Approve a time-boxed pilot on one or two real teams. Before the pilot, fill in the "Your value" column above with your own records so the payback can be calculated from your numbers and not from ours. Also confirm that the limits in section 6 are acceptable. In particular, check the lack of an HR-system link, the lack of email and the single approval level. If they are, the case rests on whether your time and shortfall savings exceed the running cost shown in the formulas. If one of them is a deal-breaker, say so now, because none of these is a small change.
