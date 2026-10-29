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
  scripts/          test-all.sh and other dev scripts               (not created yet)
```
