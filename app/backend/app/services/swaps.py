"""C8 Swaps: 1-for-1 exchange of two future shifts inside a team. A proposes -> B accepts -> approver decides.

The approver is the team's manager, or any HR Admin when the manager is one of the two people.
`validate` runs at propose, accept and approve.
"""

from datetime import date

import aiosqlite

from .. import clock, db
from ..auth import Ctx
from ..errors import Conflict, Forbidden, NotFound, ValidationFailed
from . import audit, coverage
from .common import fmt_day, get_template, get_user, hr_admin_ids, shift_interval, team_manager_id
from .notify import notify

OPEN = ("pending_peer", "pending_manager")

_SELECT = """SELECT w.*, tm.name AS team_name, ru.name AS requester_name, tu.name AS target_name,
                    rs.name AS requester_shift_name, rs.start_time AS requester_start_time,
                    rs.end_time AS requester_end_time,
                    ts.name AS target_shift_name, ts.start_time AS target_start_time, ts.end_time AS target_end_time,
                    d.name AS decided_by_name
               FROM swap_requests w JOIN teams tm ON tm.id = w.team_id
               JOIN users ru ON ru.id = w.requester_id JOIN users tu ON tu.id = w.target_id
               JOIN shift_templates rs ON rs.id = w.requester_shift_id
               JOIN shift_templates ts ON ts.id = w.target_shift_id
               LEFT JOIN users d ON d.id = w.decided_by"""


async def approvers(conn: aiosqlite.Connection, swap: dict) -> list[int]:
    manager_id = await team_manager_id(conn, swap["team_id"])
    if manager_id is None:
        return []  # waits for HR to assign a manager
    if manager_id in (swap["requester_id"], swap["target_id"]):
        return await hr_admin_ids(conn)
    return [manager_id]


async def _out(conn: aiosqlite.Connection, actor: dict, w: dict) -> dict:
    keys = ("id", "team_id", "team_name", "requester_id", "requester_name", "target_id", "target_name",
            "requester_shift_name", "requester_date", "requester_start_time", "requester_end_time",
            "target_shift_name", "target_date", "target_start_time", "target_end_time", "status",
            "decided_by_name", "decision_comment", "created_at")
    out = {k: w[k] for k in keys}
    out["can_respond"] = w["status"] == "pending_peer" and actor["id"] == w["target_id"]
    out["can_cancel"] = w["status"] in OPEN and actor["id"] == w["requester_id"]
    out["can_decide"] = w["status"] == "pending_manager" and actor["id"] in await approvers(conn, w)
    return out


async def _load(conn: aiosqlite.Connection, swap_id: int) -> dict:
    w = await db.fetch_one(conn, f"{_SELECT} WHERE w.id = ?", (swap_id,))
    if w is None:
        raise NotFound("Swap not found")
    return w


async def _assignment(conn: aiosqlite.Connection, assignment_id: int) -> dict | None:
    return await db.fetch_one(conn, "SELECT * FROM shift_assignments WHERE id = ?", (assignment_id,))


def _label(name: str, date_: str) -> str:
    return f"{name} on {fmt_day(date_)}"


