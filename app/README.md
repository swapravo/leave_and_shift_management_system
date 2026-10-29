# app/ — source code

All source code for the Leave & Shift Management System lives here. The design it implements is in
[`docs/`](../docs/README.md); if code and docs disagree, fix one of them deliberately.

```
app/
  backend/          Python 3.13 + FastAPI (async) + aiosqlite
    app/            the Python package (`uvicorn app.main:create_app --factory`, run from app/backend)
      schema.sql    SQLite schema: every table, index and the audit-log triggers
  frontend/         React + TypeScript + Vite            (not created yet)
  e2e/              Playwright end-to-end tests            (not created yet)
  scripts/          test-all.sh and other dev scripts      (not created yet)
```

Only the schema exists so far. Folders are added as each build step starts.
