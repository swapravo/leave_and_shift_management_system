# 2. Low-Level Design

The app is broken into **platform pieces (P1–P4)**, **twelve backend components (C1–C12)** and a **frontend shell
plus page groups (F0–F12)**. Each backend component owns its tables and exposes `async` service functions that take
the request's DB connection; routers are thin (parse → call service → return).

Table names refer to the [data model](05-data-model.md); endpoints to the [API contract](openapi.yaml).

## 2.0 Component map

| ID | Component | Owns tables | Depends on |
|---|---|---|---|
| P1 | DB layer | schema, connection, transactions | — |
| P2 | Clock | — | — |
| P3 | Errors | — | — |
| P4 | Seed | (writes all) | all |
| P5 | Test support | — (resets all) | P1 P4 |
| C1 | Identity & Access | — (reads `users`) | P1 P2 P3 |
| C2 | Org Admin | `users`, `teams` | C5 C6 C7 C8 C11 C12 |
| C3 | Leave Type Config | `leave_types` | C5 C11 |
| C4 | Shift Config | `shift_templates` | C7 C11 |
| C5 | Accrual & Balances | `balance_ledger` | C11 |
| C6 | Leave Requests | `leave_requests`, `leave_removed_shifts`, `leave_refund_days` | C5 C7 C9 C11 C12 |
| C7 | Roster | `shift_assignments` | C6 (refund hook) C8 C9 C11 C12 |
| C8 | Swaps | `swap_requests` | C7 C9 C11 C12 |
| C9 | Coverage Engine | — (reads roster + leave) | P1 |
| C10 | Read Models | — | C6 C8 C9 |
| C11 | Audit Log | `audit_log` | P1 P2 |
| C12 | Notifications | `notifications` | P1 P2 |

Dependency rule: C9, C11, C12 depend on nothing domain-specific, so every component may call them. C6 ↔ C7 call
each other through narrow functions only (C6 → `roster.remove_for_leave` / `roster.restore`; C7 →
`leave.on_assignment_added` for owed refunds), imported lazily to avoid cycles.

### Common error codes (`code` in error responses)
| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input breaks a rule (dates, lengths, missing comment…) |
| `NOT_AUTHENTICATED` | 401 | No/invalid/expired token, user inactive, password changed |
| `FORBIDDEN` | 403 | Role or ownership check failed |
| `NOT_FOUND` | 404 | Entity doesn't exist (or isn't visible to the caller) |
| `DUPLICATE` | 409 | Unique name/email already used |
| `COVERAGE_VIOLATION` | 409 | A shift would drop below min headcount; `details` lists them |
| `INSUFFICIENT_BALANCE` | 409 | Requested days > available |
| `LEAVE_OVERLAP` | 409 | Overlaps own pending/approved leave |
| `TEAM_HAS_NO_MANAGER` | 409 | Team can't submit leave/swaps until a manager is assigned |
| `ROSTER_CONFLICT` | 409 | On leave, double-booked, shift not running that day, wrong team… |
| `SWAP_BLOCKED` | 409 | Swap guard failed (leave, double-booking, stale shifts) |
| `INVALID_STATE` | 409 | Request no longer in a state that allows this action |
| `LAST_HR_ADMIN` | 409 | Would leave no active HR Admin |

---

## P1 DB layer — `app/db.py`, `app/schema.sql`
- `connect(path) -> aiosqlite.Connection`: sets `row_factory = aiosqlite.Row`, `foreign_keys = ON`,
  `busy_timeout = 5000`.
- `init_db(conn)`: runs `schema.sql`, sets `journal_mode = WAL`, writes `schema_meta.schema_version`.
- FastAPI dependencies (scope `"function"` so commit happens before the response is sent):
  - `ReadConn`: opens a connection; deferred transaction; closes.
  - `WriteConn`: opens a connection; `BEGIN IMMEDIATE`; commit on success, rollback on any exception.
