# Leave & Shift Management System: developer guide

**Who this is for:** Engineers who will read, run, change and test the code in `app/`.

Generated from commit 73db64c on 2026-10-30

Line numbers refer to the working tree on that date. The frontend redesign (Home, Requests, Inbox, Settings, Landing, `plain.ts`, `RangePicker`, and so on) is uncommitted: HEAD still holds the older pages (see Known gaps). Backend: 146 pytest tests pass. Frontend: 59 Vitest tests pass and `tsc` is clean (run on this date).

## 1. Run it

Backend (Python 3.13, from `app/backend/README.md`):

```bash
cd app/backend
python3.13 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m app.seed --reset                    # demo data
.venv/bin/uvicorn app.main:create_app --factory --reload --port 8000
.venv/bin/pytest -q                                     # backend tests
```

Frontend (from `app/frontend/README.md`):

```bash
cd app/frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to :8000 (start the backend first)
npm run typecheck    # tsc -b
npm test             # vitest run
npm run build        # tsc -b && vite build -> dist/
```

Single-port demo (from `app/README.md`): build the frontend, then run the seed and uvicorn from `app/backend` with the same pinned date. FastAPI serves `frontend/dist` on :8000.

```bash
cd app/frontend && npm run build
cd ../backend && LSM_TODAY=2026-06-10 .venv/bin/python -m app.seed --reset
LSM_TODAY=2026-06-10 .venv/bin/uvicorn app.main:create_app --factory --port 8000
```

Everything before a push (`app/scripts/test-all.sh`, stops at the first failure): pytest, then `npm run typecheck`, `npm test`, `npm run build`, then Playwright if `app/e2e/` exists (it does not yet; the script prints a notice).

**The `LSM_TODAY` pin.** `LSM_TODAY=YYYY-MM-DD` fixes the calendar date only (`clock.py:16`, `config.py:35`). The time of day still comes from the real clock. Security timestamps (token `iat`, `password_changed_at`) always use `clock.real_now()` (`clock.py:41`). The seed builds data relative to `clock.today()` (`seed.py:70`), so set the same value for the seed and the server. Tests pin 2026-06-10 at 08:00 IST.

Environment (`config.py:30`):

| Variable | Default | Purpose |
|---|---|---|
| `LSM_DB_PATH` | `app/backend/data/app.db` | SQLite file (the folder is created; `data/` is git-ignored) |
| `LSM_JWT_SECRET` | random per start, with a logged warning | HS256 key. Unset means every restart signs everyone out |
| `LSM_JWT_HOURS` | `8` | Token lifetime |
| `LSM_COOKIE_SECURE` | `0` | Set `1` behind HTTPS |
| `LSM_TODAY` | unset | Pin "today" |
| `LSM_TEST_MODE` | `0` | `1` registers `POST /api/test/reset` |
| `LSM_BCRYPT_ROUNDS` | `12` | Tests use 4 |
| `LSM_FRONTEND_DIST` | `app/frontend/dist` | Built SPA directory |

Demo data (from the seed docs): password `password123` for every seeded user. Logins are `hr@example.com` (HR Admin), `meera@example.com` (Customer Support manager), `arjun@example.com` and `priya@example.com` (employees), `rahul@example.com` (Network Operations manager). Every other seeded user's email is their first name `@example.com`. Demo data only. The seed contains one deliberate gap: Customer Support "Evening" is 1 of 2 on the pinned day.

## 2. Layout

```
app/
  README.md  CLAUDE.md          overview; agent rules (graphify)
  graphify-out/                 generated knowledge graph (graph.json, wiki, report)
  scripts/test-all.sh           every suite in order
  e2e/                          Playwright suite: NOT CREATED YET
  backend/
    requirements.txt  requirements-dev.txt  pytest.ini (filterwarnings = error)
    app/                        the Python package
      main.py                   app factory, startup, JSON-only writes, SPA mount
      routers.py                every HTTP route (thin) + test-only router
      schemas.py                request bodies (types only)
      auth.py                   bcrypt, JWT cookie, per-request Ctx, role checks
      db.py  schema.sql         connections, transactions, helpers; the schema + triggers
      clock.py  errors.py  config.py
      seed.py                   deterministic demo data, wipe/reset (python -m app.seed)
      services/                 business rules, one module per component
        org  leave_types  shift_templates  accrual  leave  roster  swaps
        coverage  views  audit  notify  common
    tests/                      conftest.py + one file per area (10 test files)
    data/app.db                 created at runtime, git-ignored
  frontend/
    index.html  vite.config.ts  tsconfig.json  package.json
    src/
      main.tsx  App.tsx         entry, routes, role gating, legacy redirects
      auth.tsx  api.ts  hooks.ts  types.ts
      dates.ts  plain.ts  swapOptions.ts   pure helpers (each has a *.test.ts)
      styles.css                design tokens, one light theme
      components/               Layout, LeaveSheet, RangePicker, SwapSheet, Timeline,
                                swapActions, decisions, ui
      pages/                    Landing, Login, Home, Calendar, Requests, Roster, Inbox,
                                Settings (+ Users, Teams, LeaveTypes, ShiftTemplates, AuditLog)
```

## 3. Architecture in one page

**Request path.** Browser → `routers.py` route → exactly one `services/<area>.py` function → `db` helpers → SQLite. Routers parse and return; they hold no SQL and no rules (`routers.py:1`). Services never commit. The transaction belongs to the request.

**Auth.** `POST /api/auth/login` (`routers.py:31`) verifies a bcrypt hash and sets an httpOnly, SameSite=Lax cookie `lsm_token` (`auth.py:16`, `auth.py:60`) holding an HS256 JWT with `sub`, `iat`, `exp`. Every other route depends on `ReadCtx` or `WriteCtx` (`auth.py:137`), which opens a transaction and calls `user_from_token` (`auth.py:80`). That function reloads the user from the database on every request. So role, team, active flag and managed team come from the row, never from the token. A deactivated user gets 401. A token issued before `password_changed_at` is rejected. Roles are enforced in services with `require_roles` (`auth.py:142`) and `can_manage_team` (`services/common.py:94`). Unknown email takes the same time as a wrong password (`_DUMMY_HASH`, `auth.py:50`).

**Transactions.** `db.transaction(write)` (`db.py:46`) opens a connection and runs `BEGIN IMMEDIATE` for writes (so the write lock is taken before any check) or `BEGIN` for reads. It commits on success and rolls back on any exception. Connections run with `isolation_level=None` (autocommit), `foreign_keys=ON`, `busy_timeout=5000`. The database is in WAL mode (`db.py:34`). The dependencies use `scope="function"`, so the commit happens before the response is sent. Audit and notification rows are written in the same transaction as the change, so a refused change leaves no trace (test: `test_views.py:123`).

**Errors.** Services raise `DomainError` subclasses (`errors.py:8`). The handler installed by `errors.install` (`errors.py:51`) returns `{"detail", "code", "details"}` (`errors.error_body`, `errors.py:44`).

| Class | HTTP | Default code | Other codes used |
|---|---|---|---|
| `ValidationFailed` | 400 | `VALIDATION_ERROR` | |
| `Unauthorized` | 401 | `NOT_AUTHENTICATED` | |
| `Forbidden` | 403 | `FORBIDDEN` | |
| `NotFound` | 404 | `NOT_FOUND` | |
| `Conflict` | 409 | `INVALID_STATE` | `DUPLICATE`, `LAST_HR_ADMIN`, `TEAM_HAS_NO_MANAGER`, `LEAVE_OVERLAP`, `INSUFFICIENT_BALANCE`, `COVERAGE_VIOLATION`, `ROSTER_CONFLICT`, `SWAP_BLOCKED` |

