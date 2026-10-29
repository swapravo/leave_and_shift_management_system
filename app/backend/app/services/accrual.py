"""C5 Accrual & Balances: ledger-based balances, monthly accrual, year-end carry-forward, manual adjustments.

A balance is never stored: it is the sum of the user's ledger rows for that leave type and year.
Only active employees and managers accrue; HR Admins have no balances.
"""

from decimal import ROUND_HALF_UP, Decimal

import aiosqlite

from .. import clock, db
from ..auth import Ctx, require_roles
from ..errors import Forbidden, NotFound, ValidationFailed
from . import audit
from .common import get_user, r2

ELIGIBLE_ROLES = ("employee", "manager")


def monthly_credit(entitlement: float, month: int) -> float:
    """round(E*m/12, 2) - round(E*(m-1)/12, 2): twelve credits always add up exactly to E."""
    e = Decimal(str(entitlement))

    def cumulative(m: int) -> Decimal:
        return (e * m / 12).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return float(cumulative(month) - cumulative(month - 1))


async def run_monthly(
    conn: aiosqlite.Connection,
    year: int,
    month: int,
    user_id: int | None = None,
    actor: dict | None = None,
    audited: bool = True,
) -> int:
    """Credit one month for every eligible user and active leave type. Idempotent; returns rows created.

    Never credits a user whose year is already closed, or a month before their join month.
    """
    period = f"{year:04d}-{month:02d}"
    types = await db.fetch_all(conn, "SELECT id, annual_entitlement FROM leave_types WHERE active = 1 ORDER BY id")
    now = clock.now_iso()
    created = 0
    for t in types:
        amount = monthly_credit(t["annual_entitlement"], month)
        if amount == 0:
            continue
        created += await db.changes(
            conn,
            """INSERT OR IGNORE INTO balance_ledger
                      (user_id, leave_type_id, year, kind, amount, period, reason, created_by, created_at)
               SELECT u.id, ?, ?, 'accrual', ?, ?, 'Monthly accrual', NULL, ?
                 FROM users u
                WHERE u.active = 1 AND u.role IN ('employee', 'manager')
                  AND substr(u.join_date, 1, 7) <= ?
                  AND (? IS NULL OR u.id = ?)
                  AND NOT EXISTS (SELECT 1 FROM balance_ledger c
                                   WHERE c.user_id = u.id AND c.kind = 'year_end_close' AND c.period = ?)""",
            (t["id"], year, amount, period, now, period, user_id, user_id, str(year)),
        )
    if audited and user_id is None and (created or actor):
        await audit.record(conn, actor, "accrual.monthly", "accrual", None, after={"period": period, "entries_created": created})
    return created


async def run_year_end(
    conn: aiosqlite.Connection, closing_year: int, actor: dict | None = None, audited: bool = True
) -> int:
    """Close a year: carry each balance forward up to the type's cap, the rest lapses. Idempotent."""
    pairs = await db.fetch_all(
        conn,
        """SELECT l.user_id, l.leave_type_id, SUM(l.amount) AS balance, t.carry_forward_cap AS cap
             FROM balance_ledger l JOIN leave_types t ON t.id = l.leave_type_id
            WHERE l.year = ?
              AND NOT EXISTS (SELECT 1 FROM balance_ledger c
                               WHERE c.user_id = l.user_id AND c.leave_type_id = l.leave_type_id
                                 AND c.kind = 'year_end_close' AND c.period = ?)
            GROUP BY l.user_id, l.leave_type_id
            ORDER BY l.user_id, l.leave_type_id""",
        (closing_year, str(closing_year)),
    )
    now = clock.now_iso()
    for p in pairs:
        balance = r2(p["balance"])
        positive = max(balance, 0.0)
        carry = r2(min(positive, p["cap"]))
        await db.execute(
            conn,
            """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, period, reason, created_at)
               VALUES (?, ?, ?, 'year_end_close', ?, ?, ?, ?)""",
            (p["user_id"], p["leave_type_id"], closing_year, -positive, str(closing_year),
             f"Year-end close: {r2(positive - carry)} lapsed", now),
        )
        await db.execute(
            conn,
            """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, period, reason, created_at)
               VALUES (?, ?, ?, 'carry_forward', ?, ?, ?, ?)""",
            (p["user_id"], p["leave_type_id"], closing_year + 1, carry, str(closing_year),
             f"Carried forward from {closing_year}", now),
        )
    if audited and (pairs or actor):
        await audit.record(conn, actor, "accrual.year_end", "accrual", None,
                           after={"closing_year": closing_year, "balances_closed": len(pairs)})
    return len(pairs)


