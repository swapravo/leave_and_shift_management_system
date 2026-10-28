# 6. Testing Strategy

## 6.1 Principles
- **Playwright proves the product works**: every user journey and all three BRD success criteria are exercised
  end-to-end in a real browser against the real backend and database.
- **pytest proves the rules are right**: coverage, accrual, refunds and guards have many edge cases that would
  be slow and indirect to cover through the UI.
- **Vitest covers pure frontend logic** (date maths, error parsing).
- **Every test starts from known data and a known "today"**, so results never depend on the real date or on
  other tests.
- **Local only, no CI**: the full suite must pass on the developer's machine before every push.
- No retries and no skipped tests to get green. A flaky test is a bug to fix.

| Layer | Tool | Scope | Speed | Location |
|---|---|---|---|---|
| E2E | Playwright `@playwright/test` 1.63.0 (TypeScript), Chromium | User journeys through the UI, role access, BRD criteria | slowest | `app/e2e/` |
| Backend | pytest 9 + anyio, FastAPI `TestClient` | Domain rules per service, API status codes and RBAC | fast | `app/backend/tests/` |
| Frontend unit | Vitest 5 + Testing Library + jsdom | `dates.ts`, `api.ts` error handling, small components | fastest | `app/frontend/src/**/*.test.ts(x)` |
| Static | `tsc` (TypeScript), `vite build` | Types match the API contract; the app builds | fast | `app/frontend` |

## 6.2 Playwright setup

### Layout
```
app/e2e/
  package.json            @playwright/test 1.63.0, typescript
  playwright.config.ts
  fixtures.ts             auto DB reset, role logins, helpers
  global-setup.ts         logs in each seeded role once -> .auth/<role>.json
  tests/
    success-criteria.spec.ts
    auth.spec.ts  rbac.spec.ts  leave.spec.ts  cancel-leave.spec.ts  roster.spec.ts
    swaps.spec.ts  calendar.spec.ts  dashboard.spec.ts  admin-users.spec.ts
    admin-config.spec.ts  audit.spec.ts  notifications.spec.ts  mobile.spec.ts
```
The `@playwright/test` version is pinned to **1.63.0** to match the Chromium build already installed in the
development environment (`/opt/pw-browsers`); do not run `playwright install`.

### Configuration (`playwright.config.ts`)
| Setting | Value | Why |
|---|---|---|
| `webServer` | Build the frontend, then start uvicorn on port 8010 with `LSM_TEST_MODE=1`, `LSM_TODAY=2026-06-10`, `LSM_DB_PATH=<temp file>`, `LSM_JWT_SECRET=e2e-only-secret`; wait for `/api/health` | Tests hit the production-like single-port app |
| `baseURL` | `http://127.0.0.1:8010` | |
| `workers` / `fullyParallel` | `1` / `false` | One shared SQLite DB is reset before each test |
| `retries` | `0` | Flakes must be fixed, not hidden |
| `trace` / `screenshot` | `retain-on-failure` / `only-on-failure` | Debug failures with `npx playwright show-trace` |
| `reporter` | `list` + `html` (never auto-open) | |
| Projects | `chromium` (Desktop Chrome, 1280×800) runs everything; `mobile` (Chromium at Pixel 7 size) runs only tests tagged `@mobile` | Responsive layout checked without doubling run time |

Pinned date **2026-06-10 (a Wednesday)**: mid-year (no year-boundary surprises) and mid-week (weekday and weekend
cases both close by). Seed data is generated relative to this date.

### Test data: fresh seeded database per test
- Test-only endpoint **`POST /api/test/reset`**: wipes all tables and re-runs the demo seed for the pinned date.
  It is **registered only when `LSM_TEST_MODE=1`**; otherwise the route doesn't exist (404). It is listed in the
  API contract under the `test` tag.
- An auto fixture in `fixtures.ts` calls it **before every test**, so tests are independent and can run in any order.
- The seed is deterministic: same users, ids, passwords (`password123`), roster and leave every time, and
  `password_changed_at` is a fixed past timestamp so login tokens survive a reset.
