"""C10 Read Models: unified team calendar and the manager dashboard (BRD success criterion 3)."""

from datetime import date, timedelta

from .. import clock, db
from ..auth import Ctx, require_roles
from ..errors import Forbidden, NotFound
from . import coverage, leave, swaps
from .roster import check_range, team_leaves, team_members


async def calendar(ctx: Ctx, start: date, end: date, team_id: int | None) -> dict:
    check_range(start, end, 62)
    if ctx.is_hr:
        if team_id is not None and not await db.fetch_value(ctx.conn, "SELECT 1 FROM teams WHERE id = ?", (team_id,)):
            raise NotFound("Team not found")
        team_ids = [team_id] if team_id is not None else [
            t["id"] for t in await db.fetch_all(ctx.conn, "SELECT id FROM teams ORDER BY name")
        ]
    else:
        own = ctx.user["team_id"]
        if team_id is not None and team_id != own:
            raise Forbidden("You can only see your own team's calendar")
        team_ids = [own]
    teams = await db.fetch_all(
        ctx.conn, f"SELECT id, name, department FROM teams WHERE id IN ({db.placeholders(team_ids)}) ORDER BY name",
        team_ids,
    )
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "teams": teams,
        "members": await team_members(ctx.conn, team_ids),
        "leaves": await team_leaves(ctx.conn, team_ids, start, end),
        "cells": await coverage.coverage_grid(ctx.conn, team_ids, start, end),
    }


async def dashboard(ctx: Ctx) -> dict:
    require_roles(ctx.user, "manager", "hr_admin")
    today = clock.today()
    if ctx.is_hr:
        teams = await db.fetch_all(ctx.conn, "SELECT id, name FROM teams ORDER BY name")
    elif ctx.user["managed_team_id"] is not None:
        teams = await db.fetch_all(ctx.conn, "SELECT id, name FROM teams WHERE id = ?", (ctx.user["managed_team_id"],))
    else:
        teams = []
    team_ids = [t["id"] for t in teams]
    today_cells = await coverage.coverage_grid(ctx.conn, team_ids, today, today)
    upcoming = await coverage.gaps(ctx.conn, team_ids, today + timedelta(days=1), today + timedelta(days=7))

    members = await team_members(ctx.conn, team_ids) if team_ids else []
    team_names = {t["id"]: t["name"] for t in teams}
    leaves = await coverage.leaves_by_user(ctx.conn, today, today, [m["id"] for m in members])
    shifts_today: dict[int, list[str]] = {}
    for cell in today_cells:
        for p in cell["assigned"]:
            shifts_today.setdefault(p["user_id"], []).append(
                f"{cell['shift_name']} {cell['start_time']}-{cell['end_time']}")
    availability = []
    for m in members:
        status = coverage.leave_status_on(leaves.get(m["id"], []), today)
        if status == "approved":
            state = "on_leave"
        elif m["id"] in shifts_today:
            state = "on_shift"
        else:
            state = "off"
        availability.append({
            "id": m["id"],
            "name": m["name"],
            "team_id": m["team_id"],
            "team_name": team_names[m["team_id"]],
            "status": state,
            "shifts": shifts_today.get(m["id"], []) if state == "on_shift" else [],
            "pending_leave_today": status == "pending",
        })
    return {
        "today": today.isoformat(),
        "teams": teams,
        "pending_leave": await leave.out_many(ctx.conn, ctx.user, await leave.pending_for(ctx.conn, ctx.user)),
        "pending_swaps": await swaps.pending_for(ctx.conn, ctx.user),
        "gaps_today": [c for c in today_cells if c["gap"]],
        "upcoming_gaps": upcoming,
        "availability": availability,
    }
