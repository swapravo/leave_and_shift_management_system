# 0. Feature Plan & Decision Record

## Context
The BRD asks for **one place to manage leave and shifts, so a coverage gap can't slip through unnoticed**.
Roles: Employee, Manager, HR Admin. Scope: one org, one location, multiple teams; multiple leave types with
one accrual rule; coverage = minimum headcount per shift.
Out of scope (BRD): payroll/HRIS integration (data is seeded), multi-level approval chains.

**Success criteria (BRD) — each becomes a named automated test**
1. Applying for leave correctly reduces the employee's balance.
2. A shift swap involving someone on approved leave is correctly blocked.
3. A manager sees today's coverage gaps and pending approvals in one view.

## Confirmed decisions

### Project & stack
| Topic | Decision |
|---|---|
| Branch / layout | Session branch `claude/serene-gates-43tt2w`. Code in a new `app/` folder, design docs in `docs/`. Existing `content/` and `demo/` are never read or modified. |
| Backend | Python **FastAPI**, **async** endpoints, **aiosqlite** (async wrapper around stdlib sqlite3). |
| Database | **SQLite** (single file). |
| Frontend | **React + TypeScript**, built with Node + Vite. |
| Auth | Email + password. **JWT** (HS256, 8 h, no refresh) in an **httpOnly cookie**. The user is re-loaded from the DB on every request: inactive → 401; current role/team come from the DB, not the token. Passwords hashed with **bcrypt**, minimum 8 characters. |
| Run mode | Dev: Vite (5173) proxies `/api` to uvicorn (8000). Prod/demo: FastAPI serves the built frontend on one port. |
| Time zone | **IST only** (Asia/Kolkata) everywhere. |
| Notifications | **In-app only** (bell + inbox, read/unread). |
| Diagrams | PNG images generated from Mermaid source; the source sits in a collapsible section under each image (`docs/diagrams/render.py` regenerates them). |

### Organisation & users
| Topic | Decision |
|---|---|
| Org model | **Flat teams** (department is a label on the team). Each employee/manager belongs to one team; **one manager per team**. |
| User admin | HR Admins create users (setting an initial password), edit them and delete them. One HR Admin is seeded. |
| Delete user | **Soft delete** (deactivate): can't log in; hidden from pickers and rosters; history and audit keep the name; future shift assignments, pending leave and open swaps are cancelled. |
| HR Admin leave | **HR Admins don't take leave here**: no balances, can't apply, not on rosters. |
| Team without manager | **Blocked**: members can't submit leave or swaps until HR assigns a manager. Requests already pending wait for the new manager. |

### Leave & balances
| Topic | Decision |
|---|---|
| Accrual rule | Annual entitlement per leave type; **1/12 credited on the 1st of each month**. At year end the unused balance **carries forward up to the type's cap**; the rest lapses. |
| Accrual precision | **Fractions to 2 decimals** (20/yr → 1.67/month; the 12 monthly credits always add up exactly to the entitlement). Fractional balances are usable as-is. |
| Accrual start | New users accrue **from their join month** (full credit for that month), nothing for earlier months. |
| Accrual running | **Auto catch-up** on server start, plus HR buttons to run a month or the year-end close manually. Both are idempotent. |
| Day count | **Always Mon–Fri** in the requested range; weekends never deducted. No half-days. |
| Negative balance | **Blocked**: requested days ≤ balance − days already pending. |
| Past dates | Leave **cannot start in the past**. |
| Year boundary | A request **cannot span two calendar years**; submit one per year. |
| Routing | Employee → their team manager. Manager → any HR Admin. Single approval only. |
| Approval effect | Deduct balance; **take the person off every shift they were rostered on during the leave** (recorded so a cancellation can restore them); notify. |
| Cancellation | Pending → withdrawn. Approved → only **before it starts**: shifts auto-restored and balance refunded per day (below). |

#### Cancelling approved leave (auto re-roster, refund what's restored)
Nobody may get a free day off by cancelling after their shifts were removed.
- On cancel, the system tries to put the person back on every shift removed at approval (skipped if no longer
  valid, e.g. the shift was archived or they'd be double-booked).
- Refund is decided **per working day (Mon–Fri) of the leave**:
  - no shift had been removed that day → refunded immediately;
  - every removed shift that day was restored → refunded immediately;
  - otherwise the day is **owed**: it stays deducted until the person is rostered that day on at least as many
    shifts as were removed; then 1 day is refunded automatically. If the date passes first, the day is **forfeited**
    (past roster is read-only) — the person didn't work it.
- The employee and manager are told what was restored and which days are still owed.

### Shifts, roster, coverage, swaps
| Topic | Decision |
|---|---|
| Shift model | **Per-team shift templates**: name, start/end time, days of week, min headcount. Shifts may **cross midnight** and belong to their start date. |
| Shift config | **HR Admin and the team's manager** (own team only) create/edit/archive shift templates and min headcount. |
| Roster | Employee ↔ shift template ↔ date. Managers can be rostered on their own team's shifts. **Past dates are read-only.** Includes **copy previous week**. |
| Coverage | **Hard block at apply**: leave can't be submitted if any of the person's shifts in the range would drop below min headcount. Other people's **pending** leave counts. Re-checked at approval. |
| Roster guards | Can't assign someone on approved/pending leave, double-book overlapping shifts, or assign deactivated users. |
| Swaps | **1-for-1 exchange** within a team, **future shifts only**: A offers own shift and picks a specific shift of teammate B → B accepts → manager approves → assignments exchanged. Either party on approved/pending leave on either date → blocked. |
| Extras in v1 | Cancel / withdraw leave only. Not in v1: half-days, scheduled reminders, CSV export. |

## Decisions made while writing the docs — please review
These weren't discussed; they're the behaviour the docs specify unless you say otherwise.
1. **Swap where one party is the team manager** → approved by an HR Admin (a manager never approves their own swap).
2. **Password reset by HR** → tokens issued before the reset stop working (`users.password_changed_at` checked on
   every request). Logout clears the cookie; the token itself can't be revoked (stateless JWT).
3. **Archiving a leave type** → no new accrual or applications; existing balances and history stay visible;
   pending requests of that type can still be decided.
4. **Archiving a shift template** → its future assignments are removed, open swaps on them cancelled, the team
   manager notified.
5. **Moving a user to another team, or changing a manager's role** → their future shifts in the old team are
   released; a manager who leaves the role/team stops managing it (team becomes "no manager" → blocked).
6. **Owed refund days past their date** become *forfeited* in a housekeeping step that runs at startup and before
   any refund check (no background scheduler).
7. **Coverage alerts**: when an unassignment/deactivation makes a future shift fall below minimum, the team manager
   is notified unless they made the change themselves.

## Open question
- **Weekend shifts and the Mon–Fri rule.** A Fri–Mon leave deducts 2 days (Fri, Mon) but also removes any Sat/Sun
  shifts the person was rostered on — so weekend-rostered staff get weekend shifts off without using leave.
  Options: (a) accept it; (b) count rostered weekend days too; (c) don't remove weekend shifts. The docs currently
  describe (a). A leave consisting only of weekend days is rejected ("no working days").
