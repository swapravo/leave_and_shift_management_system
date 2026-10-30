---
type: community
members: 53
---

# Community 17

**Members:** 53 nodes

## Members
- [[dot-__init__()]] - code - backend/app/errors.py
- [[C1 Identity & Access password hashing, JWT cookie, the per-request context and…]] - rationale - backend/app/auth.py
- [[C12 Notifications in-app inbox, written in the same transaction as the event.]] - rationale - backend/app/services/notify.py
- [[Connection_5]] - code
- [[Connection_6]] - code
- [[Create the schema (idempotent), bring an older database up to date, and switch…]] - rationale - backend/app/db.py
- [[DomainError]] - code - backend/app/errors.py
- [[Exception]] - code
- [[P1 DB layer aiosqlite connections, one transaction per request, small query…]] - rationale - backend/app/db.py
- [[P2 Clock the only source of today and now (IST). Nothing else calls…]] - rationale - backend/app/clock.py
- [[P3 Errors domain exceptions rendered as {detail, code, details} (LLD…]] - rationale - backend/app/errors.py
- [[Request]] - code
- [[Response]] - code
- [[Response_1]] - code
- [[Run a write; returns the number of rows changed.]] - rationale - backend/app/db.py
- [[Schema 1 - 2 (birthday leave) for a database created before it. A no-op on a…]] - rationale - backend/app/db.py
- [[The real wall clock, never pinned. Used for security timestamps (token iat,…]] - rationale - backend/app/clock.py
- [[Unauthorized]] - code - backend/app/errors.py
- [[_read_ctx()]] - code - backend/app/auth.py
- [[_write_conn()]] - code - backend/app/auth.py
- [[_write_ctx()]] - code - backend/app/auth.py
- [[aiosqlite]] - concept
- [[anyio]] - concept
- [[auth.py]] - code - backend/app/auth.py
- [[changes()]] - code - backend/app/db.py
- [[check()]] - code - backend/app/auth.py
- [[clear_cookie()]] - code - backend/app/auth.py
- [[clock.py]] - code - backend/app/clock.py
- [[connect()]] - code - backend/app/db.py
- [[datetime_1]] - code
- [[db.py]] - code - backend/app/db.py
- [[errors.py]] - code - backend/app/errors.py
- [[fastapi_2]] - concept
- [[hash_password_sync()]] - code - backend/app/auth.py
- [[init_db()]] - code - backend/app/db.py
- [[issue_token()]] - code - backend/app/auth.py
- [[load_user()]] - code - backend/app/auth.py
- [[login()_1]] - code - backend/app/routers.py
- [[mark_all_read()]] - code - backend/app/services/notify.py
- [[mark_read()]] - code - backend/app/services/notify.py
- [[me()]] - code - backend/app/auth.py
- [[notify.py]] - code - backend/app/services/notify.py
- [[now()]] - code - backend/app/clock.py
- [[re]] - concept
- [[real_now()]] - code - backend/app/clock.py
- [[set_cookie()]] - code - backend/app/auth.py
- [[starlette_exceptions]] - concept
- [[transaction()]] - code - backend/app/db.py
- [[typing]] - concept
- [[upgrade()]] - code - backend/app/db.py
- [[user_from_token()]] - code - backend/app/auth.py
- [[verify_password()]] - code - backend/app/auth.py
- [[zoneinfo]] - concept

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Community_17
SORT file.name ASC
```

## Connections to other communities
- 25 edges to [[_COMMUNITY_Community 10]]
- 18 edges to [[_COMMUNITY_Community 0]]
- 18 edges to [[_COMMUNITY_Community 2]]
- 15 edges to [[_COMMUNITY_Community 14]]
- 14 edges to [[_COMMUNITY_Community 9]]
- 14 edges to [[_COMMUNITY_Community 8]]
- 12 edges to [[_COMMUNITY_Community 11]]
- 10 edges to [[_COMMUNITY_Community 7]]
- 10 edges to [[_COMMUNITY_Community 24]]
- 8 edges to [[_COMMUNITY_Community 26]]
- 6 edges to [[_COMMUNITY_Community 15]]
- 4 edges to [[_COMMUNITY_Community 4]]
- 2 edges to [[_COMMUNITY_Community 31]]
- 1 edge to [[_COMMUNITY_Community 3]]
- 1 edge to [[_COMMUNITY_Community 16]]
- 1 edge to [[_COMMUNITY_Community 25]]

## Top bridge nodes
- [[clock.py]] - degree 29, connects to 15 communities
- [[db.py]] - degree 37, connects to 13 communities
- [[auth.py]] - degree 43, connects to 12 communities
- [[errors.py]] - degree 25, connects to 10 communities
- [[aiosqlite]] - degree 13, connects to 8 communities