async def catch_up(conn: aiosqlite.Connection, user_id: int | None = None, audited: bool = True) -> None:
    """Bring accrual up to date: finish and close last year if it has movements, then this year to date."""
    today = clock.today()
    last = today.year - 1
    if await db.fetch_value(conn, "SELECT 1 FROM balance_ledger WHERE year = ? LIMIT 1", (last,)):
        for month in range(1, 13):
            await run_monthly(conn, last, month, user_id, audited=audited)
        await run_year_end(conn, last, audited=audited)
    for month in range(1, today.month + 1):
        await run_monthly(conn, today.year, month, user_id, audited=audited)


# --------------------------------------------------------------------------------------------------- balances
async def _visible_user(ctx: Ctx, user_id: int | None) -> dict:
    target = await get_user(ctx.conn, user_id or ctx.user["id"])
    if target is None:
        raise NotFound("User not found")
    if not (
        ctx.is_hr
        or target["id"] == ctx.user["id"]
        or (ctx.user["managed_team_id"] is not None and target["team_id"] == ctx.user["managed_team_id"])
    ):
        raise Forbidden("You can only see your own balances or your team's")
    return target


async def balances_for(conn: aiosqlite.Connection, user: dict, year: int) -> list[dict]:
    if user["role"] not in ELIGIBLE_ROLES:
        return []
    sums = await db.fetch_all(
        conn,
        """SELECT leave_type_id,
                  SUM(amount) AS balance,
                  SUM(CASE WHEN kind = 'accrual' THEN amount ELSE 0 END) AS accrued,
                  SUM(CASE WHEN kind = 'carry_forward' THEN amount ELSE 0 END) AS carried_forward,
                  SUM(CASE WHEN kind = 'adjustment' THEN amount ELSE 0 END) AS adjustments,
                  SUM(CASE WHEN kind IN ('leave_taken', 'leave_refund') THEN amount ELSE 0 END) AS taken
             FROM balance_ledger WHERE user_id = ? AND year = ? GROUP BY leave_type_id""",
        (user["id"], year),
    )
    pending = await db.fetch_all(
        conn,
        """SELECT leave_type_id, SUM(days) AS days FROM leave_requests
            WHERE user_id = ? AND status = 'pending' AND substr(start_date, 1, 4) = ? GROUP BY leave_type_id""",
        (user["id"], str(year)),
    )
    by_type = {s["leave_type_id"]: s for s in sums}
    pending_by_type = {p["leave_type_id"]: p["days"] for p in pending}
    types = await db.fetch_all(conn, "SELECT * FROM leave_types ORDER BY name")
    out = []
    for t in types:
        s = by_type.get(t["id"])
        if not t["active"] and s is None and t["id"] not in pending_by_type:
            continue  # archived types are only listed when they had movements that year
        balance = r2(s["balance"]) if s else 0.0
        pend = r2(pending_by_type.get(t["id"], 0))
        out.append(
            {
                "leave_type_id": t["id"],
                "leave_type": t["name"],
                "active": bool(t["active"]),
                "year": year,
                "annual_entitlement": t["annual_entitlement"],
                "carry_forward_cap": t["carry_forward_cap"],
                "accrued": r2(s["accrued"]) if s else 0.0,
                "carried_forward": r2(s["carried_forward"]) if s else 0.0,
                "adjustments": r2(s["adjustments"]) if s else 0.0,
                "used": r2(-s["taken"]) if s else 0.0,
                "balance": balance,
                "pending": pend,
                "available": r2(balance - pend),
            }
        )
    return out