A wrong-shaped body gets FastAPI's own 422 (`detail` is a list); the frontend flattens it in `toApiError`. Write requests with a body that is not `application/json` get 415 from the middleware at `main.py:46` (CSRF defence beside SameSite). Unknown `/api/*` paths return a JSON 404 (`main.py:62`).

**Clock.** `clock.py` is the only source of "today" and "now" (IST, `Asia/Kolkata`). Nothing else calls `date.today()` or `datetime.now()`. Dates are `YYYY-MM-DD` text, times `HH:MM`, timestamps ISO-8601 with `+05:30`.

**Startup** (`main.py:18`): `init_db` (schema, idempotent, WAL), then in one `BEGIN IMMEDIATE`: `leave.expire_owed_days`, `accrual.catch_up`, commit. There is no scheduler. Accrual also runs when HR creates a user or leave type, or presses the accrual buttons. On a long-lived process the new month is not credited until one of these happens.

**Serving the SPA.** `_mount_frontend` (`main.py:70`) does nothing unless `frontend/dist/index.html` exists. When it does, `/assets` is a static mount and `GET /{path}` returns the file if it is inside `dist`, else `index.html`, so client-side routes survive a refresh. In dev, Vite on :5173 proxies `/api` to :8000 (`vite.config.ts`), so the cookie stays same-origin and there is no CORS.

## 4. Backend components

Request-facing service functions take `ctx: Ctx` first (`Ctx` = connection + user, `auth.py:112`). Internal helpers take `conn`. Circular imports between services are avoided with function-local imports (for example `from . import roster` inside `leave.decide`).

### `main`
Builds the app. `create_app` configures the clock, auth and db from `Settings`, installs error handlers, the JSON-only middleware, the routers, the `/api/*` 404 and the SPA mount. `routers.test_api` is included only when `settings.test_mode`.

```python
async def startup(settings: Settings) -> None:                       # main.py:18
def create_app(settings: Settings | None = None) -> FastAPI:        # main.py:31
```

### `routers`
All 45 routes (section 6). `api = APIRouter(prefix="/api")` at `routers.py:21`; `test_api` at `routers.py:274`. `UserUpdate`/`TeamUpdate` use `body.sent(...)` so an explicit `null` for `team_id` or `manager_id` is kept and other nulls are ignored.

### `schemas`
Pydantic request bodies with `extra="forbid"`. Types only: lengths, ranges and formats are checked in services (400), not here (422).

```python
class Body(BaseModel):                                               # schemas.py:9
    def sent(self, *nullable: str) -> dict:                          # schemas.py:12
```

Models: `LoginRequest`, `UserCreate`, `UserUpdate`, `TeamCreate`, `TeamUpdate`, `LeaveTypeCreate`, `LeaveTypeUpdate`, `ShiftTemplateCreate`, `ShiftTemplateUpdate`, `AccrualMonthly`, `AccrualYearEnd`, `BalanceAdjustment`, `LeaveRequestCreate`, `Decision`, `AssignmentCreate`, `CopyWeek`, `SwapCreate`, `SwapRespond` (`schemas.py:20` to `schemas.py:130`).

### `auth`
```python
COOKIE = "lsm_token"                                                  # auth.py:16
ROLES = ("employee", "manager", "hr_admin")                          # auth.py:17
def configure(secret: str, hours: int, secure: bool, rounds: int) -> None:   # auth.py:25
async def hash_password(password: str) -> str:                       # auth.py:35
async def verify_password(password: str, hashed: str) -> bool:       # auth.py:39
def issue_token(user_id: int) -> str:                                # auth.py:54
async def load_user(conn: aiosqlite.Connection, user_id: int) -> dict | None:   # auth.py:68
async def user_from_token(conn: aiosqlite.Connection, token: str | None) -> dict:   # auth.py:80
def me(user: dict) -> dict:                                          # auth.py:97
class Ctx:                                                           # auth.py:112 (dataclass: conn, user; .is_hr)
def require_roles(user: dict, *roles: str) -> None:                  # auth.py:142
ReadCtx / WriteCtx / PublicWriteConn                                 # auth.py:137-139
```
`load_user` adds `team_name` and `managed_team_id` (the team whose `manager_id` is this user). `me()` also returns the server's IST `today`, which the frontend uses instead of the browser clock. `hash_password` and `verify_password` run bcrypt in a worker thread.

### `db`
```python
def configure(path: str) -> None:                                    # db.py:19
async def connect(path: str | None = None) -> aiosqlite.Connection: # db.py:26
async def init_db(conn: aiosqlite.Connection) -> None:               # db.py:34
async def transaction(write: bool) -> AsyncIterator[aiosqlite.Connection]:   # db.py:46
async def fetch_one(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> dict | None:   # db.py:62
async def fetch_all(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> list[dict]:   # db.py:68
async def fetch_value(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> Any:        # db.py:74
async def execute(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> int:            # db.py:80
async def changes(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> int:            # db.py:86
def placeholders(values: list) -> str:                               # db.py:92
```
`execute` returns `lastrowid` for `INSERT`, else `rowcount`. `changes` always returns `rowcount` (used by the idempotent `INSERT OR IGNORE ... SELECT` in accrual). `audit_trigger_statements` (`db.py:40`) extracts the trigger DDL for the test reset.

### `clock`
```python
def set_today(value: date | None) -> None:     # clock.py:16
def set_time(value: time | None) -> None:      # clock.py:21
def now() -> datetime:                         # clock.py:26
def today() -> date:                           # clock.py:33
def now_iso() -> str:                          # clock.py:37
def real_now() -> datetime:                    # clock.py:41  never pinned
def days(start: date, end: date):              # clock.py:46  inclusive range
```

### `errors`
See section 3. `DomainError(message, code=None, details=None)` at `errors.py:8` carries `status`, `default_code`, `message`, `code`, `details`.

### `config`
```python
class Settings:                                # config.py:15 (frozen dataclass)
def load_settings() -> Settings:               # config.py:30
```

### `seed`
Deterministic demo data (same ids every run): 3 teams, 1 HR, 3 managers, 15 employees, 3 leave types (`seed.py:36`), 6 shift templates (`seed.py:39`), last year's accrual, leave and year-end close, this year to date, four weeks of roster, upcoming approved and pending leave. Leave dates are chosen with the real coverage engine (`_window`, `seed.py:178`). All users get `password123` and a fixed old `password_changed_at`, so tokens survive a reset.

```python
async def seed(conn: aiosqlite.Connection) -> None:     # seed.py:70
async def wipe(conn: aiosqlite.Connection) -> None:     # seed.py:222  drops audit triggers, deletes, re-creates them
async def reset(conn: aiosqlite.Connection) -> None:    # seed.py:233  wipe + seed (used by POST /api/test/reset)
```
CLI: `python -m app.seed [--reset] [--db PATH]` (`_main`, `seed.py:238`). Without `--reset` it refuses to touch a database that already has users.

### `services/common`
Shared lookups and formatting.
```python
def r2(value: float | Decimal) -> float:                                              # common.py:11  2 dp, half up
def runs_on(template: dict, day: date) -> bool:                                       # common.py:34
def shift_interval(template: dict, day: date) -> tuple[datetime, datetime]:           # common.py:38  end <= start means next day
def intervals_overlap(a: tuple[datetime, datetime], b: tuple[datetime, datetime]) -> bool:   # common.py:47
def fmt_day(d: date | str) -> str:                                                    # common.py:51
def fmt_range(start: date | str, end: date | str) -> str:                             # common.py:56
async def team_manager_id(conn: aiosqlite.Connection, team_id: int | None) -> int | None:   # common.py:77  active user with role manager
async def hr_admin_ids(conn: aiosqlite.Connection) -> list[int]:                      # common.py:89
def can_manage_team(user: dict, team_id: int) -> bool:                                # common.py:94
```

