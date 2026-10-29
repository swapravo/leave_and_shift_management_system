"""C6 Leave Requests: apply (with the coverage hard block), approve/reject, cancel with re-roster + per-day refund.

Routing: an employee's leave goes to their team's manager; a manager's leave goes to any HR Admin.
"""

from collections import defaultdict
from datetime import date

import aiosqlite

from .. import clock, db
from ..auth import Ctx
from ..errors import Conflict, DomainError, Forbidden, NotFound, ValidationFailed
from . import accrual, audit, coverage
from .common import fmt_day, fmt_range, get_template, get_user, hr_admin_ids, r2, team_manager_id
from .notify import notify


def working_days(start: date, end: date) -> int:
    """Mon-Fri dates in [start, end]."""
    return sum(1 for d in clock.days(start, end) if d.weekday() < 5)


async def approvers(conn: aiosqlite.Connection, requester: dict) -> list[int]:
    if requester["role"] == "employee":
        manager_id = await team_manager_id(conn, requester["team_id"])
        return [manager_id] if manager_id is not None else []
    if requester["role"] == "manager":
        return await hr_admin_ids(conn)
    return []


async def _can_decide(conn: aiosqlite.Connection, actor: dict, requester: dict) -> bool:
    return actor["id"] != requester["id"] and actor["id"] in await approvers(conn, requester)


# --------------------------------------------------------------------------------------------------- output
_SELECT = """SELECT r.*, u.name AS user_name, u.team_id, u.role AS user_role, t.name AS leave_type,
                    d.name AS decided_by_name
               FROM leave_requests r JOIN users u ON u.id = r.user_id
               JOIN leave_types t ON t.id = r.leave_type_id
               LEFT JOIN users d ON d.id = r.decided_by"""


async def _requests(conn: aiosqlite.Connection, where: str, params: tuple | list = ()) -> list[dict]:
    return await db.fetch_all(conn, f"{_SELECT} WHERE {where}", params)


async def _out(conn: aiosqlite.Connection, actor: dict, row: dict) -> dict:
    today = clock.today().isoformat()
    requester = {"id": row["user_id"], "role": row["user_role"], "team_id": row["team_id"]}
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "user_name": row["user_name"],
        "team_id": row["team_id"],
        "leave_type_id": row["leave_type_id"],
        "leave_type": row["leave_type"],
        "start_date": row["start_date"],
        "end_date": row["end_date"],
        "days": r2(row["days"]),
        "reason": row["reason"],
        "status": row["status"],
        "decided_by_name": row["decided_by_name"],
        "decided_at": row["decided_at"],
        "decision_comment": row["decision_comment"],
        "cancelled_at": row["cancelled_at"],
        "created_at": row["created_at"],
        "can_cancel": actor["id"] == row["user_id"]
        and (row["status"] == "pending" or (row["status"] == "approved" and row["start_date"] > today)),
        "can_decide": row["status"] == "pending" and await _can_decide(conn, actor, requester),
    }


async def _detail(conn: aiosqlite.Connection, actor: dict, row: dict) -> dict:
    out = await _out(conn, actor, row)
    removed = await db.fetch_all(
        conn,
        """SELECT r.id, r.shift_template_id, s.name AS shift_name, r.date, r.status, r.note
             FROM leave_removed_shifts r JOIN shift_templates s ON s.id = r.shift_template_id
            WHERE r.leave_request_id = ? ORDER BY r.date, s.start_time""",
        (row["id"],),
    )
    refunds = await db.fetch_all(
        conn,
        "SELECT date, shifts_removed, status, resolved_at FROM leave_refund_days WHERE leave_request_id = ? ORDER BY date",
        (row["id"],),
    )
    today = clock.today().isoformat()
    for r in refunds:
        if r["status"] == "owed" and r["date"] < today:
            r["status"] = "forfeited"  # not yet written by housekeeping; report what it already is
    return out | {"removed_shifts": removed, "refund_days": refunds}