async def available(conn: aiosqlite.Connection, user_id: int, leave_type_id: int, year: int) -> float:
    """balance - pending for one type and year (what a new request may use)."""
    balance = await db.fetch_value(
        conn,
        "SELECT COALESCE(SUM(amount), 0) FROM balance_ledger WHERE user_id = ? AND leave_type_id = ? AND year = ?",
        (user_id, leave_type_id, year),
    )
    pending = await db.fetch_value(
        conn,
        """SELECT COALESCE(SUM(days), 0) FROM leave_requests
            WHERE user_id = ? AND leave_type_id = ? AND status = 'pending' AND substr(start_date, 1, 4) = ?""",
        (user_id, leave_type_id, str(year)),
    )
    return r2(balance - pending)


async def get_balances(ctx: Ctx, user_id: int | None, year: int | None) -> list[dict]:
    target = await _visible_user(ctx, user_id)
    return await balances_for(ctx.conn, target, year or clock.today().year)


async def get_ledger(ctx: Ctx, user_id: int | None, year: int | None) -> list[dict]:
    target = await _visible_user(ctx, user_id)
    rows = await db.fetch_all(
        ctx.conn,
        """SELECT l.id, l.leave_type_id, t.name AS leave_type, l.year, l.kind, l.amount, l.period,
                  l.leave_request_id, l.reason, u.name AS created_by_name, l.created_at
             FROM balance_ledger l JOIN leave_types t ON t.id = l.leave_type_id
             LEFT JOIN users u ON u.id = l.created_by
            WHERE l.user_id = ? AND l.year = ?
            ORDER BY l.id""",
        (target["id"], year or clock.today().year),
    )
    for r in rows:
        r["amount"] = r2(r["amount"])
    return rows


async def adjust(ctx: Ctx, user_id: int, leave_type_id: int, amount: float, reason: str, year: int | None) -> list[dict]:
    require_roles(ctx.user, "hr_admin")
    target = await get_user(ctx.conn, user_id)
    if target is None:
        raise NotFound("User not found")
    if target["role"] not in ELIGIBLE_ROLES:
        raise ValidationFailed("HR Admins don't have leave balances")
    if not target["active"]:
        raise ValidationFailed("This user is deactivated")
    lt = await db.fetch_one(ctx.conn, "SELECT * FROM leave_types WHERE id = ?", (leave_type_id,))
    if lt is None:
        raise NotFound("Leave type not found")
    amount = r2(amount)
    if amount == 0:
        raise ValidationFailed("The adjustment can't be zero")
    if not reason.strip():
        raise ValidationFailed("A reason is required")
    year = year or clock.today().year
    entry_id = await db.execute(
        ctx.conn,
        """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, reason, created_by, created_at)
           VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?)""",
        (target["id"], leave_type_id, year, amount, reason.strip(), ctx.user["id"], clock.now_iso()),
    )
    await audit.record(
        ctx.conn, ctx.user, "balance.adjust", "balance_ledger", entry_id,
        after={"user_id": target["id"], "leave_type": lt["name"], "year": year, "amount": amount, "reason": reason.strip()},
        team_id=target["team_id"],
    )
    return await balances_for(ctx.conn, target, year)


async def run_monthly_manual(ctx: Ctx, year: int, month: int) -> int:
    require_roles(ctx.user, "hr_admin")
    today = clock.today()
    if not 1 <= month <= 12:
        raise ValidationFailed("Month must be 1-12")
    if (year, month) > (today.year, today.month):
        raise ValidationFailed("You can't run accrual for a future month")
    return await run_monthly(ctx.conn, year, month, actor=ctx.user)


async def run_year_end_manual(ctx: Ctx, closing_year: int) -> int:
    require_roles(ctx.user, "hr_admin")
    if closing_year >= clock.today().year:
        raise ValidationFailed("Only a past year can be closed")
    # make sure the year is fully accrued before closing it
    for month in range(1, 13):
        await run_monthly(ctx.conn, closing_year, month, audited=False)
    return await run_year_end(ctx.conn, closing_year, actor=ctx.user)
