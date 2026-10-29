"""C9 Coverage Engine: the only place headcount and gaps are computed. Read-only.

headcount(shift, date) = people assigned to it who are active and not on approved or pending leave that date.
gap = headcount < min_headcount.
"""

from collections import defaultdict
from datetime import date

import aiosqlite

from .. import clock, db
from .common import runs_on


async def leaves_by_user(
    conn: aiosqlite.Connection, start: date, end: date, user_ids: list[int] | None = None
) -> dict[int, list[dict]]:
    """Approved and pending leave overlapping [start, end], grouped by user."""
    sql = """SELECT id, user_id, start_date, end_date, status FROM leave_requests
              WHERE status IN ('approved', 'pending') AND start_date <= ? AND end_date >= ?"""
    params: list = [end.isoformat(), start.isoformat()]
    if user_ids is not None:
        sql += f" AND user_id IN ({db.placeholders(user_ids)})"
        params += user_ids
    out: dict[int, list[dict]] = defaultdict(list)
    for row in await db.fetch_all(conn, sql, params):
        out[row["user_id"]].append(row)
    return out


def leave_status_on(leaves: list[dict], day: date) -> str | None:
    """'approved' beats 'pending' if both cover the day; None if neither does."""
    iso = day.isoformat()
    statuses = {lv["status"] for lv in leaves if lv["start_date"] <= iso <= lv["end_date"]}
    if "approved" in statuses:
        return "approved"
    if "pending" in statuses:
        return "pending"
    return None


async def coverage_grid(
    conn: aiosqlite.Connection,
    team_ids: list[int],
    start: date,
    end: date,
    template_ids: list[int] | None = None,
) -> list[dict]:
    """One cell per (template, date): every date an active template runs, plus any date with assignments."""
    if not team_ids:
        return []
    sql = f"""SELECT s.*, t.name AS team_name FROM shift_templates s JOIN teams t ON t.id = s.team_id
               WHERE s.team_id IN ({db.placeholders(team_ids)})"""
    params: list = list(team_ids)
    if template_ids is not None:
        sql += f" AND s.id IN ({db.placeholders(template_ids)})"
        params += template_ids
    templates = await db.fetch_all(conn, sql + " ORDER BY t.name, s.start_time, s.name", params)
    if not templates:
        return []
    tids = [t["id"] for t in templates]
    assignments = await db.fetch_all(
        conn,
        f"""SELECT a.id, a.user_id, a.shift_template_id, a.date, u.name AS user_name, u.active
              FROM shift_assignments a JOIN users u ON u.id = a.user_id
             WHERE a.shift_template_id IN ({db.placeholders(tids)}) AND a.date BETWEEN ? AND ?
             ORDER BY u.name""",
        [*tids, start.isoformat(), end.isoformat()],
    )
    leaves = await leaves_by_user(conn, start, end, sorted({a["user_id"] for a in assignments}))
    by_cell: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for a in assignments:
        by_cell[(a["shift_template_id"], a["date"])].append(a)

    cells = []
    for day in clock.days(start, end):
        iso = day.isoformat()
        for t in templates:
            assigned = by_cell.get((t["id"], iso), [])
            if not assigned and not (t["active"] and runs_on(t, day)):
                continue
            people = []
            headcount = 0
            for a in assigned:
                status = leave_status_on(leaves.get(a["user_id"], []), day)
                if a["active"] and status is None:
                    headcount += 1
                people.append(
                    {"assignment_id": a["id"], "user_id": a["user_id"], "user_name": a["user_name"], "leave_status": status}
                )
            cells.append(
                {
                    "shift_template_id": t["id"],
                    "shift_name": t["name"],
                    "team_id": t["team_id"],
                    "team_name": t["team_name"],
                    "date": iso,
                    "start_time": t["start_time"],
                    "end_time": t["end_time"],
                    "min_headcount": t["min_headcount"],
                    "headcount": headcount,
                    "gap": headcount < t["min_headcount"],
                    "assigned": people,
                }
            )
    return cells


async def gaps(conn: aiosqlite.Connection, team_ids: list[int], start: date, end: date) -> list[dict]:
    return [c for c in await coverage_grid(conn, team_ids, start, end) if c["gap"]]


async def leave_violations(conn: aiosqlite.Connection, user_id: int, start: date, end: date) -> list[dict]:
    """Shifts the user is rostered on in [start, end] that would drop below minimum without them.

    Everyone else on approved or pending leave that date is already excluded.
    """
    mine = await db.fetch_all(
        conn,
        """SELECT a.shift_template_id, a.date, s.team_id FROM shift_assignments a
             JOIN shift_templates s ON s.id = a.shift_template_id
            WHERE a.user_id = ? AND a.date BETWEEN ? AND ?
            ORDER BY a.date, s.start_time""",
        (user_id, start.isoformat(), end.isoformat()),
    )
    if not mine:
        return []
    grid = await coverage_grid(
        conn, sorted({m["team_id"] for m in mine}), start, end, sorted({m["shift_template_id"] for m in mine})
    )
    cells = {(c["shift_template_id"], c["date"]): c for c in grid}
    violations = []
    for m in mine:
        cell = cells[(m["shift_template_id"], m["date"])]
        me = next(p for p in cell["assigned"] if p["user_id"] == user_id)
        others = cell["headcount"] - (1 if me["leave_status"] is None else 0)
        if others < cell["min_headcount"]:
            violations.append(
                {
                    "date": cell["date"],
                    "shift_template_id": cell["shift_template_id"],
                    "shift_name": cell["shift_name"],
                    "min_headcount": cell["min_headcount"],
                    "headcount_without_you": others,
                }
            )
    return violations
