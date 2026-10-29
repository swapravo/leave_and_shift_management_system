"""C7 Roster: assign / unassign people to shift x date, copy week, roster and "my shifts" views.

Past dates are read-only. `assignment_problem` is the single guard used by assign, copy week, restore and swaps.
"""

from collections import defaultdict
from datetime import date, timedelta

import aiosqlite

from .. import clock, db
from ..auth import Ctx
from ..errors import Conflict, Forbidden, NotFound, ValidationFailed
from . import audit, coverage
from .common import (
    can_manage_team, fmt_day, get_template, get_user, intervals_overlap, runs_on, shift_interval,
    team_manager_id, template_out,
)
from .notify import notify

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


async def assignment_problem(
    conn: aiosqlite.Connection, template: dict, user: dict, day: date, ignore_ids: tuple[int, ...] = ()
) -> str | None:
    """Why `user` can't be on `template` on `day`, or None if they can."""
    name = user["name"]
    if not user["active"]:
        return f"{name} is deactivated"
    if user["role"] not in ("employee", "manager"):
        return f"{name} is an HR Admin and can't be rostered"
    if user["team_id"] != template["team_id"]:
        return f"{name} isn't in this shift's team"
    if not template["active"]:
        return f"{template['name']} is archived"
    if not runs_on(template, day):
        return f"{template['name']} doesn't run on {WEEKDAYS[day.weekday()]}s"
    leaves = await coverage.leaves_by_user(conn, day, day, [user["id"]])
    status = coverage.leave_status_on(leaves.get(user["id"], []), day)
    if status:
        return f"{name} is on {status} leave on {fmt_day(day)}"
    others = await db.fetch_all(
        conn,
        """SELECT a.id, a.date, s.id AS template_id, s.name, s.start_time, s.end_time
             FROM shift_assignments a JOIN shift_templates s ON s.id = a.shift_template_id
            WHERE a.user_id = ? AND a.date BETWEEN ? AND ?""",
        (user["id"], (day - timedelta(days=1)).isoformat(), (day + timedelta(days=1)).isoformat()),
    )
    others = [o for o in others if o["id"] not in ignore_ids]
    mine = shift_interval(template, day)
    for o in others:
        if o["template_id"] == template["id"] and o["date"] == day.isoformat():
            return f"{name} is already on {template['name']} on {fmt_day(day)}"
        if intervals_overlap(mine, shift_interval(o, date.fromisoformat(o["date"]))):
            return (f"{name} is already on {o['name']} ({o['start_time']}–{o['end_time']}) on "
                    f"{fmt_day(o['date'])}, which overlaps")
    return None


async def assignment_out(conn: aiosqlite.Connection, assignment_id: int) -> dict:
    return await db.fetch_one(
        conn,
        """SELECT a.id, a.user_id, u.name AS user_name, a.shift_template_id, s.name AS shift_name, s.team_id, a.date
             FROM shift_assignments a JOIN users u ON u.id = a.user_id
             JOIN shift_templates s ON s.id = a.shift_template_id WHERE a.id = ?""",
        (assignment_id,),
    )


async def _insert(conn: aiosqlite.Connection, template: dict, user_id: int, day: date, actor: dict | None,
                  action: str) -> int:
    assignment_id = await db.execute(
        conn,
        "INSERT INTO shift_assignments (user_id, shift_template_id, date, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, template["id"], day.isoformat(), actor["id"] if actor else None, clock.now_iso()),
    )
    await audit.record(conn, actor, action, "shift_assignment", assignment_id,
                       after={"user_id": user_id, "shift_template_id": template["id"], "shift": template["name"],
                              "date": day.isoformat()},
                       team_id=template["team_id"])
    return assignment_id


async def assign(ctx: Ctx, template_id: int, user_id: int, day: date) -> dict:
    from . import leave

    template = await get_template(ctx.conn, template_id)
    if template is None:
        raise NotFound("Shift template not found")
    if not can_manage_team(ctx.user, template["team_id"]):
        raise Forbidden("Only HR Admins and this team's manager can change its roster")
    if day < clock.today():
        raise ValidationFailed("Past dates are read-only")
    user = await get_user(ctx.conn, user_id)
    if user is None:
        raise NotFound("User not found")
    problem = await assignment_problem(ctx.conn, template, user, day)
    if problem:
        raise Conflict(problem, code="ROSTER_CONFLICT")
    assignment_id = await _insert(ctx.conn, template, user_id, day, ctx.user, "roster.assign")
    if user_id != ctx.user["id"]:
        await notify(ctx.conn, [user_id], "roster",
                     f"You were rostered on {template['name']} ({template['start_time']}–{template['end_time']}) "
                     f"on {fmt_day(day)}", "/shifts")
    await leave.on_assignment_added(ctx.conn, user_id, day)
    return await assignment_out(ctx.conn, assignment_id)


