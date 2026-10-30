---
type: community
members: 37
---

# Community 17

**Members:** 37 nodes

## Members
- [[Any]] - code
- [[C11 Audit Log append-only record of every change, written in the same…]] - rationale - backend/app/services/audit.py
- [[C12 Notifications in-app inbox, written in the same transaction as the event.]] - rationale - backend/app/services/notify.py
- [[C6 Birthday leave a bonus day of Casual Leave, booked automatically on the…]] - rationale - backend/app/services/birthday.py
- [[Connection_6]] - code
- [[Connection_7]] - code
- [[Grant every birthday leave that is due and not yet granted. Idempotent; returns…]] - rationale - backend/app/services/birthday.py
- [[Leave & Shift Management System backend.]] - rationale - backend/app/__init__.py
- [[P1 DB layer aiosqlite connections, one transaction per request, small query…]] - rationale - backend/app/db.py
- [[Run a write; returns the number of rows changed.]] - rationale - backend/app/db.py
- [[Schema 1 - 2 (birthday leave) for a database created before it. A no-op on a…]] - rationale - backend/app/db.py
- [[_clean()]] - code - backend/app/services/audit.py
- [[_dump()]] - code - backend/app/services/audit.py
- [[_grant()]] - code - backend/app/services/birthday.py
- [[_leave_type()]] - code - backend/app/services/birthday.py
- [[aiosqlite]] - concept
- [[app__init__.py]] - code - backend/app/__init__.py
- [[audit.py]] - code - backend/app/services/audit.py
- [[birthday.py]] - code - backend/app/services/birthday.py
- [[changes()]] - code - backend/app/db.py
- [[date_5]] - code
- [[datetime_2]] - concept
- [[db.py]] - code - backend/app/db.py
- [[fetch_all()]] - code - backend/app/db.py
- [[fetch_one()]] - code - backend/app/db.py
- [[fetch_value()]] - code - backend/app/db.py
- [[hr_admin_ids()]] - code - backend/app/services/common.py
- [[json]] - concept
- [[list_entries()]] - code - backend/app/services/audit.py
- [[list_mine()]] - code - backend/app/services/notify.py
- [[mark_all_read()]] - code - backend/app/services/notify.py
- [[mark_read()]] - code - backend/app/services/notify.py
- [[notify.py]] - code - backend/app/services/notify.py
- [[re]] - concept
- [[run()]] - code - backend/app/services/birthday.py
- [[typing]] - concept
- [[upgrade()]] - code - backend/app/db.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Community_17
SORT file.name ASC
```

## Connections to other communities
- 47 edges to [[_COMMUNITY_Community 2]]
- 30 edges to [[_COMMUNITY_Community 11]]
- 24 edges to [[_COMMUNITY_Community 10]]
- 22 edges to [[_COMMUNITY_Community 0]]
- 20 edges to [[_COMMUNITY_Community 7]]
- 14 edges to [[_COMMUNITY_Community 9]]
- 10 edges to [[_COMMUNITY_Community 29]]
- 9 edges to [[_COMMUNITY_Community 8]]
- 9 edges to [[_COMMUNITY_Community 15]]
- 8 edges to [[_COMMUNITY_Community 28]]
- 6 edges to [[_COMMUNITY_Community 24]]
- 5 edges to [[_COMMUNITY_Community 14]]
- 4 edges to [[_COMMUNITY_Community 31]]
- 3 edges to [[_COMMUNITY_Community 40]]
- 2 edges to [[_COMMUNITY_Community 26]]
- 2 edges to [[_COMMUNITY_Community 16]]
- 2 edges to [[_COMMUNITY_Community 25]]
- 1 edge to [[_COMMUNITY_Community 13]]

## Top bridge nodes
- [[db.py]] - degree 38, connects to 14 communities
- [[app__init__.py]] - degree 21, connects to 13 communities
- [[datetime_2]] - degree 17, connects to 12 communities
- [[audit.py]] - degree 26, connects to 9 communities
- [[fetch_all()]] - degree 42, connects to 8 communities