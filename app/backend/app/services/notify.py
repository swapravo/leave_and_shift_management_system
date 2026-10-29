"""C12 Notifications: in-app inbox, written in the same transaction as the event."""

from typing import Iterable

import aiosqlite

from .. import clock, db
from ..auth import Ctx
from ..errors import NotFound

KINDS = ("approval", "leave", "swap", "roster", "coverage")


async def notify(conn: aiosqlite.Connection, user_ids: Iterable[int | None], kind: str, message: str, link: str) -> None:
    assert kind in KINDS, kind
    now = clock.now_iso()
    for user_id in dict.fromkeys(u for u in user_ids if u is not None):
        await db.execute(
            conn,
            "INSERT INTO notifications (user_id, kind, message, link, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, kind, message, link, now),
        )


async def list_mine(ctx: Ctx, unread_only: bool) -> dict:
    rows = await db.fetch_all(
        ctx.conn,
        f"""SELECT id, kind, message, link, read, created_at FROM notifications
             WHERE user_id = ? {"AND read = 0" if unread_only else ""}
             ORDER BY id DESC LIMIT 50""",
        (ctx.user["id"],),
    )
    unread = await db.fetch_value(
        ctx.conn, "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0", (ctx.user["id"],)
    )
    for r in rows:
        r["read"] = bool(r["read"])
    return {"notifications": rows, "unread": unread}


async def mark_read(ctx: Ctx, notification_id: int) -> None:
    n = await db.changes(
        ctx.conn, "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", (notification_id, ctx.user["id"])
    )
    if n == 0:
        raise NotFound("Notification not found")


async def mark_all_read(ctx: Ctx) -> None:
    await db.execute(ctx.conn, "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", (ctx.user["id"],))