### `services/org`
Users (soft delete) and teams, including the one manager per team.
```python
async def list_users(ctx: Ctx, include_inactive: bool, team_id: int | None) -> list[dict]:   # org.py:89
async def update_user(ctx: Ctx, user_id: int, changes: dict) -> dict:     # org.py:130
async def deactivate_user(ctx: Ctx, user_id: int) -> dict:                # org.py:185
async def list_teams(ctx: Ctx) -> list[dict]:                             # org.py:227
async def create_team(ctx: Ctx, name: str, department: str, manager_id: int | None) -> dict:   # org.py:268
async def update_team(ctx: Ctx, team_id: int, changes: dict) -> dict:     # org.py:281
async def create_user(                                                    # org.py:101
    ctx: Ctx, name: str, email: str, role: str, team_id: int | None, password: str, join_date: date | None
) -> dict:
```
Rules: HR only. HR Admins have no team; others need one. Passwords are 8 to 72 bytes. Cannot change your own role or deactivate yourself. The last active HR Admin cannot be demoted or deactivated (`LAST_HR_ADMIN`, defensive). A team change or role change calls `_stop_managing` (`org.py:80`) and `_release_future_shifts` (`org.py:71`). Deactivation cancels pending leave and open swaps, releases future shifts, then sets `active=0`. Creating an eligible user runs `accrual.catch_up(conn, user_id)`. A password change updates `password_changed_at` from the real clock, which kills older tokens.

### `services/leave_types`
```python
async def list_types(ctx: Ctx, include_inactive: bool) -> list[dict]:               # leave_types.py:36
async def create_type(ctx: Ctx, name: str, entitlement: float, cap: float) -> dict: # leave_types.py:44
async def update_type(ctx: Ctx, type_id: int, changes: dict) -> dict:               # leave_types.py:59
```
HR only (list is open; archived types shown only to HR with `include_inactive`). Entitlement 0 to 366, cap at least 0, unique name (case-insensitive). Creating a type, or re-activating one, runs `accrual.catch_up` so this year's months are credited.

### `services/shift_templates`
```python
async def list_templates(ctx: Ctx, team_id: int | None, include_inactive: bool) -> list[dict]:   # shift_templates.py:38
async def update_template(ctx: Ctx, template_id: int, changes: dict) -> dict:                    # shift_templates.py:73
async def create_template(                                                                       # shift_templates.py:51
    ctx: Ctx, team_id: int, name: str, start: str, end: str, days: list[int], min_headcount: int
) -> dict:
```
HR for any team, a manager for their own (`can_manage_team`). Times `HH:MM` (`TIME_RE`, `shift_templates.py:12`), start different from end, days 0 (Mon) to 6 (Sun), each once, minimum at least 0. Archiving (`active` true to false) removes all assignments from today on via `roster.remove_assignments` (which cancels open swaps) and notifies the team manager unless they did it. Editing times or days does not move existing assignments.

