---
type: community
members: 15
---

# Community 28

**Members:** 15 nodes

## Members
- [[A database made before birthday leave gets the new column and the relaxed…]] - rationale - backend/tests/test_birthday.py
- [[Architecture 4.7 schema, WAL, housekeeping, accrual catch-up.]] - rationale - backend/app/main.py
- [[Birthdays keep arriving while the server stays up, so look again every hour…]] - rationale - backend/app/main.py
- [[Create the schema (idempotent), bring an older database up to date, and switch…]] - rationale - backend/app/db.py
- [[What the hourly housekeeping and startup do look at everyone, not just one…]] - rationale - backend/tests/test_birthday.py
- [[_housekeeping()]] - code - backend/app/main.py
- [[asyncio]] - concept
- [[connect()]] - code - backend/app/db.py
- [[go()]] - code - backend/tests/test_birthday.py
- [[init_db()]] - code - backend/app/db.py
- [[lifespan()]] - code - backend/app/main.py
- [[run_everyone()]] - code - backend/tests/test_birthday.py
- [[startup()]] - code - backend/app/main.py
- [[test_an_older_database_is_upgraded_in_place()]] - code - backend/tests/test_birthday.py
- [[upgrade()_1]] - code - backend/tests/test_birthday.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Community_28
SORT file.name ASC
```

## Connections to other communities
- 8 edges to [[_COMMUNITY_Community 17]]
- 7 edges to [[_COMMUNITY_Community 14]]
- 4 edges to [[_COMMUNITY_Community 24]]
- 3 edges to [[_COMMUNITY_Community 26]]
- 2 edges to [[_COMMUNITY_Community 0]]
- 1 edge to [[_COMMUNITY_Community 11]]
- 1 edge to [[_COMMUNITY_Community 7]]
- 1 edge to [[_COMMUNITY_Community 31]]
- 1 edge to [[_COMMUNITY_Community 15]]

## Top bridge nodes
- [[connect()]] - degree 10, connects to 4 communities
- [[startup()]] - degree 9, connects to 4 communities
- [[init_db()]] - degree 9, connects to 3 communities
- [[_housekeeping()]] - degree 6, connects to 3 communities
- [[asyncio]] - degree 6, connects to 3 communities