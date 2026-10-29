# app/ — source code

All source code for the Leave & Shift Management System lives here. The design it implements is in
[`docs/`](../docs/README.md); if code and docs disagree, fix one of them deliberately.

```
app/
  backend/          Python 3.13 + FastAPI (async) + aiosqlite      -> backend/README.md
    app/            the Python package (`uvicorn app.main:create_app --factory`, run from app/backend)
      schema.sql    SQLite schema: every table, index and the audit-log triggers
    tests/          pytest
  frontend/         React + TypeScript + Vite                      -> frontend/README.md
  e2e/              Playwright end-to-end tests                     (not created yet)
  scripts/          test-all.sh: every suite in order (run before every push)
```

Run the demo on one port (after installing both halves, see their READMEs):

```bash
cd app/frontend && npm run build
cd ../backend && LSM_TODAY=2026-06-10 .venv/bin/python -m app.seed --reset
LSM_TODAY=2026-06-10 .venv/bin/uvicorn app.main:create_app --factory --port 8000   # http://localhost:8000
```