async def _load(conn: aiosqlite.Connection, leave_id: int) -> dict:
    rows = await _requests(conn, "r.id = ?", (leave_id,))
    if not rows:
        raise NotFound("Leave request not found")
    return rows[0]


async def _visible(conn: aiosqlite.Connection, actor: dict, row: dict) -> bool:
    if actor["role"] == "hr_admin" or actor["id"] == row["user_id"]:
        return True
    requester = {"id": row["user_id"], "role": row["user_role"], "team_id": row["team_id"]}
    return actor["id"] in await approvers(conn, requester)


# --------------------------------------------------------------------------------------------------- apply
class _Check:
    """Result of running the apply rules; `errors` holds (exception) in rule order."""

    def __init__(self) -> None:
        self.days = 0.0
        self.available: float | None = None
        self.violations: list[dict] = []
        self.errors: list[DomainError] = []


async def _check(ctx: Ctx, leave_type_id: int, start: date, end: date) -> _Check:
    c = _Check()
    user = ctx.user
    if user["role"] == "hr_admin":
        c.errors.append(Forbidden("HR Admins don't take leave in this system"))
        return c
    lt = await db.fetch_one(ctx.conn, "SELECT * FROM leave_types WHERE id = ?", (leave_type_id,))
    if lt is None:
        c.errors.append(NotFound("Leave type not found"))
        return c
    if not lt["active"]:
        c.errors.append(ValidationFailed(f"{lt['name']} is archived and can't be applied for"))
    if end < start:
        c.errors.append(ValidationFailed("End date is before start date"))
        return c
    c.days = float(working_days(start, end))
    if start < clock.today():
        c.errors.append(ValidationFailed("Leave can't start in the past"))
    if start.year != end.year:
        c.errors.append(ValidationFailed("A request can't span two calendar years; submit one per year"))
    if c.days == 0:
        c.errors.append(ValidationFailed("The selected dates have no working days (Mon–Fri)"))
    if not await approvers(ctx.conn, user):
        c.errors.append(Conflict("Your team has no manager yet, so leave can't be submitted. Ask HR to assign one.",
                                 code="TEAM_HAS_NO_MANAGER"))
    overlap = await db.fetch_one(
        ctx.conn,
        """SELECT start_date, end_date, status FROM leave_requests
            WHERE user_id = ? AND status IN ('pending', 'approved') AND start_date <= ? AND end_date >= ?""",
        (user["id"], end.isoformat(), start.isoformat()),
    )
    if overlap:
        c.errors.append(Conflict(
            f"This overlaps your {overlap['status']} leave ({fmt_range(overlap['start_date'], overlap['end_date'])})",
            code="LEAVE_OVERLAP"))
    c.available = await accrual.available(ctx.conn, user["id"], leave_type_id, start.year)
    if c.days > c.available:
        c.errors.append(Conflict(
            f"You need {r2(c.days)} day(s) but have {c.available} {lt['name']} day(s) available",
            code="INSUFFICIENT_BALANCE"))
    c.violations = await coverage.leave_violations(ctx.conn, user["id"], start, end)
    if c.violations:
        c.errors.append(Conflict(_coverage_message(c.violations), code="COVERAGE_VIOLATION", details=c.violations))
    return c


def _coverage_message(violations: list[dict]) -> str:
    first = violations[0]
    more = f" (and {len(violations) - 1} more)" if len(violations) > 1 else ""
    return (f"{first['shift_name']} on {fmt_day(first['date'])} would drop below its minimum of "
            f"{first['min_headcount']} ({first['headcount_without_you']} without you){more}")


async def preview(ctx: Ctx, leave_type_id: int, start: date, end: date) -> dict:
    c = await _check(ctx, leave_type_id, start, end)
    return {
        "days": c.days,
        "available": c.available,
        "remaining_after": r2(c.available - c.days) if c.available is not None else None,
        "violations": c.violations,
        "errors": [e.message for e in c.errors],
    }