async def validate(conn: aiosqlite.Connection, w: dict) -> None:
    """Raise SWAP_BLOCKED unless the exchange is still valid."""
    from . import roster

    def blocked(message: str) -> Conflict:
        return Conflict(message, code="SWAP_BLOCKED")

    a = await _assignment(conn, w["requester_assignment_id"])
    b = await _assignment(conn, w["target_assignment_id"])
    if (a is None or a["user_id"] != w["requester_id"] or a["shift_template_id"] != w["requester_shift_id"]
            or a["date"] != w["requester_date"]):
        raise blocked("The offered shift has changed since the swap was proposed")
    if (b is None or b["user_id"] != w["target_id"] or b["shift_template_id"] != w["target_shift_id"]
            or b["date"] != w["target_date"]):
        raise blocked("The requested shift has changed since the swap was proposed")
    ta = await get_template(conn, a["shift_template_id"])
    tb = await get_template(conn, b["shift_template_id"])
    now = clock.now()
    for t, row in ((ta, a), (tb, b)):
        if shift_interval(t, date.fromisoformat(row["date"]))[0] <= now:
            raise blocked(f"{_label(t['name'], row['date'])} has already started")
    ua = await get_user(conn, w["requester_id"])
    ub = await get_user(conn, w["target_id"])
    for u in (ua, ub):
        if not u["active"]:
            raise blocked(f"{u['name']} is deactivated")
    # BRD success criterion 2: nobody on approved or pending leave on either date
    days = sorted({date.fromisoformat(a["date"]), date.fromisoformat(b["date"])})
    leaves = await coverage.leaves_by_user(conn, days[0], days[-1], [ua["id"], ub["id"]])
    for u in (ua, ub):
        for d in days:
            status = coverage.leave_status_on(leaves.get(u["id"], []), d)
            if status:
                raise blocked(f"{u['name']} is on {status} leave on {fmt_day(d)}")
    ignore = (a["id"], b["id"])
    problem = (await roster.assignment_problem(conn, tb, ua, date.fromisoformat(b["date"]), ignore)
               or await roster.assignment_problem(conn, ta, ub, date.fromisoformat(a["date"]), ignore))
    if problem:
        raise blocked(f"After the swap: {problem}")


async def _in_open_swap(conn: aiosqlite.Connection, assignment_id: int) -> bool:
    return bool(await db.fetch_value(
        conn,
        """SELECT 1 FROM swap_requests WHERE status IN ('pending_peer', 'pending_manager')
             AND (requester_assignment_id = ? OR target_assignment_id = ?)""",
        (assignment_id, assignment_id),
    ))


async def propose(ctx: Ctx, my_assignment_id: int, their_assignment_id: int) -> dict:
    conn, me = ctx.conn, ctx.user
    if me["role"] == "hr_admin":
        raise Forbidden("HR Admins aren't rostered, so they can't swap shifts")
    a = await _assignment(conn, my_assignment_id)
    b = await _assignment(conn, their_assignment_id)
    if a is None or b is None:
        raise NotFound("Shift not found")
    if a["user_id"] != me["id"]:
        raise Forbidden("You can only offer one of your own shifts")
    if b["user_id"] == me["id"]:
        raise ValidationFailed("Pick a teammate's shift, not one of yours")
    ta = await get_template(conn, a["shift_template_id"])
    tb = await get_template(conn, b["shift_template_id"])
    if ta["team_id"] != me["team_id"] or tb["team_id"] != me["team_id"]:
        raise ValidationFailed("Swaps are only possible between shifts of your own team")
    if a["shift_template_id"] == b["shift_template_id"] and a["date"] == b["date"]:
        raise ValidationFailed("You're both on that same shift, so there is nothing to swap")
    if await team_manager_id(conn, me["team_id"]) is None:
        raise Conflict("Your team has no manager yet, so swaps can't be submitted. Ask HR to assign one.",
                       code="TEAM_HAS_NO_MANAGER")
    if await _in_open_swap(conn, a["id"]) or await _in_open_swap(conn, b["id"]):
        raise Conflict("One of these shifts is already part of an open swap")
    swap = {
        "requester_id": me["id"], "target_id": b["user_id"], "team_id": me["team_id"],
        "requester_assignment_id": a["id"], "target_assignment_id": b["id"],
        "requester_shift_id": a["shift_template_id"], "requester_date": a["date"],
        "target_shift_id": b["shift_template_id"], "target_date": b["date"],
    }
    await validate(conn, swap)
    swap_id = await db.execute(
        conn,
        """INSERT INTO swap_requests (requester_id, target_id, team_id, requester_assignment_id, target_assignment_id,
                                      requester_shift_id, requester_date, target_shift_id, target_date, status,
                                      created_at)
           VALUES (:requester_id, :target_id, :team_id, :requester_assignment_id, :target_assignment_id,
                   :requester_shift_id, :requester_date, :target_shift_id, :target_date, 'pending_peer', :now)""",
        swap | {"now": clock.now_iso()},
    )
    w = await _load(conn, swap_id)
    await audit.record(conn, me, "swap.propose", "swap_request", swap_id, after=swap, team_id=me["team_id"])
    await notify(conn, [w["target_id"]], "swap",
                 f"{me['name']} offers {_label(w['requester_shift_name'], w['requester_date'])} for your "
                 f"{_label(w['target_shift_name'], w['target_date'])}", "/shifts")
    return await _out(conn, me, w)