- **Logins**: `global-setup.ts` signs in once per role and saves the cookie to `.auth/<role>.json`
  (storage state). Tests choose a role with `test.use({ storageState: ... })` or the `asRole(page, role)` helper.
  The auth tests themselves log in through the UI.

| Role key | Seeded user | Why this one |
|---|---|---|
| `hr` | Asha Rao (hr@example.com) | Only HR Admin |
| `manager` | Meera Iyer (Customer Support manager) | Team with 3 shifts × 7 days and a deliberate gap today |
| `employee` | Arjun Mehta (Customer Support) | Rostered this week; has balance |
| `employee2` | Priya Nair (Customer Support) | Has approved leave next week (for the swap-block case) |
| `manager2` | Rahul Verma (Network Operations manager) | Cross-team access checks |

### Writing tests
- **Selectors**: `getByRole`, `getByLabel`, `getByText` first (they also check accessibility). `data-testid` only for
  grid cells that have no accessible name: roster/calendar cells use `data-testid="cell-<shiftId>-<date>"`.
- **Assertions** use Playwright's auto-waiting `expect(...)`; no fixed sleeps.
- **Verify through the UI**, then optionally double-check state through the API (`request` fixture) when the UI
  can't show it, e.g. a ledger amount.
- Each test name states the behaviour, e.g. `employee cannot apply for leave that leaves Morning short`.
- Mobile-relevant tests carry the `@mobile` tag in the title.

## 6.3 E2E test catalogue
IDs are stable so the decision log and commits can refer to them.

### BRD success criteria — `success-criteria.spec.ts`
| ID | Test |
|---|---|
| E2E-01 | **Applying for leave reduces the employee's balance**: employee applies for 2 days of Annual Leave → "Available" drops by 2 (pending); manager approves → "Balance" and "Used" reflect −2. |
| E2E-02 | **A shift swap involving someone on approved leave is blocked**: employee proposes a swap with Priya's shift where Priya is on approved leave on one of the dates → error names Priya and "approved leave"; no swap is created. |
| E2E-03 | **Manager sees today's gaps and pending approvals in one view**: manager opens Dashboard → today's Customer Support Evening gap (1 of 2) and the seeded pending leave requests are both visible without navigating. |

### Feature journeys
| Spec | IDs | Scenarios |
|---|---|---|
| `auth` | E2E-10…13 | Login success per role lands on the right home; wrong password shows an error; logout returns to login; deactivated user can't log in. |
| `rbac` | E2E-15…18 | Nav shows only the role's pages; employee opening `/admin/users` or `/roster` by URL sees "not allowed"; manager can't open another team's roster; manager's own leave appears in HR's approvals, not their own. |
| `leave` | E2E-20…27 | Live preview shows Mon–Fri day count and remaining balance; weekend-only range rejected; past date rejected; insufficient balance rejected; overlap rejected; **coverage block** names the shift and date; reject requires a comment and the employee sees it; approval removes the employee from shifts in that period (visible in My Shifts and roster). |
| `cancel-leave` | E2E-30…33 | Withdraw pending leave; cancel approved leave → shifts restored and days refunded; a shift that can't be restored leaves an "owed" day shown on the request; rostering the person that day refunds it. |
| `roster` | E2E-40…45 | Assign and remove a person; cell shows headcount vs minimum with a gap marker; can't assign someone on leave (message); can't double-book overlapping shifts; past dates are read-only; copy previous week reports copied/skipped. |
| `swaps` | E2E-50…54 | Full flow: propose → teammate accepts → manager approves → both see swapped shifts; teammate declines; requester cancels; manager party → HR approves; swap blocked when someone has pending leave on either date. |
| `calendar` | E2E-60…62 | Month view shows approved (solid) and pending (outlined) leave and shift coverage; gap days marked; team and person filters; employee can't pick another team. |
| `dashboard` | E2E-65…67 | Inline approve and reject from the dashboard update the lists; availability shows on shift / on leave / off; next-7-days gaps listed. |
| `admin-users` | E2E-70…74 | HR creates a user who can log in and sees an accrued balance; edit role/team; deactivate → disappears from rosters and pickers and their future shifts are released; can't deactivate self; password reset logs the user out. |
| `admin-config` | E2E-75…79 | Create team and assign manager; create/archive leave type; manager creates a shift template for their own team (not others); archive shift removes future assignments; HR runs monthly accrual and adjusts a balance with a reason. |
| `audit` | E2E-80…81 | Actions from other tests' flows appear with actor, action and before/after; manager sees only their team's entries. |
| `notifications` | E2E-85…86 | Bell count increases after a leave request; opening and "mark all read" clear it; links navigate to the right page. |
| `mobile` | E2E-90…92 `@mobile` | Login, apply for leave and view the dashboard at phone width without horizontal scrolling. |

