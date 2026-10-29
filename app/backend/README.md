# Backend — FastAPI + aiosqlite

Implements the components in [`docs/02-low-level-design.md`](../../docs/02-low-level-design.md) against the
contract in [`docs/openapi.yaml`](../../docs/openapi.yaml).

```bash
cd app/backend
python3.13 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m app.seed --reset                    # demo data (password123 for everyone)
.venv/bin/uvicorn app.main:create_app --factory --reload --port 8000
.venv/bin/pytest -q                                     # backend rule and API tests
```

Pin the date for a demo with `LSM_TODAY=2026-06-10` (on both the seed and the server). Other settings:
[TRD 3.7](../../docs/03-technical-requirements.md#37-configuration-environment-variables).

| Path | What |
|---|---|
| `app/main.py` | App factory, startup (schema, housekeeping, accrual catch-up), JSON-only writes, serves `frontend/dist` |
| `app/routers.py` | Every HTTP route: parse, call one service, return |
| `app/schemas.py` | Request bodies (types only; rules are checked in services → 400) |
| `app/auth.py` | bcrypt, JWT cookie, the per-request context (`ReadCtx`/`WriteCtx`: one connection + the user) |
| `app/db.py`, `app/schema.sql` | Connections, transactions (`BEGIN IMMEDIATE` for writes), schema |
| `app/clock.py`, `app/errors.py`, `app/config.py` | IST clock, error shape, environment |
| `app/seed.py` | Deterministic demo data and the test-only reset |
| `app/services/` | C2–C12: `org`, `leave_types`, `shift_templates`, `accrual`, `leave`, `roster`, `swaps`, `coverage`, `views`, `audit`, `notify` |
| `tests/` | pytest: one file per area, fresh database per test, today pinned to Wed 2026-06-10 |

Demo logins (seed): `hr@example.com` (HR Admin), `meera@example.com` (Customer Support manager),
`arjun@example.com`, `priya@example.com` (employees), `rahul@example.com` (Network Operations manager).