async def respond(ctx: Ctx, swap_id: int, accept: bool) -> dict:
    conn = ctx.conn
    w = await _load(conn, swap_id)
    if w["target_id"] != ctx.user["id"]:
        raise Forbidden("Only the teammate asked can respond")
    if w["status"] != "pending_peer":
        raise Conflict("This swap is no longer waiting for your answer")
    if accept:
        await validate(conn, w)
    status = "pending_manager" if accept else "declined"
    await db.execute(conn, "UPDATE swap_requests SET status = ?, peer_responded_at = ? WHERE id = ?",
                     (status, clock.now_iso(), swap_id))
    after = await _load(conn, swap_id)
    await audit.record(conn, ctx.user, "swap.accept" if accept else "swap.decline", "swap_request", swap_id,
                       before={"status": w["status"]}, after={"status": status}, team_id=w["team_id"])
    what = f"{_label(w['requester_shift_name'], w['requester_date'])} ↔ {_label(w['target_shift_name'], w['target_date'])}"
    if accept:
        await notify(conn, [w["requester_id"]], "swap", f"{ctx.user['name']} accepted your swap ({what}); waiting for approval", "/shifts")
        await notify(conn, await approvers(conn, w), "approval",
                     f"Swap to approve: {w['requester_name']} and {w['target_name']} ({what})", "/approvals")
    else:
        await notify(conn, [w["requester_id"]], "swap", f"{ctx.user['name']} declined your swap ({what})", "/shifts")
    return await _out(conn, ctx.user, after)


async def cancel(ctx: Ctx, swap_id: int) -> dict:
    conn = ctx.conn
    w = await _load(conn, swap_id)
    if w["requester_id"] != ctx.user["id"]:
        raise Forbidden("Only the person who proposed the swap can cancel it")
    if w["status"] not in OPEN:
        raise Conflict(f"This swap is already {w['status']}")
    await db.execute(conn, "UPDATE swap_requests SET status = 'cancelled' WHERE id = ?", (swap_id,))
    await audit.record(conn, ctx.user, "swap.cancel", "swap_request", swap_id,
                       before={"status": w["status"]}, after={"status": "cancelled"}, team_id=w["team_id"])
    recipients = [w["target_id"]] + (await approvers(conn, w) if w["status"] == "pending_manager" else [])
    await notify(conn, recipients, "swap", f"{w['requester_name']} cancelled the swap of "
                 f"{_label(w['requester_shift_name'], w['requester_date'])}", "/shifts")
    return await _out(conn, ctx.user, await _load(conn, swap_id))