## 6.4 pytest catalogue (backend rules)
Fixtures: fresh temporary DB per test, pinned date, small hand-built org (1 HR, 1 team with a manager and three
employees, one leave type, one shift). The three BRD criteria are also asserted at API level.

| Area | Must cover |
|---|---|
| Accrual (C5) | 12 monthly credits sum exactly to the entitlement (incl. 20, 7.5); idempotent monthly and year-end runs; carry-forward capped, rest lapses; accrual starts in the join month; HR Admins get no balance; adjustment needs a reason. |
| Leave (C6) | Mon–Fri counting; past / cross-year / weekend-only rejected; overlap; available = balance − pending; coverage block counts others' pending leave; team without manager blocked; routing employee→manager, manager→HR; approve re-checks balance and coverage; removed shifts recorded; reject needs comment. |
| Cancellation (C6) | Pending withdraw; approved only before start; restore when valid, `not_restored` otherwise; per-day refund vs owed; owed day refunded on re-assignment (incl. via swap); owed → forfeited after the date. |
| Roster (C7) | Each guard in `assignment_problem` (leave, overlap incl. overnight, wrong team, inactive, day not scheduled, duplicate); past dates read-only; copy week skip reasons; gap alert to manager unless self-caused. |
| Swaps (C8) | Each `validate` rule at propose, accept and approve; stale snapshot; started shift; manager party → HR; auto-cancel on unassignment. |
| Coverage (C9) | Headcount excludes approved and pending leave and inactive users; overnight intervals; grid includes unscheduled days only when assigned. |
| Org admin (C2) | Soft delete side effects; last HR Admin protection; no self role change; manager-team moves; password reset invalidates old tokens. |
| Auth (C1) | Expired / tampered JWT → 401; inactive user → 401; role taken from DB not token; RBAC per endpoint. |
| Audit (C11) | Every write path adds a row; UPDATE/DELETE on `audit_log` raise; no password hashes in snapshots. |

## 6.5 Vitest catalogue (frontend units)
`dates.ts` (week start, month ends, Mon–Fri count, add days across month/year), `api.ts` (maps
`{detail, code, details}` to `ApiError`; handles FastAPI 422 arrays), `StatusBadge` (text label for every status).

## 6.6 Running the tests
```bash
app/scripts/test-all.sh          # everything, in order, stops at first failure:
                                 # pytest -> tsc -> vitest -> vite build -> playwright
cd app/backend && .venv/bin/pytest -q
cd app/frontend && npm run typecheck && npm test
cd app/e2e && npx playwright test                 # all E2E (builds the frontend, starts the server)
cd app/e2e && npx playwright test tests/swaps.spec.ts --headed
cd app/e2e && npx playwright show-report          # HTML report; traces for failures
```

## 6.7 Definition of done (per feature)
A feature is done when, in the same commit set:
1. pytest covers its rules (happy path + every rejection rule in the LLD);
2. at least one Playwright journey covers it end-to-end, plus its main blocked path;
3. `app/scripts/test-all.sh` passes locally;
4. the [decision log](decision-log.md) has an entry for any choice made while building it.