async def unassign(ctx: Ctx, assignment_id: int) -> None:
    row = await db.fetch_one(
        ctx.conn,
        """SELECT a.*, s.team_id FROM shift_assignments a JOIN shift_templates s ON s.id = a.shift_template_id
            WHERE a.id = ?""",
        (assignment_id,),
    )
    if row is None:
        raise NotFound("Assignment not found")
    if not can_manage_team(ctx.user, row["team_id"]):
        raise Forbidden("Only HR Admins and this team's manager can change its roster")
    if date.fromisoformat(row["date"]) < clock.today():
        raise ValidationFailed("Past dates are read-only")
    await remove_assignments(ctx.conn, [row], "Removed from the roster", ctx.user)


async def _cells(conn: aiosqlite.Connection, keys: set[tuple[int, str]]) -> dict[tuple[int, str], dict]:
    if not keys:
        return {}
    template_ids = sorted({k[0] for k in keys})
    teams = await db.fetch_all(
        conn, f"SELECT DISTINCT team_id FROM shift_templates WHERE id IN ({db.placeholders(template_ids)})", template_ids
    )
    dates = sorted(k[1] for k in keys)
    grid = await coverage.coverage_grid(
        conn, [t["team_id"] for t in teams], date.fromisoformat(dates[0]), date.fromisoformat(dates[-1]), template_ids
    )
    return {(c["shift_template_id"], c["date"]): c for c in grid if (c["shift_template_id"], c["date"]) in keys}