async def decide(ctx: Ctx, swap_id: int, approve: bool, comment: str) -> dict:
    from . import leave

    conn = ctx.conn
    w = await _load(conn, swap_id)
    if ctx.user["id"] not in await approvers(conn, w):
        raise Forbidden("You can't decide this swap")
    if w["status"] != "pending_manager":
        raise Conflict("This swap isn't waiting for approval")
    comment = (comment or "").strip()
    if not approve and not comment:
        raise ValidationFailed("A comment is required when rejecting")
    if approve:
        await validate(conn, w)
        await db.execute(conn, "UPDATE shift_assignments SET user_id = ? WHERE id = ?",
                         (w["target_id"], w["requester_assignment_id"]))
        await db.execute(conn, "UPDATE shift_assignments SET user_id = ? WHERE id = ?",
                         (w["requester_id"], w["target_assignment_id"]))
    status = "approved" if approve else "rejected"
    await db.execute(
        conn, "UPDATE swap_requests SET status = ?, decided_by = ?, decided_at = ?, decision_comment = ? WHERE id = ?",
        (status, ctx.user["id"], clock.now_iso(), comment or None, swap_id),
    )
    await audit.record(conn, ctx.user, f"swap.{'approve' if approve else 'reject'}", "swap_request", swap_id,
                       before={"status": w["status"]}, after={"status": status, "comment": comment or None},
                       team_id=w["team_id"])
    if approve:
        await leave.on_assignment_added(conn, w["requester_id"], date.fromisoformat(w["target_date"]))
        await leave.on_assignment_added(conn, w["target_id"], date.fromisoformat(w["requester_date"]))
    what = f"{_label(w['requester_shift_name'], w['requester_date'])} ↔ {_label(w['target_shift_name'], w['target_date'])}"
    message = f"Swap {what} was {status}" + (f": {comment}" if comment else "")
    await notify(conn, [w["requester_id"], w["target_id"]], "swap", message, "/shifts")
    return await _out(conn, ctx.user, await _load(conn, swap_id))


async def cancel_for_assignments(conn: aiosqlite.Connection, assignment_ids: list[int], reason: str,
                                 actor: dict | None) -> None:
    """Cancel open swaps that involve any of these roster rows (they are about to change)."""
    if not assignment_ids:
        return
    ph = db.placeholders(assignment_ids)
    rows = await db.fetch_all(
        conn,
        f"""{_SELECT} WHERE w.status IN ('pending_peer', 'pending_manager')
              AND (w.requester_assignment_id IN ({ph}) OR w.target_assignment_id IN ({ph}))""",
        [*assignment_ids, *assignment_ids],
    )
    for w in rows:
        await _auto_cancel(conn, w, reason, actor)


async def cancel_for_user(conn: aiosqlite.Connection, actor: dict | None, user_id: int, reason: str) -> None:
    rows = await db.fetch_all(
        conn, f"{_SELECT} WHERE w.status IN ('pending_peer', 'pending_manager') AND ? IN (w.requester_id, w.target_id)",
        (user_id,),
    )
    for w in rows:
        await _auto_cancel(conn, w, reason, actor)


async def _auto_cancel(conn: aiosqlite.Connection, w: dict, reason: str, actor: dict | None) -> None:
    await db.execute(conn, "UPDATE swap_requests SET status = 'cancelled' WHERE id = ?", (w["id"],))
    await audit.record(conn, actor, "swap.auto_cancel", "swap_request", w["id"],
                       before={"status": w["status"]}, after={"status": "cancelled", "reason": reason},
                       team_id=w["team_id"])
    await notify(conn, [w["requester_id"], w["target_id"]], "swap",
                 f"The swap of {_label(w['requester_shift_name'], w['requester_date'])} and "
                 f"{_label(w['target_shift_name'], w['target_date'])} was cancelled: {reason}", "/shifts")


async def list_swaps(ctx: Ctx) -> list[dict]:
    u = ctx.user
    if ctx.is_hr:
        rows = await db.fetch_all(ctx.conn, f"{_SELECT} ORDER BY w.id DESC LIMIT 200")
    else:
        rows = await db.fetch_all(
            ctx.conn,
            f"{_SELECT} WHERE ? IN (w.requester_id, w.target_id) OR w.team_id IS ? ORDER BY w.id DESC LIMIT 200",
            (u["id"], u["managed_team_id"] if u["managed_team_id"] is not None else -1),
        )
    return [await _out(ctx.conn, u, w) for w in rows]


async def pending_for(conn: aiosqlite.Connection, actor: dict) -> list[dict]:
    """Swaps waiting for this actor's decision."""
    rows = await db.fetch_all(conn, f"{_SELECT} WHERE w.status = 'pending_manager' ORDER BY w.requester_date, w.id")
    out = []
    for w in rows:
        if actor["id"] in await approvers(conn, w):
            out.append(await _out(conn, actor, w))
    return out