- Helpers: `fetch_one(conn, sql, params) -> dict | None`, `fetch_all(...) -> list[dict]`, `execute(...)`.

## P2 Clock — `app/clock.py`
- `today() -> date` (IST), `now() -> datetime` (aware, IST), `now_iso()`.
- Pinning: `set_today(date | None)` for tests; env `LSM_TODAY` for demos.
- Nothing else in the code base calls `date.today()` or `datetime.now()`.

## P3 Errors — `app/errors.py`
`DomainError(message, code, details=[])` with subclasses per HTTP status (`ValidationFailed` 400, `Unauthorized` 401,
`Forbidden` 403, `NotFound` 404, `Conflict` 409). One exception handler renders
`{"detail", "code", "details"}`.

## P4 Seed — `app/seed.py`
`python -m app.seed [--reset] [--db PATH]`. Builds the demo data described in the data model §5.5 relative to
`clock.today()`. Inserts directly (no notifications); writes one `seed` audit row.

## P5 Test support — `routers/test_support.py`
`POST /api/test/reset` — **registered only when `LSM_TEST_MODE=1`** (otherwise the route doesn't exist → 404).
Deletes all rows (audit-log triggers are dropped and re-created for the reset), re-runs the P4 seed for
`clock.today()`, returns `{"today": "YYYY-MM-DD"}`. No authentication. Used by Playwright before every test
(see [Testing strategy](06-testing-strategy.md)). Seeded users get a fixed past `password_changed_at` so JWTs
issued earlier in the run stay valid after a reset.

---

## C1 Identity & Access — `app/auth.py`, `routers/auth.py`
**Endpoints**: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.

**Login**
1. Normalise email (trim, lower-case); load user.
2. If missing, inactive or bcrypt check fails → 401 `NOT_AUTHENTICATED` "Invalid email or password" (same message
   for every case). bcrypt runs in a worker thread.
3. Issue JWT `{sub: str(user.id), iat, exp: iat + LSM_JWT_HOURS}` (HS256, `LSM_JWT_SECRET`).
4. Set cookie `lsm_token` (HttpOnly, SameSite=Lax, Path=/, Secure per config, Max-Age = lifetime).
5. Audit `user.login`. Return `Me`.

**Per request — `current_user` dependency**
decode (signature + `exp`) → load user by `sub` → reject if not found, `active = 0`, or
`iat < password_changed_at` → return the DB row (role/team from DB).

**Role guards**: `require_roles("hr_admin")`, `require_roles("manager", "hr_admin")`. Ownership checks (e.g.
"manager of this team") live in the owning service.

**`Me`** = public user fields + `team_name`, `managed_team_id` (or null), `today` (server IST date).

**Logout** clears the cookie (token itself stays valid until `exp`; documented trade-off).

## C2 Org Admin — `services/org.py`, `routers/users.py`, `routers/teams.py`
All endpoints HR Admin only, except `GET /teams` (any signed-in user, for filters).

**Create user** — name required; email valid and unique; password 8–72 bytes; role ∈ roles; `team_id` required
for employee/manager and must be NULL for hr_admin; `join_date` default today. Hash password (thread), set
`password_changed_at = now`. Then C5 `accrual.catch_up(user_id)` (credits join month → current month).
Audit `user.create`.

**Update user** (name, email, role, team, password)
- Can't change own role. Demoting the last active HR Admin → `LAST_HR_ADMIN`.
- New password → re-hash, `password_changed_at = now` (old tokens die).
- Team changed or role → hr_admin: release future shifts (C7 `remove_assignments`, reason "Moved to another team").
- Was a manager and role/team changed: clear `teams.manager_id` where it points to them.
- Audit `user.update` (before/after, no hash).

**Deactivate user** (`DELETE /users/{id}`) — not self; not the last HR Admin.
Set `active = 0`, `deactivated_at`; clear `teams.manager_id`; C6 cancel their pending leave
("User deactivated"); C8 cancel their open swaps; C7 release future shifts (gap alerts to the manager).
Audit `user.deactivate`.

**Teams** — create/update name (unique, case-insensitive), department, manager. Setting a manager: user must be
active role `manager`, must not manage another team; their `team_id` is moved to this team if different (which
releases their future shifts in the old team). Audit `team.create` / `team.update`.

## C3 Leave Type Config — `services/leave_types.py`
CRUD for name (unique), `annual_entitlement` (0–366), `carry_forward_cap` (≥ 0), `active`.
Archiving: no new accrual or applications; balances/history remain; pending requests can still be decided.
Re-activating triggers C5 `catch_up()` for the current year. `GET /leave-types` returns active types to
employees/managers, all to HR. Audit `leave_type.create` / `.update`.

## C4 Shift Config — `services/shift_templates.py`
**Who**: HR Admin for any team; a manager for the team they manage.
**Fields**: name (unique per team), `start_time`, `end_time` (`HH:MM`, must differ; end ≤ start = overnight),
`days_of_week` (non-empty subset of 0–6), `min_headcount` (integer ≥ 0), `active`. `team_id` fixed at creation.
**Archive**: C7 removes future assignments of the template (reason "Shift archived") → open swaps on them are
cancelled and the manager gets gap alerts if relevant.
Changing days/times doesn't touch existing assignments (they still show and count).
Audit `shift_template.create` / `.update`.

## C5 Accrual & Balances — `services/accrual.py`, `routers/balances.py`
**Eligible users**: active, role employee or manager (HR Admins have no balances).

`monthly_credit(E, m)` = round(E·m/12, 2) − round(E·(m−1)/12, 2).

`run_monthly(year, month, user_id=None, actor=None)` — for each eligible user whose join month ≤ (year, month) and
each active leave type: `INSERT OR IGNORE` an `accrual` row (period `YYYY-MM`). Idempotent via the partial unique
index. Audit `accrual.monthly` with the count (only when run for everyone).

`run_year_end(closing_year, actor=None)` — for each (user, type) with ledger rows in that year:
balance B → `year_end_close` row −B in the closing year, `carry_forward` row min(B, cap) (≥ 0) in the next year.
Idempotent. Audit `accrual.year_end`.

`catch_up(user_id=None)` — at startup (for everyone) and after creating a user / re-activating a type:
if no year-end close exists for last year and last year has ledger rows → `run_year_end(last_year)`; then
`run_monthly` for months 1…current month of this year.

`balances(user_id, year)` → per type: accrued, carried_forward, adjustments, used, balance, pending, available
(formulas in data model §5.3). Archived types listed only if they have movements that year.

`adjust(user, type, amount, reason, year)` — HR only, non-zero amount, reason required → `adjustment` row.
Audit `balance.adjust`.

**Visibility**: self; the manager of the user's team; HR Admin.

## C6 Leave Requests — `services/leave.py`, `routers/leave.py`
### Day counting
`working_days(start, end)` = number of Mon–Fri dates in [start, end].

### Approver resolution
- requester role `employee` → the active manager of their team; if none → **blocked** (`TEAM_HAS_NO_MANAGER`).
- requester role `manager` → any active HR Admin.
- requester role `hr_admin` → can't apply (403).
`can_decide(actor, request)` = actor ∈ approvers(requester) and actor ≠ requester.

### Preview (`POST /leave-requests/preview`)
Runs every apply check without saving and returns `{days, available, remaining_after, violations, errors[]}` so
the form can show live feedback.

### Apply
Checks, in order (first failure wins):
1. Role not hr_admin; leave type active.
2. `end ≥ start`; `start ≥ today`; same calendar year; `working_days > 0` (else "no working days").
3. Approver exists (else `TEAM_HAS_NO_MANAGER`).
4. No overlap with own pending/approved request (`LEAVE_OVERLAP`).
5. `days ≤ available` for that type and year (`INSUFFICIENT_BALANCE`).
6. Coverage: `coverage.leave_violations(user, start, end)` empty (`COVERAGE_VIOLATION`, details per shift/date).
Insert `pending`, audit `leave.apply`, notify approvers (`approval`).

### Approve / reject (`POST /leave-requests/{id}/decision`)
- Status must be `pending` (`INVALID_STATE`); `can_decide` (403); reject needs a comment.
- **Approve**: re-check balance (available ≥ 0, since this request is already counted as pending) and coverage
  (same function — the requester's own pending leave already excludes them). Insert ledger `leave_taken` −days.
  For each assignment of the requester in [start, end]: insert `leave_removed_shifts` (status `removed`), then C7
  `remove_assignments(reason "On approved leave", notify_user=False)`. Status → approved.
- Audit `leave.approve` / `leave.reject`; notify requester (message includes number of shifts removed).

### Cancel (`POST /leave-requests/{id}/cancel`) — requester only
- `pending` → `cancelled`; notify approvers.
- `approved` and `start > today` → algorithm below. Otherwise `INVALID_STATE`.

**Cancel-approved algorithm**
1. Status → cancelled, `cancelled_at = now`.
2. For each `leave_removed_shifts` row of the request: if the date is still ≥ today and C7
   `assignment_problem(template, user, date)` is None → C7 `restore(...)` (insert assignment, `created_by` NULL),
   status `restored`, set `restored_assignment_id`; else status `not_restored` with the reason in `note`.
3. For each Mon–Fri date d in the leave:
   - removed(d) = removed rows on d; restored(d) = those restored.
   - removed(d) = 0 or restored(d) = removed(d) → insert `leave_refund_days` (`refunded`) + ledger
     `leave_refund` +1 (year of the leave).
   - else → `leave_refund_days` (`owed`, `shifts_removed` = removed(d)).
4. Audit `leave.cancel` (counts of restored / refunded / owed). Notify the employee and the approver(s) with the
   summary and owed dates.

**Owed-day resolution — `on_assignment_added(user_id, date)`** (called by C7 after any assignment to a user,
including swaps): for each `owed` row of that user and date, if the user's assignments on that date ≥
`shifts_removed` → ledger `leave_refund` +1, row → `refunded`, notify employee. Audit `leave.refund_owed_day`.

**Housekeeping — `expire_owed_days()`**: rows `owed` with `date < today` → `forfeited` (audit
`leave.refund_forfeited`). Runs at startup and at the start of `on_assignment_added` and `balances`.

**Lists**: `GET /leave-requests?scope=mine|pending|decided`; `GET /leave-requests/{id}` (with removed shifts and
refund days; visible to requester, their approvers, HR).

## C7 Roster — `services/roster.py`, `routers/roster.py`
**Who edits**: the team's manager or HR Admin. **Dates**: today or later only (past is read-only).

`assignment_problem(template, user, date, ignore_ids=()) -> str | None` — the single guard used by assign, copy
week, restore and swaps:
1. user active; user's team = template's team; role employee or manager;
2. template active and runs on that weekday;
3. user not on approved/pending leave that date;
4. not already on this template that date;
5. no time overlap with the user's other assignments on date−1, date, date+1 (intervals computed with overnight
   handling: end ≤ start → end + 1 day).

**Assign** → guard → insert → audit `roster.assign` → notify user (unless self) → C6 `on_assignment_added`.
**Unassign** → `remove_assignments([row], reason)`.
**`remove_assignments(rows, reason, notify_user=True)`** → C8 `cancel_for_assignments` → delete rows → audit
`roster.unassign` each → notify users → `alert_new_gaps` (manager notified for future cells now below minimum,
unless the manager made the change).
**Copy previous week** (`POST /roster/copy-week`, week_start must be a Monday): for each assignment in the previous
7 days, copy +7 days if not past and the guard passes; returns `{copied, skipped[]}` with reasons.
**Views**: `GET /roster?team_id&start&end` (≤ 42 days; members, templates, leaves, coverage cells);
`GET /roster/mine?start&end` (default next 28 days).

## C8 Swaps — `services/swaps.py`, `routers/swaps.py`
**Propose** (requester A): own assignment `a`, teammate B's assignment `b`; same team; A ≠ B; team has an active
manager (`TEAM_HAS_NO_MANAGER`); neither assignment already in an open swap. Snapshot both → `validate` →
insert `pending_peer` → audit `swap.propose` → notify B.

**`validate(swap)`** (`SWAP_BLOCKED` on failure) — run at propose, accept and approve:
1. Both assignments still exist with the snapshotted user, template and date.
2. Neither shift has started (`start datetime > now`).
3. Both users active.
4. **Neither A nor B on approved or pending leave on either date** (BRD success criterion 2).
5. After the exchange nobody is double-booked: `assignment_problem(b.template, A, b.date, ignore={a,b})` and
   `assignment_problem(a.template, B, a.date, ignore={a,b})` are None.

**Respond** (B only, status `pending_peer`): accept → validate → `pending_manager` → notify A and approver;
decline → `declined` → notify A.
**Cancel** (A only, open statuses) → `cancelled` → notify B.
**Approver**: the team's manager, unless the manager is A or B → any HR Admin.
**Decide** (status `pending_manager`; approver; reject needs comment): approve → validate → swap `user_id` on
both rows → C6 `on_assignment_added` for both users/dates → `approved`. Audit `swap.approve` / `swap.reject`;
notify A and B. Coverage is unchanged by a 1-for-1 exchange, so no coverage check is needed.
**`cancel_for_assignments(ids, reason)`** → open swaps touching those rows → `cancelled`, audit
`swap.auto_cancel`, notify both.

## C9 Coverage Engine — `services/coverage.py`
Pure read functions over `shift_templates`, `shift_assignments`, `leave_requests`, `users`.

- `runs_on(template, date)`, `shift_interval(template, date)`, `intervals_overlap(a, b)`.
- `leaves_by_user(start, end, user_ids?)` → approved + pending leave overlapping the range.
- `coverage_grid(team_ids, start, end, template_ids?)` → one cell per (active template, date) the template runs on
  (or has assignments): `{shift_template_id, shift_name, team_id, team_name, date, start_time, end_time,
  min_headcount, headcount, gap, assigned[{assignment_id, user_id, user_name, leave_status}]}`.
  Bulk-loads templates, assignments and leave for the range (3 queries), computes in Python.
- `leave_violations(user_id, start, end)` → for each of the user's assignments in the range: others =
  assigned people other than the user who are not on approved/pending leave that date; violation if
  others < min_headcount → `{date, shift_template_id, shift_name, min_headcount, headcount_without_you}`.
- `gaps(team_ids, start, end)` → cells with `gap = true`.

## C10 Read Models — `services/views.py`
**Calendar** (`GET /calendar?start&end&team_id`; ≤ 62 days). Visible teams: HR → all (or the filter); others →
own team only (other team → 403). Returns teams, members, leave (approved + pending), coverage cells.

**Dashboard** (`GET /dashboard`; manager or HR). Teams in scope: the managed team (manager) or all (HR).
Returns `today`, `pending_leave` (where caller can decide), `pending_swaps` (same), `gaps_today`,
`upcoming_gaps` (next 7 days), `availability` (each member: `on_leave` if approved leave today, else `on_shift`
with shift labels if rostered, else `off`; plus `pending_leave_today` flag). BRD success criterion 3.

## C11 Audit Log — `services/audit.py`, `routers/audit.py`
`record(actor | None, action, entity_type, entity_id, before=None, after=None, team_id=None)` — called inside
the same transaction as the change, so a rolled-back change leaves no audit row. Strips `password_hash`.
**Viewer** `GET /audit?actor_id&entity_type&start&end&limit&offset`: HR sees all; a manager sees rows whose
`team_id` is their team; employees 403. Newest first, max 500 per page.

Action catalogue: `user.login|create|update|deactivate`, `team.create|update`,
`leave_type.create|update`, `shift_template.create|update`, `accrual.monthly|year_end`, `balance.adjust`,
`leave.apply|approve|reject|cancel|auto_cancel|refund_owed_day|refund_forfeited`, `roster.assign|unassign|restore`,
`swap.propose|accept|decline|cancel|approve|reject|auto_cancel`, `seed`.

## C12 Notifications — `services/notify.py`, `routers/notifications.py`
`notify(user_ids, kind, message, link)` (deduplicated recipients, same transaction).
Endpoints: list (newest 50 + unread count), mark one read (own only, else 404), mark all read.

| Event | Recipient | Kind |
|---|---|---|
| Leave submitted / cancelled | approver(s) | approval / leave |
| Leave approved / rejected | requester | leave |
| Owed day refunded | requester | leave |
| Swap proposed | target | swap |
| Swap accepted | requester + approver(s) | swap / approval |
| Swap declined / cancelled / decided / auto-cancelled | other party / both | swap |
| Assigned / unassigned | the employee | roster |
| Future shift falls below minimum (not caused by the manager) | team manager | coverage |

---

## Frontend

### F0 Shell — `src/main.tsx`, `App.tsx`, `api.ts`, `auth.tsx`, `dates.ts`, `components/`
- `AuthProvider`: loads `/auth/me` on start; exposes `me`, `login`, `logout`, `refresh`.
- `RequireRole` route wrapper; unauthenticated → `/login`; wrong role → "not allowed" page.
- Layout: left nav filtered by role, notification bell (polls unread count every 60 s and on navigation), user menu.
- `api.ts`: `fetch` wrapper; parses `{detail, code, details}` into `ApiError`; typed functions per endpoint.
- `dates.ts`: pure helpers (add days, week start, Mon–Fri count, formatting) — all on ISO strings, IST.
- Shared UI: `PageHeader`, `Card`, `StatusBadge` (text + colour), `ErrorBox`, `ConfirmDialog`, `DateRangePicker`.

### Pages
| ID | Route | Roles | Contents | APIs |
|---|---|---|---|---|
| F1 | `/login` | public | Email/password form, error message | auth/login |
| F2 | `/dashboard` | manager, hr | Pending leave + swaps with inline approve/reject; today's gaps; next-7-day gaps; availability table | dashboard, leave decision, swap decision |
| F3 | `/approvals` | manager, hr | Pending + recently decided leave and swaps, comment dialog | leave-requests, swaps |
| F4 | `/leave` | employee, manager | Balances cards, apply form with live preview (days, remaining, coverage problems), my requests with cancel, ledger | balances, leave-requests (+preview, cancel), balances/ledger |
| F5 | `/shifts` | employee, manager | My upcoming shifts; "propose swap" picks a teammate's shift from the team calendar; my swaps (respond / cancel) | roster/mine, calendar, swaps |
| F6 | `/roster` | manager, hr | Team + week picker, grid dates × shifts, headcount/min per cell with gap highlight, add/remove people, copy previous week | roster, roster/assignments, roster/copy-week |
| F7 | `/calendar` | all | Month grid: leave chips (approved solid, pending outlined), shift coverage per day, gap markers; filters team/person/leave/shifts | calendar |
| F8 | `/admin/users` | hr | User table (filter by team, show inactive), create/edit dialog, deactivate with confirm | users, teams |
| F9 | `/admin/teams` | hr | Teams with manager and member count; create/edit, assign manager | teams, users |
| F10 | `/admin/leave-types` + accrual panel | hr | Leave types CRUD/archive; run monthly accrual / year-end; adjust a balance | leave-types, accrual/*, balances/adjustments |
| F10b | `/shift-templates` | hr, manager (own team) | Shift templates per team: times, days, min headcount, archive | shift-templates |
| F11 | `/audit` | hr, manager | Filterable, paginated log with before/after diff | audit |
| F12 | `/notifications` | all | Inbox, mark read / all read, links into pages | notifications |

Home route `/` redirects: manager/HR → `/dashboard`, employee → `/leave`.