async def remove_assignments(
    conn: aiosqlite.Connection, rows: list[dict], reason: str, actor: dict | None, notify_user: bool = True
) -> None:
    """Delete assignments (cancelling open swaps on them first), audit, notify, and alert new coverage gaps."""
    from . import swaps

    if not rows:
        return
    ids = [r["id"] for r in rows]
    today = clock.today().isoformat()
    future_keys = {(r["shift_template_id"], r["date"]) for r in rows if r["date"] >= today}
    before = await _cells(conn, future_keys)
    await swaps.cancel_for_assignments(conn, ids, reason, actor)
    templates = {}
    for r in rows:
        if r["shift_template_id"] not in templates:
            templates[r["shift_template_id"]] = await get_template(conn, r["shift_template_id"])
        t = templates[r["shift_template_id"]]
        await db.execute(conn, "DELETE FROM shift_assignments WHERE id = ?", (r["id"],))
        await audit.record(conn, actor, "roster.unassign", "shift_assignment", r["id"],
                           before={"user_id": r["user_id"], "shift_template_id": t["id"], "shift": t["name"],
                                   "date": r["date"]},
                           after={"reason": reason}, team_id=t["team_id"])
        if notify_user and (actor is None or r["user_id"] != actor["id"]):
            await notify(conn, [r["user_id"]], "roster",
                         f"You were taken off {t['name']} on {fmt_day(r['date'])}: {reason}", "/shifts")
    after = await _cells(conn, future_keys)
    for key, cell in sorted(after.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        was = before.get(key)
        if cell["gap"] and was is not None and not was["gap"]:
            manager_id = await team_manager_id(conn, cell["team_id"])
            if manager_id is not None and (actor is None or manager_id != actor["id"]):
                await notify(conn, [manager_id], "coverage",
                             f"{cell['shift_name']} on {fmt_day(cell['date'])} is below minimum "
                             f"({cell['headcount']} of {cell['min_headcount']})", "/roster")


async def restore(conn: aiosqlite.Connection, template: dict, user_id: int, day: date) -> int:
    """Put someone back on a shift removed for leave that was then cancelled (system action)."""
    return await _insert(conn, template, user_id, day, None, "roster.restore")


async def copy_week(ctx: Ctx, team_id: int, week_start: date) -> dict:
    from . import leave

    if not await db.fetch_value(ctx.conn, "SELECT 1 FROM teams WHERE id = ?", (team_id,)):
        raise NotFound("Team not found")
    if not can_manage_team(ctx.user, team_id):
        raise Forbidden("Only HR Admins and this team's manager can change its roster")
    if week_start.weekday() != 0:
        raise ValidationFailed("The week must start on a Monday")
    previous = await db.fetch_all(
        ctx.conn,
        """SELECT a.* FROM shift_assignments a JOIN shift_templates s ON s.id = a.shift_template_id
            WHERE s.team_id = ? AND a.date BETWEEN ? AND ? ORDER BY a.date, s.start_time, a.user_id""",
        (team_id, (week_start - timedelta(days=7)).isoformat(), (week_start - timedelta(days=1)).isoformat()),
    )
    today = clock.today()
    copied = 0
    skipped: list[str] = []
    per_user: dict[int, int] = defaultdict(int)
    for row in previous:
        template = await get_template(ctx.conn, row["shift_template_id"])
        user = await get_user(ctx.conn, row["user_id"])
        day = date.fromisoformat(row["date"]) + timedelta(days=7)
        label = f"{user['name']} · {template['name']} {fmt_day(day)}"
        if day < today:
            skipped.append(f"{label}: date is in the past")
            continue
        problem = await assignment_problem(ctx.conn, template, user, day)
        if problem:
            skipped.append(f"{label}: {problem}")
            continue
        await _insert(ctx.conn, template, user["id"], day, ctx.user, "roster.assign")
        await leave.on_assignment_added(ctx.conn, user["id"], day)
        copied += 1
        per_user[user["id"]] += 1
    for user_id, count in per_user.items():
        if user_id != ctx.user["id"]:
            await notify(ctx.conn, [user_id], "roster",
                         f"You were rostered on {count} shift(s) in the week of {fmt_day(week_start)}", "/shifts")
    return {"copied": copied, "skipped": skipped}


async def team_leaves(conn: aiosqlite.Connection, team_ids: list[int], start: date, end: date) -> list[dict]:
    return await db.fetch_all(
        conn,
        f"""SELECT r.id, r.user_id, u.name AS user_name, u.team_id, t.name AS leave_type, r.start_date, r.end_date,
                   r.days, r.status
              FROM leave_requests r JOIN users u ON u.id = r.user_id JOIN leave_types t ON t.id = r.leave_type_id
             WHERE r.status IN ('approved', 'pending') AND r.start_date <= ? AND r.end_date >= ?
               AND u.team_id IN ({db.placeholders(team_ids)})
             ORDER BY r.start_date, u.name""",
        [end.isoformat(), start.isoformat(), *team_ids],
    )


async def team_members(conn: aiosqlite.Connection, team_ids: list[int]) -> list[dict]:
    return await db.fetch_all(
        conn,
        f"""SELECT id, name, role, team_id FROM users
             WHERE active = 1 AND role IN ('employee', 'manager') AND team_id IN ({db.placeholders(team_ids)})
             ORDER BY name""",
        team_ids,
    )


def check_range(start: date, end: date, max_days: int) -> None:
    if end < start:
        raise ValidationFailed("End date is before start date")
    if (end - start).days + 1 > max_days:
        raise ValidationFailed(f"Pick at most {max_days} days")


async def roster_view(ctx: Ctx, team_id: int, start: date, end: date) -> dict:
    from .org import _team_row, team_out

    team = await _team_row(ctx.conn, team_id)
    if team is None:
        raise NotFound("Team not found")
    if not can_manage_team(ctx.user, team_id):
        raise Forbidden("Only HR Admins and this team's manager can see its roster")
    check_range(start, end, 42)
    templates = await db.fetch_all(
        ctx.conn,
        """SELECT s.*, t.name AS team_name FROM shift_templates s JOIN teams t ON t.id = s.team_id
            WHERE s.team_id = ? AND s.active = 1 ORDER BY s.start_time, s.name""",
        (team_id,),
    )
    return {
        "team": team_out(team),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "members": await team_members(ctx.conn, [team_id]),
        "templates": [template_out(t) for t in templates],
        "leaves": await team_leaves(ctx.conn, [team_id], start, end),
        "cells": await coverage.coverage_grid(ctx.conn, [team_id], start, end),
    }


async def my_shifts(ctx: Ctx, start: date | None, end: date | None) -> list[dict]:
    start = start or clock.today()
    end = end or start + timedelta(days=27)
    check_range(start, end, 366)
    return await db.fetch_all(
        ctx.conn,
        """SELECT a.id, a.date, a.shift_template_id, s.name AS shift_name, s.start_time, s.end_time,
                  s.team_id, t.name AS team_name
             FROM shift_assignments a JOIN shift_templates s ON s.id = a.shift_template_id
             JOIN teams t ON t.id = s.team_id
            WHERE a.user_id = ? AND a.date BETWEEN ? AND ? ORDER BY a.date, s.start_time""",
        (ctx.user["id"], start.isoformat(), end.isoformat()),
    )
