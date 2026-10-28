# 3. Technical Requirements

## 3.1 Stack
| Layer | Choice | Version (pinned) |
|---|---|---|
| Language (backend) | Python | 3.13 |
| Web framework | FastAPI | 0.162.0 |
| ASGI server | uvicorn | 0.54.0 |
| Validation / schemas | Pydantic v2 (via FastAPI) | 2.14.x |
| Database | SQLite 3 (single file) | bundled with Python |
| DB driver | aiosqlite (async wrapper over stdlib `sqlite3`) | 0.22.1 |
| Auth tokens | PyJWT, HS256 | 2.15.1 |
| Password hashing | bcrypt | 5.0.0 |
| Time zones | stdlib `zoneinfo` + `tzdata` | 2026.5 |
| Backend tests | pytest + anyio plugin, FastAPI `TestClient` (httpx2) | pytest 9.1.1 |
| Language (frontend) | TypeScript | 5.9.3 |
| UI library | React | 19.3.1 |
| Routing | React Router | 7.18.x |
| Build tool / dev server | Vite (+ @vitejs/plugin-react) | 8.3.5 |
| Frontend tests | Vitest + Testing Library + jsdom | vitest 5.0.5 |
| Styling | Plain CSS with design tokens (CSS variables); no UI framework | — |
| Runtime (frontend tooling) | Node.js | 22.x |

No ORM: SQL is written by hand in the service layer (schema in `schema.sql`).

## 3.2 Database
- One SQLite file (default `app/backend/data/app.db`, override with `LSM_DB_PATH`).
- Per connection: `PRAGMA foreign_keys = ON`, `PRAGMA busy_timeout = 5000`.
  Once per database: `PRAGMA journal_mode = WAL` (readers don't block the writer).
- Schema created from `schema.sql` at startup (`CREATE TABLE IF NOT EXISTS`). No migration tool in v1; a
  `schema_version` row allows adding one later.
- **One connection and one transaction per request.** Read-only requests use a deferred transaction; requests that
  write start with `BEGIN IMMEDIATE` so the write lock is taken before any check runs (prevents two approvals
  passing the same coverage check). Commit happens **before** the response is sent; any exception rolls back.
- Dates stored as ISO text `YYYY-MM-DD` (IST calendar dates); timestamps as ISO-8601 with `+05:30` offset; money-like
  quantities (leave days) as `REAL` rounded to 2 decimals in code.
- Audit log immutability enforced by triggers (UPDATE/DELETE abort).

## 3.3 Sync vs async
| Piece | Model | Why |
|---|---|---|
| Endpoints | `async def` | Chosen in planning; consistent end-to-end async. |
| DB access | `await` via aiosqlite | aiosqlite runs sqlite3 on a dedicated thread per connection, so the event loop is never blocked by disk I/O. |
| Services | `async def`, take the request's connection as the first argument | Keeps the whole request in one transaction. |
| bcrypt hash/verify | Run in a worker thread (`anyio.to_thread.run_sync`) | bcrypt is CPU-heavy (~250 ms) and would block the event loop. |
| JWT encode/decode | Plain sync calls | Microseconds; no need to offload. |
| Background jobs | None | Accrual catch-up and housekeeping run at startup (lifespan) and lazily before the checks that need them. |

Rule: **no blocking call inside an `async def`** (no stdlib `sqlite3`, no `time.sleep`, no sync bcrypt).

## 3.4 Authentication & authorisation
- `POST /api/auth/login` verifies email + bcrypt password, issues a JWT: `sub` (user id), `iat`, `exp` (+8 h).
- Token set as cookie `lsm_token`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `LSM_COOKIE_SECURE=1`.
- Every protected request: verify signature/expiry → load user by id → reject if inactive or if
  `iat < password_changed_at` → use the **DB's** role and team.
- CSRF: SameSite=Lax cookie + JSON-only request bodies (`Content-Type: application/json` required for writes).
- Authorisation is enforced in services (role + ownership, e.g. "manager of this team"), not only in routers/UI.
- Logout clears the cookie. No refresh tokens.

## 3.5 API conventions
- Base path `/api`; JSON only; contract in [openapi.yaml](openapi.yaml).
- Errors: `{"detail": str, "code": str, "details": [...]}`. Status codes: 400 rule/validation failure, 401 not signed
  in, 403 not allowed, 404 not found, 409 conflict with current state (coverage, balance, overlap, stale request),
  422 malformed body (FastAPI schema validation).
- IDs are integers. Dates `YYYY-MM-DD`, times `HH:MM` (24 h).
- Lists are small and unpaginated except the audit log (`limit`/`offset`).

## 3.6 Frontend
- Single-page app; React Router routes per page; role-based navigation.
- One API client module (`fetch`, `credentials: "same-origin"`), types hand-written to mirror `openapi.yaml`.
- "Today" for the UI comes from `GET /api/auth/me` (server's IST date), never the browser clock.
- Light and dark theme via CSS variables; layout usable down to 360 px wide.

## 3.7 Configuration (environment variables)
| Variable | Default | Purpose |
|---|---|---|
| `LSM_DB_PATH` | `app/backend/data/app.db` | SQLite file |
| `LSM_JWT_SECRET` | *(required in prod; dev generates one per run and warns)* | HS256 signing key |
| `LSM_JWT_HOURS` | `8` | Token lifetime |
| `LSM_COOKIE_SECURE` | `0` | Set `1` behind HTTPS |
| `LSM_TODAY` | *(unset)* | Pin "today" for demos (`YYYY-MM-DD`) |

## 3.8 Testing & quality gates
- Backend: pytest. Service-level tests (async, via anyio) and API tests via `TestClient`. Each test gets a fresh
  temporary DB and a pinned "today". The three BRD success criteria are named tests.
- Frontend: Vitest for date helpers and key components; `tsc` type check.
- End-to-end smoke: Playwright (pre-installed Chromium) against the seeded app.
- Must pass before every push: `pytest`, `npm run typecheck`, `npm test`, `npm run build`.

## 3.9 Run commands (target)
```bash
# backend
cd app/backend && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m app.seed --reset            # demo data
.venv/bin/uvicorn app.main:create_app --factory --reload --port 8000
# frontend (dev)
cd app/frontend && npm install && npm run dev   # http://localhost:5173
# single-port demo
npm run build && (cd ../backend && .venv/bin/uvicorn app.main:create_app --factory --port 8000)
```
