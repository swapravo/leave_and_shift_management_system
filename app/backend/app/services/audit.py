"""C11 Audit Log: append-only record of every change, written in the same transaction as the change."""

import json
from datetime import date

import aiosqlite

from .. import clock, db
from ..auth import Ctx, require_roles
from ..errors import ValidationFailed

_SECRET_KEYS = {"password_hash", "password"}


def _clean(value):
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items() if k not in _SECRET_KEYS}
    if isinstance(value, (list, tuple)):
        return [_clean(v) for v in value]
    return value


def _dump(value) -> str | None:
    if value is None:
        return None
    return json.dumps(_clean(value), default=str, sort_keys=True)


async def record(
    conn: aiosqlite.Connection,
    actor: dict | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    before: dict | None = None,
    after: dict | None = None,
    team_id: int | None = None,
) -> None:
    await db.execute(
        conn,
        """INSERT INTO audit_log (actor_id, actor_name, action, entity_type, entity_id, team_id,
                                  before_json, after_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            actor["id"] if actor else None,
            actor["name"] if actor else "System",
            action,
            entity_type,
            entity_id,
            team_id,
            _dump(before),
            _dump(after),
            clock.now_iso(),
        ),
    )


async def list_entries(
    ctx: Ctx,
    actor_id: int | None,
    entity_type: str | None,
    start: date | None,
    end: date | None,
    limit: int,
    offset: int,
) -> dict:
    require_roles(ctx.user, "hr_admin", "manager")
    if not 1 <= limit <= 500 or offset < 0:
        raise ValidationFailed("limit must be 1-500 and offset at least 0")
    where, params = [], []
    if not ctx.is_hr:
        where.append("team_id IS ?")
        params.append(ctx.user["managed_team_id"] or -1)
    if actor_id is not None:
        where.append("actor_id = ?")
        params.append(actor_id)
    if entity_type:
        where.append("entity_type = ?")
        params.append(entity_type)
    if start:
        where.append("substr(created_at, 1, 10) >= ?")
        params.append(start.isoformat())
    if end:
        where.append("substr(created_at, 1, 10) <= ?")
        params.append(end.isoformat())
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    total = await db.fetch_value(ctx.conn, f"SELECT COUNT(*) FROM audit_log {clause}", params)
    rows = await db.fetch_all(
        ctx.conn, f"SELECT * FROM audit_log {clause} ORDER BY id DESC LIMIT ? OFFSET ?", [*params, limit, offset]
    )
    entries = [
        {
            "id": r["id"],
            "actor_id": r["actor_id"],
            "actor_name": r["actor_name"],
            "action": r["action"],
            "entity_type": r["entity_type"],
            "entity_id": r["entity_id"],
            "team_id": r["team_id"],
            "before": json.loads(r["before_json"]) if r["before_json"] else None,
            "after": json.loads(r["after_json"]) if r["after_json"] else None,
            "created_at": r["created_at"],
        }
        for r in rows
    ]
    return {"entries": entries, "total": total}