async def apply(ctx: Ctx, leave_type_id: int, start: date, end: date, reason: str) -> dict:
    c = await _check(ctx, leave_type_id, start, end)
    if c.errors:
        raise c.errors[0]
    leave_id = await db.execute(
        ctx.conn,
        """INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, reason, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
        (ctx.user["id"], leave_type_id, start.isoformat(), end.isoformat(), c.days, (reason or "").strip(),
         clock.now_iso()),
    )
    row = await _load(ctx.conn, leave_id)
    await audit.record(ctx.conn, ctx.user, "leave.apply", "leave_request", leave_id,
                       after=_snap(row), team_id=ctx.user["team_id"])
    await notify(ctx.conn, await approvers(ctx.conn, ctx.user), "approval",
                 f"{ctx.user['name']} requested {r2(c.days):g} day(s) of {row['leave_type']} "
                 f"({fmt_range(start, end)})", "/approvals")
    return await _out(ctx.conn, ctx.user, row)


def _snap(row: dict) -> dict:
    return {k: row[k] for k in ("user_id", "leave_type_id", "start_date", "end_date", "days", "status",
                                "decision_comment")}


# --------------------------------------------------------------------------------------------------- decide
async def decide(ctx: Ctx, leave_id: int, approve: bool, comment: str) -> dict:
    from . import roster

    row = await _load(ctx.conn, leave_id)
    requester = await get_user(ctx.conn, row["user_id"])
    if not await _can_decide(ctx.conn, ctx.user, requester):
        if not await _visible(ctx.conn, ctx.user, row):
            raise NotFound("Leave request not found")
        raise Forbidden("You can't decide this request")
    if row["status"] != "pending":
        raise Conflict(f"This request is already {row['status']}")
    comment = (comment or "").strip()
    now = clock.now_iso()
    start, end = date.fromisoformat(row["start_date"]), date.fromisoformat(row["end_date"])

    if not approve:
        if not comment:
            raise ValidationFailed("A comment is required when rejecting")
        await db.execute(
            ctx.conn,
            "UPDATE leave_requests SET status = 'rejected', decided_by = ?, decided_at = ?, decision_comment = ? WHERE id = ?",
            (ctx.user["id"], now, comment, leave_id),
        )
        after = await _load(ctx.conn, leave_id)
        await audit.record(ctx.conn, ctx.user, "leave.reject", "leave_request", leave_id,
                           before=_snap(row), after=_snap(after), team_id=row["team_id"])
        await notify(ctx.conn, [row["user_id"]], "leave",
                     f"Your {row['leave_type']} leave ({fmt_range(start, end)}) was rejected: {comment}", "/leave")
        return await _out(ctx.conn, ctx.user, after)

    # approve: re-check balance (this request already counts as pending) and coverage
    if await accrual.available(ctx.conn, row["user_id"], row["leave_type_id"], start.year) < 0:
        raise Conflict("The employee no longer has enough balance for this request", code="INSUFFICIENT_BALANCE")
    violations = await coverage.leave_violations(ctx.conn, row["user_id"], start, end)
    if violations:
        raise Conflict(_coverage_message(violations).replace("without you", "without them"),
                       code="COVERAGE_VIOLATION", details=violations)
    await db.execute(
        ctx.conn,
        """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, leave_request_id, reason,
                                       created_by, created_at)
           VALUES (?, ?, ?, 'leave_taken', ?, ?, ?, ?, ?)""",
        (row["user_id"], row["leave_type_id"], start.year, -row["days"], leave_id,
         f"Leave {fmt_range(start, end)}", ctx.user["id"], now),
    )
    first = max(start, clock.today())  # past assignments are read-only
    assignments = await db.fetch_all(
        ctx.conn,
        "SELECT * FROM shift_assignments WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date",
        (row["user_id"], first.isoformat(), end.isoformat()),
    )
    for a in assignments:
        await db.execute(
            ctx.conn,
            "INSERT INTO leave_removed_shifts (leave_request_id, user_id, shift_template_id, date) VALUES (?, ?, ?, ?)",
            (leave_id, a["user_id"], a["shift_template_id"], a["date"]),
        )
    await roster.remove_assignments(ctx.conn, assignments, "On approved leave", ctx.user, notify_user=False)
    await db.execute(
        ctx.conn,
        "UPDATE leave_requests SET status = 'approved', decided_by = ?, decided_at = ?, decision_comment = ? WHERE id = ?",
        (ctx.user["id"], now, comment or None, leave_id),
    )
    after = await _load(ctx.conn, leave_id)
    await audit.record(ctx.conn, ctx.user, "leave.approve", "leave_request", leave_id,
                       before=_snap(row), after=_snap(after) | {"shifts_removed": len(assignments)},
                       team_id=row["team_id"])
    removed = f" {len(assignments)} shift(s) were taken off your roster." if assignments else ""
    await notify(ctx.conn, [row["user_id"]], "leave",
                 f"Your {row['leave_type']} leave ({fmt_range(start, end)}) was approved.{removed}", "/leave")
    return await _out(ctx.conn, ctx.user, after)


# --------------------------------------------------------------------------------------------------- cancel
async def cancel(ctx: Ctx, leave_id: int) -> dict:
    row = await _load(ctx.conn, leave_id)
    if row["user_id"] != ctx.user["id"]:
        if not await _visible(ctx.conn, ctx.user, row):
            raise NotFound("Leave request not found")
        raise Forbidden("Only the person who applied can cancel this request")
    today = clock.today().isoformat()
    if row["status"] == "pending":
        await _set_cancelled(ctx.conn, leave_id)
        after = await _load(ctx.conn, leave_id)
        await audit.record(ctx.conn, ctx.user, "leave.cancel", "leave_request", leave_id,
                           before=_snap(row), after=_snap(after), team_id=row["team_id"])
        await notify(ctx.conn, await approvers(ctx.conn, ctx.user), "leave",
                     f"{row['user_name']} withdrew their {row['leave_type']} request "
                     f"({fmt_range(row['start_date'], row['end_date'])})", "/approvals")
        return await _detail(ctx.conn, ctx.user, after)
    if row["status"] == "approved" and row["start_date"] > today:
        return await _cancel_approved(ctx, row)
    if row["status"] == "approved":
        raise Conflict("Approved leave can only be cancelled before it starts")
    raise Conflict(f"This request is already {row['status']}")


async def _set_cancelled(conn: aiosqlite.Connection, leave_id: int) -> None:
    await db.execute(conn, "UPDATE leave_requests SET status = 'cancelled', cancelled_at = ? WHERE id = ?",
                     (clock.now_iso(), leave_id))


async def _cancel_approved(ctx: Ctx, row: dict) -> dict:
    from . import roster

    conn, leave_id = ctx.conn, row["id"]
    await _set_cancelled(conn, leave_id)  # first, so the leave no longer blocks restoring the shifts
    user = await get_user(conn, row["user_id"])
    removed = await db.fetch_all(conn, "SELECT * FROM leave_removed_shifts WHERE leave_request_id = ? ORDER BY date",
                                 (leave_id,))
    today = clock.today()
    restored_count = 0
    for r in removed:
        day = date.fromisoformat(r["date"])
        template = await get_template(conn, r["shift_template_id"])
        problem = "The date has passed" if day < today else await roster.assignment_problem(conn, template, user, day)
        if problem is None:
            new_id = await roster.restore(conn, template, user["id"], day)
            await db.execute(conn, "UPDATE leave_removed_shifts SET status = 'restored', restored_assignment_id = ? WHERE id = ?",
                             (new_id, r["id"]))
            r["status"] = "restored"
            restored_count += 1
        else:
            await db.execute(conn, "UPDATE leave_removed_shifts SET status = 'not_restored', note = ? WHERE id = ?",
                             (problem, r["id"]))
            r["status"] = "not_restored"

    by_day: dict[str, list[dict]] = defaultdict(list)
    for r in removed:
        by_day[r["date"]].append(r)
    start, end = date.fromisoformat(row["start_date"]), date.fromisoformat(row["end_date"])
    refunded, owed = 0, []
    for day in clock.days(start, end):
        if day.weekday() >= 5:
            continue
        rows = by_day.get(day.isoformat(), [])
        if all(r["status"] == "restored" for r in rows):  # also true when nothing was removed that day
            await _refund_day(conn, row, day, len(rows))
            refunded += 1
        else:
            await db.execute(
                conn,
                """INSERT INTO leave_refund_days (leave_request_id, user_id, leave_type_id, date, shifts_removed, status)
                   VALUES (?, ?, ?, ?, ?, 'owed')""",
                (leave_id, row["user_id"], row["leave_type_id"], day.isoformat(), len(rows)),
            )
            owed.append(day)

    after = await _load(conn, leave_id)
    await audit.record(conn, ctx.user, "leave.cancel", "leave_request", leave_id, before=_snap(row),
                       after=_snap(after) | {"shifts_restored": restored_count, "shifts_not_restored":
                                             len(removed) - restored_count, "days_refunded": refunded,
                                             "days_owed": len(owed)},
                       team_id=row["team_id"])
    summary = f"{refunded} day(s) refunded"
    if removed:
        summary += f", {restored_count} of {len(removed)} shift(s) put back on the roster"
    if owed:
        summary += (". Still owed until you're rostered again: " + ", ".join(fmt_day(d) for d in owed))
    await notify(conn, [row["user_id"]], "leave",
                 f"Your {row['leave_type']} leave ({fmt_range(start, end)}) was cancelled: {summary}.", "/leave")
    await notify(conn, await approvers(conn, user), "leave",
                 f"{row['user_name']} cancelled approved {row['leave_type']} leave ({fmt_range(start, end)}): "
                 f"{summary}.", "/roster")
    return await _detail(conn, ctx.user, after)


async def _refund_day(conn: aiosqlite.Connection, row: dict, day: date, shifts_removed: int) -> None:
    now = clock.now_iso()
    entry_id = await db.execute(
        conn,
        """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, leave_request_id, reason, created_at)
           VALUES (?, ?, ?, 'leave_refund', 1, ?, ?, ?)""",
        (row["user_id"], row["leave_type_id"], int(row["start_date"][:4]), row["id"],
         f"Refund for {fmt_day(day)} (leave cancelled)", now),
    )
    await db.execute(
        conn,
        """INSERT INTO leave_refund_days (leave_request_id, user_id, leave_type_id, date, shifts_removed, status,
                                          ledger_entry_id, resolved_at)
           VALUES (?, ?, ?, ?, ?, 'refunded', ?, ?)""",
        (row["id"], row["user_id"], row["leave_type_id"], day.isoformat(), shifts_removed, entry_id, now),
    )


# --------------------------------------------------------------------------------------------------- owed days
async def expire_owed_days(conn: aiosqlite.Connection) -> int:
    """Housekeeping: owed refund days whose date has passed become forfeited."""
    rows = await db.fetch_all(
        conn,
        """SELECT d.*, u.team_id FROM leave_refund_days d JOIN users u ON u.id = d.user_id
            WHERE d.status = 'owed' AND d.date < ?""",
        (clock.today().isoformat(),),
    )
    now = clock.now_iso()
    for r in rows:
        await db.execute(conn, "UPDATE leave_refund_days SET status = 'forfeited', resolved_at = ? WHERE id = ?",
                         (now, r["id"]))
        await audit.record(conn, None, "leave.refund_forfeited", "leave_request", r["leave_request_id"],
                           after={"date": r["date"], "user_id": r["user_id"]}, team_id=r["team_id"])
    return len(rows)


async def on_assignment_added(conn: aiosqlite.Connection, user_id: int, day: date) -> None:
    """Called after anyone is put on a shift: refund an owed leave day once they are rostered enough that day."""
    await expire_owed_days(conn)
    owed = await db.fetch_all(
        conn,
        """SELECT d.*, r.start_date, t.name AS leave_type FROM leave_refund_days d
             JOIN leave_requests r ON r.id = d.leave_request_id JOIN leave_types t ON t.id = d.leave_type_id
            WHERE d.user_id = ? AND d.date = ? AND d.status = 'owed'""",
        (user_id, day.isoformat()),
    )
    if not owed:
        return
    count = await db.fetch_value(conn, "SELECT COUNT(*) FROM shift_assignments WHERE user_id = ? AND date = ?",
                                 (user_id, day.isoformat()))
    user = await get_user(conn, user_id)
    for d in owed:
        if count < d["shifts_removed"]:
            continue
        now = clock.now_iso()
        entry_id = await db.execute(
            conn,
            """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, leave_request_id, reason, created_at)
               VALUES (?, ?, ?, 'leave_refund', 1, ?, ?, ?)""",
            (user_id, d["leave_type_id"], int(d["start_date"][:4]), d["leave_request_id"],
             f"Refund for {fmt_day(day)} (rostered again)", now),
        )
        await db.execute(conn, "UPDATE leave_refund_days SET status = 'refunded', ledger_entry_id = ?, resolved_at = ? WHERE id = ?",
                         (entry_id, now, d["id"]))
        await audit.record(conn, None, "leave.refund_owed_day", "leave_request", d["leave_request_id"],
                           after={"date": d["date"], "user_id": user_id}, team_id=user["team_id"])
        await notify(conn, [user_id], "leave",
                     f"1 {d['leave_type']} day was refunded: you're rostered again on {fmt_day(day)}", "/leave")


# --------------------------------------------------------------------------------------------------- lists
async def list_requests(ctx: Ctx, scope: str) -> list[dict]:
    if scope == "mine":
        rows = await _requests(ctx.conn, "r.user_id = ? ORDER BY r.created_at DESC, r.id DESC", (ctx.user["id"],))
    elif scope == "pending":
        rows = await pending_for(ctx.conn, ctx.user)
    elif scope == "decided":
        rows = await _requests(ctx.conn, "r.decided_by = ? ORDER BY r.decided_at DESC, r.id DESC LIMIT 50",
                               (ctx.user["id"],))
    else:
        raise ValidationFailed("scope must be mine, pending or decided")
    return [await _out(ctx.conn, ctx.user, r) for r in rows]


async def pending_for(conn: aiosqlite.Connection, actor: dict) -> list[dict]:
    """Pending requests the actor can decide, oldest start first."""
    if actor["role"] == "hr_admin":
        return await _requests(conn, "r.status = 'pending' AND u.role = 'manager' ORDER BY r.start_date, r.id")
    if actor["managed_team_id"] is not None:
        return await _requests(
            conn,
            "r.status = 'pending' AND u.role = 'employee' AND u.team_id = ? ORDER BY r.start_date, r.id",
            (actor["managed_team_id"],),
        )
    return []


async def get_request(ctx: Ctx, leave_id: int) -> dict:
    row = await _load(ctx.conn, leave_id)
    if not await _visible(ctx.conn, ctx.user, row):
        raise NotFound("Leave request not found")
    return await _detail(ctx.conn, ctx.user, row)


async def out_many(conn: aiosqlite.Connection, actor: dict, rows: list[dict]) -> list[dict]:
    return [await _out(conn, actor, r) for r in rows]


async def cancel_pending_for_user(conn: aiosqlite.Connection, actor: dict, user_id: int, reason: str) -> None:
    """Deactivation: withdraw the user's pending requests."""
    rows = await _requests(conn, "r.user_id = ? AND r.status = 'pending'", (user_id,))
    for row in rows:
        await _set_cancelled(conn, row["id"])
        await audit.record(conn, actor, "leave.auto_cancel", "leave_request", row["id"],
                           before=_snap(row), after={"status": "cancelled", "reason": reason}, team_id=row["team_id"])
        requester = {"id": row["user_id"], "role": row["user_role"], "team_id": row["team_id"]}
        await notify(conn, await approvers(conn, requester), "leave",
                     f"{row['user_name']}'s {row['leave_type']} request ({fmt_range(row['start_date'], row['end_date'])}) "
                     f"was cancelled: {reason}", "/approvals")

