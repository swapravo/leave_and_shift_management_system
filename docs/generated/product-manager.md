# Leave & Shift Management System: how easy it is to use

**Who this is for:** The product manager who owns the roadmap and judges whether the product is easy and fits how people work.

Generated from commit 73db64c on 2026-10-30

This describes the screens as they are in the current working copy. The latest screen redesign (Home, Requests, Inbox, Settings) is not yet committed. No usability data exists: nothing here reports task times, success rates or satisfaction. Step counts come from reading the screens. A "step" is one deliberate tap, choice or entry.

## 1. Who uses it and what they came to do

**Employee**
1. Ask for time off and know straight away what it will cost and who decides.
2. See my next shift and what my leave balance is.
3. Swap a shift with a teammate without chasing anyone.

**Manager** (leads one team)
1. See today's coverage gaps and what's waiting for my decision, in one place.
2. Approve or reject leave and swaps, with a reason when I say no.
3. Build the weekly roster and set up the team's shifts and minimum headcount.

Managers also take leave and swap shifts like employees. Their leave goes to HR.

**HR Admin** (administers; takes no leave and isn't rostered)
1. Add, move and deactivate people, and make sure every team has a manager.
2. Set up leave types, run accruals and correct a balance when needed.
3. See company-wide coverage and read the record of who changed what.

## 2. Task walkthroughs

### Apply for leave (Employee or Manager): 4 steps minimum, 7 with every option
1. **Home:** tap "Request time off". A sheet opens with the first leave type already chosen.
2. *(Optional)* Tap another leave type, such as "Sick Leave · 6 left".
3. Tap the first day on the month grid.
4. Tap the last day. Tap the same day again for a single day.
5. Read the summary: dates, working days, balance after, and who decides. If a red box says "This can't be sent yet", change the dates.
6. *(Optional)* Tap "Add a note".
7. Tap "Send request". Home shows "Request sent for … (3 days). Meera Iyer will decide." (the approver's name).

The same sheet opens from the Calendar and from the Requests screen. On the Calendar, tap a day, then "Request time off from this day". The day you tapped is pre-selected, so a one-day request is three taps. For a longer request you must tap the first and last days again.

### Approve or reject leave (Manager; HR for managers' leave): 3 steps to approve, 4 to reject
1. **Inbox** (or **Home**, which shows the same cards): find the card with the name, leave type, dates, days and reason.
2. Tap "Approve" or "Reject".
3. In the box that opens, add a comment. It is optional for approval and required for rejection.
4. Tap the confirm button.

From Home, approving takes two steps because you are already there.

### Propose and accept a shift swap: 4 + 2 + 3 steps, across three people
*Proposer (4 steps):*
1. **Home:** tap "Swap a shift". The tile only appears when you have an upcoming shift.
2. Tap "Give this one" next to the shift you want to give away.
3. Tap the teammate shift you would take. Shifts you can't take are greyed out with the reason.
4. Tap "Ask Priya". You are told "They answer first, then it goes for approval."

You can also start from the Calendar: tap a day, tap "Swap my Evening shift", then do steps 3 and 4.

*Teammate (2 steps):* open **Home** or **Inbox**, where the offer waits under "Waiting for your answer" or "Swap offers for you". Tap "Accept" or "Decline". There is no confirmation box.

*Approver (3 steps):* **Inbox** → "Approve" or "Reject" → confirm, with a comment required for rejection.

Every swap card shows a progress line such as "You offered → Priya accepts → Manager approves". The proposer can withdraw it from **Requests** under "Shifts & swaps" with "Cancel swap".

### Build or copy a week's roster (Manager, or HR for any team)
*Copy (2 steps, 3 for another week):*
1. Open **Roster**. Your team and the current week are already chosen.
2. *(For another week)* Tap "Next week →".
3. Tap "Copy previous week". A message says "Copied 12 assignments from the previous week" and lists anything skipped, each with its reason.

*By hand (2 steps per person):* in a shift's cell, pick a name from "Add…", then tap "+". To remove someone, tap "×" beside their name. Each cell shows people against the minimum, for example "2 / 2", with a "Short" or "OK" badge. People on leave are listed but not counted. Past days are read-only.

### Check today's coverage and pending approvals (Manager): 1 step after sign-in
Sign in and you land on **Home**. "Needs your decision" and "Coverage today" sit on the same screen, with Approve and Reject right on the cards. HR's Home adds four counters (coverage gaps today, waiting for you, on shift today, on leave today) and "Coverage gaps, next 7 days".

### Set things up (HR; a manager can do the shift part for their own team)
- **A user: 4 steps.** Settings opens on **People**. Tap "Add user". Fill in name, email, role, team and an initial password of at least 8 characters. Join date is optional and sets when accrual starts. Tap "Add user". Confirmation: "… was added. They can sign in with the password you set."
- **A leave type: 5 steps.** Settings → **Leave types** tab → "Add leave type" → name, days per year and carry-forward cap → "Add leave type". Hints say "1/12 is credited on the 1st of each month" and "Unused days kept at year end; the rest lapse."
- **A shift template: 4 steps for a manager, 5 or 6 for HR.** A manager opens the account menu and taps "Team settings" (the first step is two taps), then taps "Add shift". They fill in name, start, end, minimum headcount and days, then tap "Add shift". HR opens Settings → **Shift templates**, picks a team if there is more than one, then does the same.

### Cancel leave (Employee or Manager): 3 steps
**Requests** → "Withdraw" (pending) or "Cancel leave" (approved, not started) → confirm. After cancelling approved leave, "Details" shows which shifts were put back and the refund for each working day.

## 3. Ease-of-use features

- **Leave preview before sending** (the Request time off sheet). About a quarter of a second after each change, the sheet shows working days, balance after, who decides, and every problem at once. Send stays disabled while there is a problem.
- **One date picker everywhere.** The month grid for leave dates disables past days and greys weekends, with the hint "Weekends aren't deducted." Tap-tap selection works on a phone.
- **Plain-language status.** Leave reads "Waiting for Meera Iyer", "Approved by …" or "Not approved by …". Swaps read "Waiting for teammate" and "Waiting for approval", with a step-by-step progress line.
- **Role-aware navigation.** Employees see Home, Calendar, Requests and Inbox. Managers add Roster. HR sees Home, Calendar, Roster, Inbox and Settings. Nobody has more than five tabs, so they fit a phone's tab bar. Managers reach Team settings from the account menu.
- **Inbox and notifications.** The Inbox tab shows an unread count. The Inbox lists what needs your decision, swap offers for you, then "Updates" with "Mark read" and "Mark all as read". Update links open the relevant screen.
- **One calendar for everything.** The Calendar shows shifts, approved and pending leave, and short-staffed days on one month. Employees and managers switch between "Team" and "Just me". HR picks a team or "All teams". Tap a day to see who is on each shift and who is away, and to request leave or swap from there.
- **Home adapts to you.** Employees see "Your next shift", their balances ("12 Annual Leave left") and anything waiting for them. Managers add decisions and today's gaps. HR sees a "Setup check" that flags teams with no manager and people with no team, with a link to fix each.
- **Loading, empty and error states.** Screens show "Loading…" and friendly empty messages: "You're all caught up. Approvals and swap offers show up here.", "No coverage gaps. Every shift has enough people.", "No leave requests yet." with a button. Errors appear in a red box using the system's own words. A lost connection says "Can't reach the server. Check your connection and try again." An expired session returns you to Sign-in.
- **Confirmations where it matters.** Withdrawing or cancelling leave, deactivating a person and archiving a shift each explain the consequences first. Removing someone from a roster and accepting a swap do not ask.
- **Readable by everyone.** Status is always written as text, not colour alone. Every form field has a label. Dialogs close with Escape and the calendar works from the keyboard.

## 4. Guardrails that prevent mistakes

| Situation | What the user sees |
|---|---|
| Not enough balance | "You need 3.0 day(s) but have 2.0 Annual Leave day(s) available". Days already pending are subtracted first. |
| Leave starts in the past | "Leave can't start in the past". The picker already disables those days. |
| Leave crosses New Year | "A request can't span two calendar years; submit one per year" |
| Only weekend days chosen | "The selected dates have no working days (Mon–Fri)" |
| A shift would run short | "Morning on Fri 12 Jun 2026 would drop below its minimum of 2 (1 without you)", plus a list when several shifts are affected. Others' pending leave counts. |
| Overlaps your own leave | "This overlaps your pending leave (Mon 15 Jun 2026 – Wed 17 Jun 2026)" |
| Team has no manager | "Your team has no manager yet, so leave can't be submitted. Ask HR to assign one." Swaps get the same message with "swaps". |
| Archived leave type | "… is archived and can't be applied for" |
| HR tries to take leave | "HR Admins don't take leave in this system" |
| Rejecting without a reason | "A comment is required when rejecting" (the comment box is also marked required) |
| Approving after things changed | Approval re-checks balance and cover, for example "The employee no longer has enough balance for this request". |
| Swap with someone on leave | The option is greyed out: "Priya is on leave that day", "You're on leave on …". If it is still sent, the server says "… is on approved leave on …". |
| Swap of a shift that has started | "Evening on Wed 10 Jun 2026 has already started" |
| Swap that would double-book | "Swap not possible: After the swap: … is already on … which overlaps" |
| Roster edit on a past day | "Past dates are read-only". The Add and × controls aren't shown for past days. |
| Rostering someone on leave | They appear greyed in the Add menu, for example "Arjun Mehta (approved leave)". |
| Cancel approved leave after it starts | "Approved leave can only be cancelled before it starts" |
| Deactivating or demoting yourself | "You can't deactivate yourself", "You can't change your own role" |
| Removing the last HR Admin | "This is the last active HR Admin" |
| Short password | "Password must be at least 8 characters" |
| Moving a person, archiving a shift | Warning before saving: "Moving to another team releases this person's future shifts in …" |

## 5. Friction and open questions

Things the user must do by hand, or where the product is silent. Each suggestion is a suggestion to test, not a recommendation.

- **No email or push.** People learn of a decision only by opening the product. The Inbox count refreshes about once a minute. *Suggestion: ask employees how they would otherwise find out about a rejection.*
- **No half days and no public-holiday calendar.** A holiday that falls on a weekday is charged as a working day. *Suggestion: ask HR how often this causes a correction.*
- **No backdating.** Leave cannot start in the past. Someone who was ill yesterday cannot record it. HR can only adjust the balance, which does not appear as leave. *Suggestion: test what HR does today in this case.*
- **Monthly credit is not automatic on a long-running server.** It runs at start-up and when HR taps "Run monthly accrual". A new month's days may be missing until then. *Suggestion: check whether HR notices.*
- **Year-boundary requests need two requests.** The picker lets you span New Year, and the error only shows after you pick. *Suggestion: watch whether people find the message clear.*
- **Approvers see no balance or cover on the card.** The card shows name, type, dates, days and reason only. Cover was checked at request time, and the approval re-checks it. *Suggestion: ask managers whether they want the remaining balance and the coverage figure on the card.*
- **Roster building is two taps per person.** There is no drag-and-drop or bulk fill. "Copy previous week" is the only shortcut, and you cannot choose which week to copy from. *Suggestion: time a manager building a week from scratch.*
- **Swaps show only the next four weeks.** The swap sheet lists teammates' shifts for 28 days. A reason for an unavailable shift is only shown for leave. Double-booking is reported after you tap "Ask". *Suggestion: see whether people try to swap further ahead.*
- **Fri–Mon leave and weekend shifts.** Approved leave removes weekend shifts in its range without charging leave for the weekend days. The feature plan lists this as an open question. *Suggestion: ask HR which of the options they want.*
- **Everyone sees teammates' leave type.** The Calendar shows who is away and the leave type, for example sick leave. *Suggestion: ask whether that is acceptable.*
- **No self-service password change or "forgot password".** HR sets and resets passwords. There is no profile screen.
- **No export, and no bulk user import.** People are added one at a time. *Suggestion: ask HR how many people they would load at go-live.*
- **The audit log can be filtered by type and date but not by person.** *Suggestion: ask whether managers need "what did X change?".*
- **The welcome page promises "about a minute".** The line "Your next day off is about a minute away" and the "Time off in about a minute" heading are marketing copy. No timing has been taken. *Suggestion: time first-time users before keeping these claims.*
- **A manager who is away leaves their team's requests waiting.** There is no delegate.

## 6. Role-by-screen map

| Screen | Employee | Manager | HR Admin | Purpose |
|---|---|---|---|---|
| Welcome page | Public | Public | Public | Explains the product and links to Sign-in |
| Sign-in | Public | Public | Public | Email and password |
| Home | Yes | Yes | Yes | Employee/Manager: next shift, balances, open requests, decisions and today's gaps (manager only). HR: company counters, decisions, 7-day gaps, setup check. |
| Calendar | Own team | Own team | Any team or all | Shifts, leave and short days on one month. Tap a day to act. |
| Requests | Yes | Yes | No | My leave, balances, balance history, my shifts and swaps |
| Roster | No | Own team | Any team | Build the week, copy last week |
| Inbox | Yes | Yes | Yes | Employees: swap offers and updates. Managers and HR: decisions as well. |
| Settings → People | No | No | Yes | Add, edit, deactivate users |
| Settings → Teams | No | No | Yes | Create teams, assign the manager |
| Settings → Leave types | No | No | Yes | Leave types, accrual runs, balance adjustments |
| Settings → Shift templates | No | Own team | Any team | Shifts, days, minimum headcount, archive |
| Settings → Audit log | No | Own team's entries | All entries | Who changed what, before and after |

Anyone who opens a screen they can't use sees "Not allowed: Your role doesn't have access to this page."