### `services/accrual`
Ledger-based balances. A balance is never stored; it is `SUM(amount)` over `balance_ledger` for user, type and year.
```python
ELIGIBLE_ROLES = ("employee", "manager")                                  # accrual.py:17
def monthly_credit(entitlement: float, month: int) -> float:              # accrual.py:20
async def run_monthly(                                                    # accrual.py:30
    conn: aiosqlite.Connection,
    year: int,
    month: int,
    user_id: int | None = None,
    actor: dict | None = None,
    audited: bool = True,
) -> int:
async def run_year_end(                                                   # accrual.py:68
    conn: aiosqlite.Connection, closing_year: int, actor: dict | None = None, audited: bool = True
) -> int:
async def catch_up(conn: aiosqlite.Connection, user_id: int | None = None, audited: bool = True) -> None:   # accrual.py:109
async def balances_for(conn: aiosqlite.Connection, user: dict, year: int) -> list[dict]:   # accrual.py:135
async def available(conn: aiosqlite.Connection, user_id: int, leave_type_id: int, year: int) -> float:   # accrual.py:185
async def get_balances(ctx: Ctx, user_id: int | None, year: int | None) -> list[dict]:     # accrual.py:201
async def get_ledger(ctx: Ctx, user_id: int | None, year: int | None) -> list[dict]:       # accrual.py:206
async def adjust(ctx: Ctx, user_id: int, leave_type_id: int, amount: float, reason: str, year: int | None) -> list[dict]:   # accrual.py:223
async def run_monthly_manual(ctx: Ctx, year: int, month: int) -> int:     # accrual.py:255
async def run_year_end_manual(ctx: Ctx, closing_year: int) -> int:        # accrual.py:265
```
Rules:
- `monthly_credit` = `round(E*m/12, 2) - round(E*(m-1)/12, 2)`, so the twelve credits sum exactly to E.
- `run_monthly` is idempotent via the unique index `ux_ledger_period`. It skips users whose year is already closed and months before their join month.
- `run_year_end` writes a `year_end_close` row (`-positive` balance, in the closing year) and a `carry_forward` row (`min(positive, cap)`, in the next year). A negative balance closes as 0.
- `catch_up` finishes and closes last year if it has any ledger movement, then credits this year to date.
- `available` = balance minus the days of that user's pending requests starting that year. This is the "no negative balance" rule.
- Manual runs: HR only; no future month; only past years can be closed (the manual close first completes that year's accrual).
- `adjust` does not check the resulting balance, so an HR debit can take it below zero. A non-zero amount and a reason are required.

### `services/leave`
Apply (with the coverage hard block), approve and reject, cancel with re-roster and per-day refund.
```python
def working_days(start: date, end: date) -> int:                          # leave.py:19  Mon-Fri only
async def approvers(conn: aiosqlite.Connection, requester: dict) -> list[int]:   # leave.py:24
async def preview(ctx: Ctx, leave_type_id: int, start: date, end: date) -> dict: # leave.py:174
async def apply(ctx: Ctx, leave_type_id: int, start: date, end: date, reason: str) -> dict:   # leave.py:185
async def decide(ctx: Ctx, leave_id: int, approve: bool, comment: str) -> dict:  # leave.py:211
async def cancel(ctx: Ctx, leave_id: int) -> dict:                        # leave.py:285
async def expire_owed_days(conn: aiosqlite.Connection) -> int:            # leave.py:397
async def on_assignment_added(conn: aiosqlite.Connection, user_id: int, day: date) -> None:   # leave.py:414
async def list_requests(ctx: Ctx, scope: str) -> list[dict]:              # leave.py:449
async def pending_for(conn: aiosqlite.Connection, actor: dict) -> list[dict]:   # leave.py:462
async def get_request(ctx: Ctx, leave_id: int) -> dict:                   # leave.py:475
async def out_many(conn: aiosqlite.Connection, actor: dict, rows: list[dict]) -> list[dict]:   # leave.py:482
async def cancel_pending_for_user(conn: aiosqlite.Connection, actor: dict, user_id: int, reason: str) -> None:   # leave.py:486
```
Rules worth knowing:
- **Routing** (`approvers`, `leave.py:24`): employee goes to the team's active manager (none means `TEAM_HAS_NO_MANAGER`). Manager goes to every HR Admin, and any one may decide. HR Admins cannot apply. Nobody decides their own request (`_can_decide`, `leave.py:33`).
- **Apply rules** live in `_check` (`leave.py:121`) as an ordered list of errors. `apply` raises the first. `preview` returns all messages plus `days`, `available`, `remaining_after` and `violations`, and writes nothing. The frontend's live preview calls it.
- **Approve** (`decide`, `leave.py:211`) re-checks balance (`leave.py:242`) and coverage (`leave.py:244`). It writes a `leave_taken` ledger row, copies today-onward assignments in range into `leave_removed_shifts`, deletes them via `roster.remove_assignments`, and notifies. Rejecting needs a comment. Approving a leave that started earlier leaves past roster rows untouched.
- **Cancel pending** is a withdraw. **Cancel approved** is allowed only while `start_date > today` (`leave.py:301`) and goes through `_cancel_approved` (`leave.py:313`): it first marks the leave cancelled so it no longer blocks restoring shifts, then tries to restore each removed shift using `roster.assignment_problem` (skips past dates). For each Mon-Fri day of the leave: if every shift removed that day was restored (or none was removed), it writes a `leave_refund` +1 row and a `refunded` `leave_refund_days` row immediately (`_refund_day`, `leave.py:378`). Otherwise the day is `owed`.
- **Owed days.** `on_assignment_added` (`leave.py:414`) runs after any assignment is created (assign, copy week, swap approval). It refunds an owed day once the person has at least `shifts_removed` assignments that date. `expire_owed_days` turns owed days whose date has passed into `forfeited`. It runs at startup and before each refund check. Reads report such days as forfeited without writing (`_detail`, `leave.py:90`).
- Visibility: HR, the requester and the requester's approvers can read a request; everyone else gets 404.

### `services/roster`
Assign and unassign people to shift by date, copy a week, roster view, my shifts. Past dates are read-only.
```python
async def assignment_problem(                                             # roster.py:24
    conn: aiosqlite.Connection, template: dict, user: dict, day: date, ignore_ids: tuple[int, ...] = ()
) -> str | None:
async def assign(ctx: Ctx, template_id: int, user_id: int, day: date) -> dict:   # roster.py:85
async def unassign(ctx: Ctx, assignment_id: int) -> None:                 # roster.py:110
async def remove_assignments(                                             # roster.py:140
    conn: aiosqlite.Connection, rows: list[dict], reason: str, actor: dict | None, notify_user: bool = True
) -> None:
async def restore(conn: aiosqlite.Connection, template: dict, user_id: int, day: date) -> int:   # roster.py:177
async def copy_week(ctx: Ctx, team_id: int, week_start: date) -> dict:   # roster.py:182
async def team_leaves(conn: aiosqlite.Connection, team_ids: list[int], start: date, end: date) -> list[dict]:   # roster.py:224
async def team_members(conn: aiosqlite.Connection, team_ids: list[int]) -> list[dict]:   # roster.py:237
def check_range(start: date, end: date, max_days: int) -> None:           # roster.py:247
async def roster_view(ctx: Ctx, team_id: int, start: date, end: date) -> dict:   # roster.py:254
async def my_shifts(ctx: Ctx, start: date | None, end: date | None) -> list[dict]:   # roster.py:280
```
Rules:
- `assignment_problem` is the single guard shared by `assign`, `copy_week`, leave-cancel restore and swap validation. It rejects deactivated users, HR Admins, wrong team, archived templates, days the shift doesn't run, approved or pending leave on that day, and double-booking (same shift, or overlapping intervals; overnight shifts belong to their start date). It returns a message, and callers wrap it in `Conflict(code="ROSTER_CONFLICT")` or record it as a skip.
- `remove_assignments` cancels open swaps on the rows first, deletes, audits, notifies the person, and compares coverage before and after. A future cell that newly falls below minimum notifies the team manager unless they made the change.
- `copy_week` requires a Monday, copies the previous seven days one week forward, skips past dates and anything `assignment_problem` refuses, and returns `{"copied", "skipped": [...]}`.
- View windows: roster at most 42 days, calendar 62, my shifts 366 (default today for 28 days).

### `services/swaps`
1-for-1 exchange of two future shifts in a team: requester proposes, target accepts, approver decides.
```python
async def approvers(conn: aiosqlite.Connection, swap: dict) -> list[int]:       # swaps.py:32
async def validate(conn: aiosqlite.Connection, w: dict) -> None:                # swaps.py:68
async def propose(ctx: Ctx, my_assignment_id: int, their_assignment_id: int) -> dict:   # swaps.py:118
async def respond(ctx: Ctx, swap_id: int, accept: bool) -> dict:               # swaps.py:165
async def cancel(ctx: Ctx, swap_id: int) -> dict:                              # swaps.py:190
async def decide(ctx: Ctx, swap_id: int, approve: bool, comment: str) -> dict: # swaps.py:206
async def cancel_for_assignments(conn: aiosqlite.Connection, assignment_ids: list[int], reason: str,   # swaps.py:241
                                 actor: dict | None) -> None:
async def cancel_for_user(conn: aiosqlite.Connection, actor: dict | None, user_id: int, reason: str) -> None:   # swaps.py:257
async def list_swaps(ctx: Ctx) -> list[dict]:                                  # swaps.py:276
async def pending_for(conn: aiosqlite.Connection, actor: dict) -> list[dict]:  # swaps.py:289
```
Rules:
- Status path: `pending_peer` to `pending_manager` to `approved`/`rejected`; or `declined`, `cancelled`.
- `validate` (`swaps.py:68`) runs at propose, accept and approve (BRD criterion 2). It checks that both assignments are unchanged since the snapshot, neither shift has started (`swaps.py:87`), both users are active, neither is on approved or pending leave on either date (`swaps.py:94`), and `roster.assignment_problem` passes for each person on the other's shift (ignoring the two rows). Any failure is `Conflict(code="SWAP_BLOCKED")`.
- Approver is the team manager, or every HR Admin when the manager is one of the two people (`approvers`, `swaps.py:32`). No manager means nobody can approve, so `propose` refuses with `TEAM_HAS_NO_MANAGER`.
- Approval swaps `user_id` on the two assignment rows in place, then calls `leave.on_assignment_added` for both people.
- `swap_requests.*_assignment_id` has no foreign key on purpose, so closed swaps survive later unassignments.

### `services/coverage`
The only place headcount and gaps are computed. Read-only. `headcount` = assigned people who are active and not on approved or pending leave that date. `gap` = headcount below the minimum.
```python
async def leaves_by_user(                                                  # coverage.py:16
    conn: aiosqlite.Connection, start: date, end: date, user_ids: list[int] | None = None
) -> dict[int, list[dict]]:
def leave_status_on(leaves: list[dict], day: date) -> str | None:          # coverage.py:32  'approved' beats 'pending'
async def coverage_grid(                                                   # coverage.py:43
    conn: aiosqlite.Connection,
    team_ids: list[int],
    start: date,
    end: date,
    template_ids: list[int] | None = None,
) -> list[dict]:
async def gaps(conn: aiosqlite.Connection, team_ids: list[int], start: date, end: date) -> list[dict]:   # coverage.py:110
async def leave_violations(conn: aiosqlite.Connection, user_id: int, start: date, end: date) -> list[dict]:   # coverage.py:114
```
`leave_violations` is the coverage rule shared by leave apply/preview (`leave.py:161`) and leave approval (`leave.py:244`). `coverage_grid` feeds the roster view, the calendar, the dashboard and the gap alerts in `roster.remove_assignments`. `leaves_by_user` and `leave_status_on` are also used by the roster guard and swap validation.

### `services/views`
Read models. `calendar` (`views.py:12`) and `dashboard` (`views.py:39`).
```python
async def calendar(ctx: Ctx, start: date, end: date, team_id: int | None) -> dict:   # views.py:12
async def dashboard(ctx: Ctx) -> dict:                                              # views.py:39
```
`calendar`: HR may pick any team or all; others only their own team (403 otherwise). `dashboard`: managers and HR only; returns `pending_leave`, `pending_swaps`, `gaps_today`, `upcoming_gaps` (next 7 days) and `availability` (`on_shift`, `on_leave`, `off` per person). This is BRD criterion 3.

### `services/audit`
Append-only record written in the same transaction as the change. Strips `password` and `password_hash` keys from before/after.
```python
async def record(                                                          # audit.py:29
    conn: aiosqlite.Connection,
    actor: dict | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    before: dict | None = None,
    after: dict | None = None,
    team_id: int | None = None,
) -> None:
async def list_entries(                                                    # audit.py:58
    ctx: Ctx,
    actor_id: int | None,
    entity_type: str | None,
    start: date | None,
    end: date | None,
    limit: int,
    offset: int,
) -> dict:
```
`actor=None` is recorded as "System". Action names are dotted (`leave.approve`) or `seed`. `list_entries` is HR (all) and manager (`team_id` equals their managed team); limit 1 to 500.

### `services/notify`
In-app inbox, written in the same transaction as the event.
```python
KINDS = ("approval", "leave", "swap", "roster", "coverage")                 # notify.py:11
async def notify(conn: aiosqlite.Connection, user_ids: Iterable[int | None], kind: str, message: str, link: str) -> None:   # notify.py:14
async def list_mine(ctx: Ctx, unread_only: bool) -> dict:                   # notify.py:25
async def mark_read(ctx: Ctx, notification_id: int) -> None:                # notify.py:41
async def mark_all_read(ctx: Ctx) -> None:                                  # notify.py:49
```
`notify` de-duplicates recipients and ignores `None`. Stored `link` values are legacy route names (`/approvals`, `/leave`, `/shifts`, `/roster`). The SPA redirects the old ones (`App.tsx:28`). `list_mine` returns the latest 50 plus the unread count.

## 5. Data model

Source: `backend/app/schema.sql` (13 `STRICT` tables, all `CREATE ... IF NOT EXISTS`, safe to re-run; `schema_version` = 1 in `schema_meta`). Dates are `TEXT YYYY-MM-DD`; timestamps ISO-8601 with `+05:30`; booleans 0/1; leave quantities `REAL` rounded to 2 dp in code.

| Table (`schema.sql:line`) | Purpose and key constraints |
|---|---|
| `schema_meta` (24) | Key/value; holds `schema_version` |
| `teams` (35) | `name` unique (NOCASE); `manager_id` UNIQUE FK to `users` (a user manages at most one team); `department` is a label |
| `users` (46) | `role` in employee/manager/hr_admin; `team_id` FK; CHECK `(role='hr_admin') = (team_id IS NULL)`; CHECK `(active=0) = (deactivated_at IS NOT NULL)`; lower-case unique `email`; `password_changed_at` invalidates old tokens |
| `leave_types` (67) | `annual_entitlement` 0 to 366, `carry_forward_cap` at least 0, `active` = not archived |
| `shift_templates` (79) | Per team; `start_time`/`end_time` `HH:MM` (end <= start crosses midnight); `days_of_week` comma list `0`-`6`; `min_headcount`; UNIQUE `(team_id, name)` |
| `shift_assignments` (102) | The roster: user, template, date. UNIQUE `(user_id, shift_template_id, date)`. Unassigning deletes the row (audited). A swap rewrites `user_id` in place |
| `leave_requests` (119) | `days` = Mon-Fri count fixed at submission; `status` pending/approved/rejected/cancelled; CHECKs: one calendar year, rejected needs a comment, cancelled iff `cancelled_at` set |
| `leave_removed_shifts` (148) | Shifts taken off at approval; `status` removed/restored/not_restored; UNIQUE `(leave_request_id, shift_template_id, date)` |
| `balance_ledger` (169) | Every balance movement; `kind` accrual/carry_forward/year_end_close/leave_taken/leave_refund/adjustment; sign and `period` shape enforced per kind by CHECKs |
| `leave_refund_days` (220) | Per-day refund state after cancelling approved leave: refunded/owed/forfeited; UNIQUE `(leave_request_id, date)`; weekends rejected |
| `swap_requests` (243) | Snapshot of both shifts; `status` pending_peer/pending_manager/approved/rejected/declined/cancelled; assignment ids have no FK |
| `notifications` (283) | `kind`, `message`, `link`, `read` |
| `audit_log` (300) | Append-only; `actor_name` copied; `team_id` lets managers see their team; before/after JSON validated with `json_valid` |

Indexes: `ix_users_team` (team_id, active); `ix_assignments_shift_date`, `ix_assignments_user_date`, `ix_assignments_date`; `ix_leave_user_status`, `ix_leave_dates`; `ix_ledger_user_year`; `ix_refund_user_date`; `ix_swaps_requester`, `ix_swaps_target`, `ix_swaps_team`; `ix_notifications_user`; `ix_audit_team`, `ix_audit_actor`, `ix_audit_entity`.

Unique and partial indexes that carry rules:
- `ux_ledger_period` (`schema.sql:205`): one row per (user, type, kind, period) for accrual, carry_forward and year_end_close. This makes accrual idempotent.
- `ux_ledger_leave_taken` (`schema.sql:210`): an approved request is deducted exactly once.
- `ux_swaps_open_requester_assignment` and `ux_swaps_open_target_assignment` (`schema.sql:275-278`): an assignment is on at most one open swap per side. The service catches the cross-side case.

Audit triggers: `audit_log_no_update` (`schema.sql:318`) and `audit_log_no_delete` (`schema.sql:324`) `RAISE(ABORT, 'audit_log is append-only')`. The test reset drops and re-creates them (`seed.wipe`, `seed.py:222`).

Cross-row rules (manager is an active manager of that team; a team's shift belongs to that team) are enforced in services, not by constraints.

## 6. API surface

Contract: `docs/openapi.yaml`. A script comparison on 2026-10-30 shows its 45 method+path pairs equal the registered routes. Request and response bodies were not compared. Prefix every path with `/api`. Handler lines are in `routers.py`.

| Method | Path | Who may call | Handler (line) → service |
|---|---|---|---|
| GET | `/health` | anyone | `health` (25) |
| POST | `/auth/login` | anyone | `login` (31), uses `auth` + `audit.record` |
| POST | `/auth/logout` | anyone | `logout` (44) |
| GET | `/auth/me` | signed in | `get_me` (49) |
| GET | `/users` | HR | `list_users` (55) → `org.list_users` |
| POST | `/users` | HR | `create_user` (60) → `org.create_user` |
| PATCH | `/users/{user_id}` | HR | `update_user` (65) → `org.update_user` |
| DELETE | `/users/{user_id}` | HR | `deactivate_user` (70) → `org.deactivate_user` |
| GET | `/teams` | signed in | `list_teams` (75) → `org.list_teams` |
| POST | `/teams` | HR | `create_team` (80) → `org.create_team` |
| PATCH | `/teams/{team_id}` | HR | `update_team` (85) → `org.update_team` |
| GET | `/leave-types` | signed in (archived only for HR with flag) | `list_leave_types` (91) → `leave_types.list_types` |
| POST | `/leave-types` | HR | `create_leave_type` (96) → `leave_types.create_type` |
| PATCH | `/leave-types/{leave_type_id}` | HR | `update_leave_type` (101) → `leave_types.update_type` |
| GET | `/shift-templates` | signed in (archived only for that team's manager/HR) | `list_shift_templates` (107) → `shift_templates.list_templates` |
| POST | `/shift-templates` | HR or the team's manager | `create_shift_template` (112) → `shift_templates.create_template` |
| PATCH | `/shift-templates/{template_id}` | HR or the team's manager | `update_shift_template` (119) → `shift_templates.update_template` |
| POST | `/accrual/monthly` | HR | `run_monthly` (125) → `accrual.run_monthly_manual` |
| POST | `/accrual/year-end` | HR | `run_year_end` (130) → `accrual.run_year_end_manual` |
| GET | `/balances` | self; manager for own team; HR any | `get_balances` (135) → `accrual.get_balances` |
| GET | `/balances/ledger` | same as balances | `get_ledger` (140) → `accrual.get_ledger` |
| POST | `/balances/adjustments` | HR | `adjust_balance` (145) → `accrual.adjust` |
| GET | `/leave-requests?scope=mine\|pending\|decided` | signed in (pending lists only what you can decide) | `list_leave` (151) → `leave.list_requests` |
| POST | `/leave-requests` | employee, manager | `apply_leave` (156) → `leave.apply` |
| POST | `/leave-requests/preview` | employee, manager | `preview_leave` (161) → `leave.preview` |
| GET | `/leave-requests/{leave_id}` | requester, approvers, HR | `get_leave` (166) → `leave.get_request` |
| POST | `/leave-requests/{leave_id}/decision` | the request's approver (not self) | `decide_leave` (171) → `leave.decide` |
| POST | `/leave-requests/{leave_id}/cancel` | the requester | `cancel_leave` (176) → `leave.cancel` |
| GET | `/roster?team_id&start&end` | HR or that team's manager | `get_roster` (182) → `roster.roster_view` |
| POST | `/roster/assignments` | HR or the team's manager | `assign` (187) → `roster.assign` |
| DELETE | `/roster/assignments/{assignment_id}` | HR or the team's manager | `unassign` (192) → `roster.unassign` |
| POST | `/roster/copy-week` | HR or the team's manager | `copy_week` (197) → `roster.copy_week` |
| GET | `/roster/mine` | signed in | `my_shifts` (202) → `roster.my_shifts` |
| GET | `/swaps` | signed in (HR all; others own + managed team) | `list_swaps` (208) → `swaps.list_swaps` |
| POST | `/swaps` | employee, manager | `propose_swap` (213) → `swaps.propose` |
| POST | `/swaps/{swap_id}/respond` | the target | `respond_swap` (218) → `swaps.respond` |
| POST | `/swaps/{swap_id}/cancel` | the proposer | `cancel_swap` (223) → `swaps.cancel` |
| POST | `/swaps/{swap_id}/decision` | swap approvers | `decide_swap` (228) → `swaps.decide` |
| GET | `/calendar?start&end&team_id` | signed in (non-HR: own team only) | `get_calendar` (234) → `views.calendar` |
| GET | `/dashboard` | manager, HR | `get_dashboard` (239) → `views.dashboard` |
| GET | `/audit` | HR (all); manager (own team) | `get_audit` (245) → `audit.list_entries` |
| GET | `/notifications` | signed in | `list_notifications` (259) → `notify.list_mine` |
| POST | `/notifications/read-all` | signed in | `read_all` (264) → `notify.mark_all_read` |
| POST | `/notifications/{notification_id}/read` | owner | `read_one` (269) → `notify.mark_read` |
| POST | `/test/reset` | anyone, only when `LSM_TEST_MODE=1` | `reset` (278) → `seed.reset` |

## 7. Frontend

React 19, TypeScript, Vite, React Router 7 (`package.json`). No UI library. The browser talks only to `/api` via `api.ts`.

**Entry.** `src/main.tsx:8` renders `<App/>` in `StrictMode` with the two Fontsource fonts and `styles.css`.

**Routing and role gating** (`App.tsx:46`). `BrowserRouter` → `AuthProvider` → routes:
- Public: `/` (Landing), `/login`.
- `MOVED` (`App.tsx:28`) maps legacy addresses to new homes (`/dashboard`, `/approvals`, `/notifications`, `/leave`, `/shifts`, `/shift-templates`, `/audit`, `/admin/*`), because stored notification links still use them.
- Under `<RequireRole><Layout/></RequireRole>`: `/home`, `/calendar`, `/inbox` (all roles); `/requests` (employee, manager); `/roster` (manager, HR); `/settings` (manager, HR) with children `users`, `teams`, `leave-types` (HR only), `shift-templates` and `audit` (manager, HR); `*` shows `NotFound`.
- Hiding a route is convenience only. The server enforces every permission.

**`auth.tsx`**
```ts
export function AuthProvider({ children }: { children: ReactNode })                 // auth.tsx:16  loads /auth/me on start
export function useAuth(): AuthState                                                 // auth.tsx:53
export function useMe(): Me                                                          // auth.tsx:60  only under <RequireRole>
export function homeFor(_role: Role): string                                         // auth.tsx:66  always "/home"
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode })   // auth.tsx:70
export function NotAllowed()                                                         // auth.tsx:79
```
`RequireRole` shows a loading state, redirects to `/login` (remembering `from`), or renders `NotAllowed`. A 401 from any call clears `me` through `setUnauthorizedHandler`.

**`api.ts`**
```ts
export class ApiError extends Error { status; code; details }                        // api.ts:9
export function toApiError(status: number, body: unknown): ApiError                  // api.ts:24
export function setUnauthorizedHandler(fn: (() => void) | null)                      // api.ts:60
export async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T>   // api.ts:64
export const api = { ... }                                                           // api.ts:99
```
`request` is same-origin `fetch` with the cookie, JSON in and out. It maps network failure to `ApiError(0, "NETWORK", ...)`, returns `undefined` for 204, and calls the 401 handler except for `/auth/login`. The `api` object has one typed function per endpoint (login, users, teams, leaveTypes, shiftTemplates, runMonthly, balances, leaveRequests, previewLeave, applyLeave, decideLeave, cancelLeave, roster, assign, copyWeek, myShifts, swaps, proposeSwap, respondSwap, decideSwap, calendar, dashboard, audit, notifications, and so on).

**`hooks.ts`**
```ts
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList): Loaded<T>   // hooks.ts:12  { data, error, loading, reload }
export function asApiError(e: unknown): ApiError                                     // hooks.ts:43
export function useAction()                                                          // hooks.ts:49  { busy, error, setError, run }
```
`useLoad` ignores stale responses (a sequence counter). `useAction().run(fn)` resolves `true` on success and captures an `ApiError` otherwise.

**`types.ts`** (hand-written, mirrors `openapi.yaml`): `Role` (3), `Me` (6), `User` (17), `Team` (30), `LeaveType` (40), `ShiftTemplate` (48), `Balance` (60), `LedgerEntry` (78), `LeaveRequest` (94), `LeaveRequestDetail` (131), `LeavePreview` (144), `Assignment` (152), `MyShift` (162), `CoverageCell` (180), `CalendarView` (223), `RosterView` (213), `Swap` (239), `Dashboard` (274), `AuditPage` (297), `NotificationList` (311).

**`dates.ts`**: pure helpers on ISO strings; maths in UTC so the browser time zone can't shift a day. "Today" always comes from `Me.today`.
```ts
export function workingDays(start: string, end: string): number                      // dates.ts:67  Mon-Fri, mirrors the server
export function weekStart(iso: string): string                                       // dates.ts:36  Monday
export function formatDate(iso: string, year?: number): string                       // dates.ts:81  "Mon 15 Jun"
export function hasStarted(date: string, start: string, today: string, now: Date = new Date()): boolean   // dates.ts:112
export function formatDays(n: number): string                                        // dates.ts:117  up to 2 dp
```
Also `isISODate`, `addDays`, `weekday` (0 = Monday), `isWeekend`, `monthStart`, `monthEnd`, `addMonths`, `range`, `daysBetween`, `overlaps`, `weekdayName`, `formatRange`, `monthLabel`, `formatTimestamp`, `istTimeNow`.

**`plain.ts`**: plain-language wording.
```ts
export function swapSteps(s: Swap, meId: number): Step[]                             // plain.ts:14  progress line steps
export function leaveStatusText(r: LeaveRequest, approver: string | null): string    // plain.ts:37
export function plural(n: number, one: string, many = `${one}s`): string             // plain.ts:50
```
**`swapOptions.ts`**: `swapOptions(cells, leaves, mine, meId, today, now?)` (`swapOptions.ts:26`) lists teammate shifts that can be taken, with a plain `blocked` reason for leave. The server still applies every rule.

**Pages** (`src/pages/`; default exports):

| File:line | Route | Roles | Notes |
|---|---|---|---|
| `Landing.tsx:45` | `/` | public | Static marketing copy, one link to `/login` |
| `Login.tsx:8` | `/login` | public | Redirects to `from` or `/home` when signed in |
| `Home.tsx:275` | `/home` | all | `HrHome` (`Home.tsx:197`) for HR, `PeopleHome` (`Home.tsx:46`) otherwise; managers also load `api.dashboard()` |
| `Calendar.tsx:76` | `/calendar` | all | Month grid; `DayPanel` opens `LeaveSheet`/`SwapSheet`. `data-testid` `day-<date>`, `cell-<shift>-<date>` |
| `Requests.tsx:91` | `/requests` | employee, manager | Tabs by `?tab=swaps`; balances, requests, ledger, swaps |
| `Roster.tsx:63` | `/roster` | manager, HR | Week grid; add/remove; copy previous week. `data-testid` `cell-<shift>-<date>` |
| `Inbox.tsx:29` | `/inbox` | all | Decisions (non-employees), swap offers, notifications; dispatches `lsm:notifications` |
| `Settings.tsx:19` | `/settings` | manager, HR | Tab bar from `settingsTabs(role)` (`Settings.tsx:14`) and `<Outlet/>` |
| `Users.tsx:85` | `/settings/users` | HR | |
| `Teams.tsx:56` | `/settings/teams` | HR | |
| `LeaveTypes.tsx:145` | `/settings/leave-types` | HR | Also holds the accrual and balance-adjustment panels |
| `ShiftTemplates.tsx:73` | `/settings/shift-templates` | manager, HR | |
| `AuditLog.tsx:38` | `/settings/audit` | manager, HR | Filters by entity type and date; 50 per page |

**Components** (`src/components/`):
```ts
export default function Layout()                                                     // Layout.tsx:37  top bar + bottom tab bar, unread badge
export function navFor(role: Role): NavItem[]                                        // Layout.tsx:29  from NAV (Layout.tsx:18)
export function LeaveSheet({ initialStart, onClose, onDone }: {...})                 // LeaveSheet.tsx:12  live preview after 250 ms
export function RangePicker({ start, end, today, onChange }: {...})                  // RangePicker.tsx:8
export function SwapSheet({ initialShiftId, onClose, onDone }: {...})                // SwapSheet.tsx:14
export function Timeline({ steps, label }: { steps: Step[]; label: string })         // Timeline.tsx:4
export function useSwapActions(onDone: (message: string) => void)                    // swapActions.tsx:7
export function useDecisions(onDone: () => void)                                     // decisions.tsx:14
export function LeaveCard({ r, year, onDecide, extra }: {...})                       // decisions.tsx:58
export function SwapCard({ s, meId, year, onDecide, actions }: {...})                // decisions.tsx:89
```
`ui.tsx` (shared): `PageHeader` (10), `Card` (23), `statusLabel` (72), `StatusBadge` (77), `ErrorBox` (81, lists every coverage violation when the error is `COVERAGE_VIOLATION`), `Notice` (101), `Loading` (105), `Empty` (109), `Modal` (113, focus management, Escape to close), `ConfirmDialog` (145), `DecisionDialog` (169, comment required to reject), `Field` (198), `TableWrap` (210), and the `NestedPage` context (8) that turns `h1` into `h2` inside Settings.

`Layout` refreshes the unread count on navigation, every 60 s and on the `lsm:notifications` window event (`Layout.tsx:46-57`).

## 8. Tests

**Backend** (`backend/tests`, pytest, `filterwarnings = error`). Almost every test drives the HTTP API through `TestClient`. A few call pure functions (`monthly_credit`, `working_days`), and `test_schema.py` uses raw `sqlite3`. There are no async service-level tests.

| File | Covers |
|---|---|
| `test_auth.py` | Login cookie, bad credentials, deactivated user, tampered/expired tokens, password reset kills tokens, role from DB, RBAC 403s, JSON-only writes, JSON 404, health |
| `test_org.py` | User validation, soft delete side effects, last-HR rule, team moves, team and manager rules, leave-type and shift-template rules, archiving a shift |
| `test_accrual.py` | Twelve credits sum to the entitlement, join-month start, idempotent runs, year-end carry and lapse, adjustments, balance visibility, ledger order |
| `test_leave.py` | Working days, apply rules, overlap, balance incl. pending, coverage block, preview, routing, approve/reject, re-checks, shift removal |
| `test_cancel.py` | Withdraw, cancel approved, shift restore, per-day refund, owed days, refund via roster or swap, forfeiture |
| `test_roster.py` | Assign/unassign, permissions, each guard, overnight overlap, past read-only, headcount cells, copy week, gap alerts, my shifts |
| `test_swaps.py` | Full flow, leave blocks (approved and pending), stale snapshot, started shift, double-booking, proposal rules, decline/cancel, manager-involved swap goes to HR, auto-cancel, visibility |
| `test_views.py` | Dashboard, calendar, audit rows and scope, no password data in audit, append-only trigger, rollback leaves no audit row, notifications |
| `test_seed.py` | Seed determinism, seeded data obeys the rules, reset route only in test mode |
| `test_schema.py` | Constraints accept good rows and reject bad ones; the file is idempotent; triggers hold |

The three BRD success-criteria tests:
- Criterion 1, applying for leave reduces the balance: `test_brd1_applying_for_leave_reduces_the_balance` (`test_leave.py:27`).
- Criterion 2, a swap involving someone on approved leave is blocked: `test_brd2_swap_involving_someone_on_approved_leave_is_blocked` (`test_swaps.py:35`).
- Criterion 3, a manager sees today's gaps and pending approvals in one view: `test_brd3_manager_sees_todays_gaps_and_pending_approvals_in_one_view` (`test_views.py:11`).

**Database reset per test.** The `world` fixture (`conftest.py:164`) builds a new SQLite file in `tmp_path` from `schema.sql` (`build_org`, `conftest.py:119`: 7 users, 2 teams, 1 leave type, 3 shifts). It creates the app with `settings_for` (`conftest.py:150`: today pinned to Wed 2026-06-10, bcrypt rounds 4, no frontend dist), pins the time to 08:00, and enters `TestClient(app)` so startup runs the accrual catch-up. Teardown clears the clock pins. `Client` (`conftest.py:44`) is a signed-in user with their own cookie jar; `World.sql`, `.roster`, `.leave` and `.balance` set up or inspect rows directly. For planned E2E runs the equivalent is `POST /api/test/reset` (`routers.py:278`), which calls `seed.reset`.

**Frontend** (`npm test`, Vitest, jsdom, globals, setup `src/test-setup.ts`):

| File | Covers |
|---|---|
| `src/api.test.ts` | `toApiError` shapes (our body, FastAPI 422, unknown), `request` query/JSON/204/401 handler/network error |
| `src/dates.test.ts` | Date arithmetic, Monday = 0, week and month bounds, Mon-Fri count, formatting, IST "has started" |
| `src/plain.test.ts` | `swapSteps`, `leaveStatusText`, `plural` |
| `src/swapOptions.test.ts` | Which shifts can be offered and the blocked reasons |
| `src/components/ui.test.tsx` | `StatusBadge`, `ErrorBox` violation list, `DecisionDialog`, per-role navigation (at most five tabs) |
| `src/components/RangePicker.test.tsx` | Two-tap range with ordered ends; past days disabled |
| `src/pages/Landing.test.tsx` | One link to sign-in, FAQ answers, one `h1` |

Playwright: planned in `docs/06-testing-strategy.md` (`app/e2e/`), not built. The BRD criteria therefore have backend tests only.

## 9. How to change things

**Add a leave rule** (for example a maximum run of consecutive days):
1. `backend/app/services/leave.py`: add the check to `_check` (`leave.py:121`) in the order you want the error raised; use a specific `code` if the UI needs it. `preview` and `apply` pick it up. If it must hold at approval, add it to `decide` beside `leave.py:242`.
2. If it needs stored data, edit `backend/app/schema.sql` (idempotent only; there is no migration tool), `services/org.py` or `services/leave_types.py` to manage it, and update `types.ts`/`api.ts`.
3. `backend/tests/test_leave.py`: a case for apply, preview and approval.
4. `docs/00-feature-plan.md`, `docs/openapi.yaml` if the contract changed, and an entry in `docs/decision-log.md`.
5. No frontend change is needed for a message-only rule: `LeaveSheet` shows `preview.errors` as written.

**Add an endpoint:**
1. `backend/app/schemas.py`: a `Body` subclass if there is a body.
2. `backend/app/services/<area>.py`: the function, taking `ctx: Ctx`. Call `require_roles` or `can_manage_team`, validate (raise `DomainError` subclasses), write, then `audit.record` and `notify` in the same call.
3. `backend/app/routers.py`: route on `api` with `ReadCtx` (reads) or `WriteCtx` (writes). Call one service function only.
4. `docs/openapi.yaml`.
5. `frontend/src/types.ts` and `frontend/src/api.ts`.
6. `backend/tests/test_<area>.py`: happy path, permission 403, validation 400/409.

**Add a page:**
1. `frontend/src/pages/<Name>.tsx` (default export; use `useLoad`/`useAction`, `PageHeader`, `ErrorBox`, `Loading`, `Empty`).
2. `frontend/src/App.tsx`: add a `<Route>` inside the `Layout` route, wrapped in `RequireRole` when restricted. For a settings tab, nest it under `/settings` and add it to `TABS` in `pages/Settings.tsx:6`.
3. `frontend/src/components/Layout.tsx`: add to `NAV` (`Layout.tsx:18`) with `roles`. Keep each role at five tabs or fewer (`ui.test.tsx` enforces this).
4. `types.ts`/`api.ts` if it needs new data. Add `data-testid`s only where the Playwright plan expects them.
5. Tests for any new pure logic.

**Add a role-gated screen:**
1. Server first: `require_roles(ctx.user, ...)` or `can_manage_team` in the service function. Add a 403 test (`test_auth.py` has a parametrised list).
2. `App.tsx`: wrap the route in `<RequireRole roles={[...]}>`.
3. `Layout.tsx`: set `roles` on the `NAV` entry (or `TABS` in `Settings.tsx`).
4. `components/ui.test.tsx`: update the navigation-by-role expectations.

## 10. Known gaps

Where code and the hand-written docs disagree (the code is described elsewhere):

1. **Page set and routes.** `docs/02-low-level-design.md` (F2 `/dashboard`, F3 `/approvals`, F4 `/leave`, F5 `/shifts`, F12 `/notifications`, F8-F11 `/admin/*`, `/shift-templates`, `/audit`) describes pages that the working tree has folded into `Home`, `Inbox`, `Requests` and `Settings`. The old addresses survive only as redirects (`App.tsx:28`). The LLD also says `/` redirects by role, but `/` is the public Landing page (`App.tsx:52`).
2. **Uncommitted redesign.** `git status` shows `Approvals.tsx`, `Dashboard.tsx`, `MyLeave.tsx`, `MyShifts.tsx` and `Notifications.tsx` deleted, and `Home`, `Inbox`, `Requests`, `Settings`, `Landing`, `LeaveSheet`, `SwapSheet`, `RangePicker`, `Timeline`, `plain.ts` and `swapOptions.ts` untracked. HEAD (73db64c) does not contain them. `docs/decision-log.md` D-012 describes the earlier UI.
3. **Shell.** LLD F0 and D-012 describe a left sidebar and a notification bell. The code has a top bar on desktop and a bottom tab bar on phones, with an unread badge on the Inbox tab. LLD names `DateRangePicker`; the component is `RangePicker`. LLD F7 lists calendar filters for team, person, leave and shifts; the code offers a team picker (HR) or a "Team / Just me" toggle.
4. **Theme.** TRD 3.6 and D-012 say light and dark via CSS variables. `styles.css` has no `prefers-color-scheme` rule, and `frontend/README.md` says "one light theme".
5. **Availability table.** LLD F2 lists an availability table on the dashboard. The API returns `availability`, but `HrHome` uses it only for the "On shift today" and "On leave today" counts (`Home.tsx:222-223`). No table is rendered.
6. **JWT secret.** TRD 3.7 marks `LSM_JWT_SECRET` as required in production. `load_settings` (`config.py:30`) never refuses to start without it; it generates a random one and logs a warning.
7. **Service-level tests.** TRD 3.8 says "service tests via anyio, API tests via TestClient". There are no anyio service tests; everything uses `TestClient`.
8. **`services/__init__.py:1`** says every function takes the connection first. Request-facing functions take `ctx: Ctx`; only internal helpers take `conn`.
9. **Playwright `app/e2e/` does not exist**, and `test-all.sh` says so. All three BRD criteria are covered only by pytest. The frontend has unit tests but no browser-level test.

Behaviours to know that are not disagreements:
- **No scheduler.** Accrual, year-end close and forfeiture run at startup, on user or leave-type creation, and on HR's buttons. A process that stays up across a month boundary does not credit the new month by itself.
- **`accrual.adjust` can push a balance below zero** (no floor check, `accrual.py:223`). Leave applications cannot.
- **Notification links** are stored as old route names and depend on the redirect table in `App.tsx`. Changing a route name without updating `MOVED` breaks stored links.
- **`homeFor(_role)`** ignores its argument (`auth.tsx:66`).
- **`types.ts` is hand-written.** Nothing checks it against `openapi.yaml`, so drift is possible.
- **Open question from the feature plan**: Fri-Mon leave removes Sat/Sun shifts without charging leave (option (a) is implemented).
- No `TODO`/`FIXME` markers exist in `backend/app`, `backend/tests` or `frontend/src`.
