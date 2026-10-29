"""C4 Shift Config: per-team shift templates with minimum headcount. HR for any team; a manager for their own."""

import re

from .. import clock, db
from ..auth import Ctx
from ..errors import Conflict, Forbidden, NotFound, ValidationFailed
from . import audit
from .common import can_manage_team, get_template, team_manager_id, template_out
from .notify import notify

TIME_RE = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")


def _validate(name: str, start: str, end: str, days: list[int], min_headcount: int) -> tuple[str, str]:
    name = (name or "").strip()
    if not name:
        raise ValidationFailed("Name is required")
    if not TIME_RE.match(start or "") or not TIME_RE.match(end or ""):
        raise ValidationFailed("Times must be HH:MM (24 hour)")
    if start == end:
        raise ValidationFailed("Start and end time must differ")
    if not days or any(d not in range(7) for d in days) or len(set(days)) != len(days):
        raise ValidationFailed("Pick at least one day of the week (0 = Monday … 6 = Sunday), each once")
    if min_headcount < 0:
        raise ValidationFailed("Minimum headcount can't be negative")
    return name, ",".join(str(d) for d in sorted(days))


async def _name_taken(ctx: Ctx, team_id: int, name: str, except_id: int | None = None) -> bool:
    return bool(await db.fetch_value(
        ctx.conn,
        "SELECT 1 FROM shift_templates WHERE team_id = ? AND name = ? COLLATE NOCASE AND id IS NOT ?",
        (team_id, name, except_id),
    ))


async def list_templates(ctx: Ctx, team_id: int | None, include_inactive: bool) -> list[dict]:
    rows = await db.fetch_all(
        ctx.conn,
        """SELECT s.*, t.name AS team_name FROM shift_templates s JOIN teams t ON t.id = s.team_id
            WHERE (? IS NULL OR s.team_id = ?) ORDER BY t.name, s.start_time, s.name""",
        (team_id, team_id),
    )
    return [
        template_out(r) for r in rows
        if r["active"] or (include_inactive and can_manage_team(ctx.user, r["team_id"]))
    ]


async def create_template(
    ctx: Ctx, team_id: int, name: str, start: str, end: str, days: list[int], min_headcount: int
) -> dict:
    if not await db.fetch_value(ctx.conn, "SELECT 1 FROM teams WHERE id = ?", (team_id,)):
        raise NotFound("Team not found")
    if not can_manage_team(ctx.user, team_id):
        raise Forbidden("Only HR Admins and this team's manager can configure its shifts")
    name, days_text = _validate(name, start, end, days, min_headcount)
    if await _name_taken(ctx, team_id, name):
        raise Conflict("This team already has a shift with that name", code="DUPLICATE")
    template_id = await db.execute(
        ctx.conn,
        """INSERT INTO shift_templates (team_id, name, start_time, end_time, days_of_week, min_headcount)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (team_id, name, start, end, days_text, min_headcount),
    )
    row = await get_template(ctx.conn, template_id)
    await audit.record(ctx.conn, ctx.user, "shift_template.create", "shift_template", template_id,
                       after=template_out(row), team_id=team_id)
    return template_out(row)


async def update_template(ctx: Ctx, template_id: int, changes: dict) -> dict:
    from . import roster

    before = await get_template(ctx.conn, template_id)
    if before is None:
        raise NotFound("Shift template not found")
    if not can_manage_team(ctx.user, before["team_id"]):
        raise Forbidden("Only HR Admins and this team's manager can configure its shifts")
    name, days_text = _validate(
        changes.get("name", before["name"]),
        changes.get("start_time", before["start_time"]),
        changes.get("end_time", before["end_time"]),
        changes.get("days_of_week", template_out(before)["days_of_week"]),
        changes.get("min_headcount", before["min_headcount"]),
    )
    if await _name_taken(ctx, before["team_id"], name, template_id):
        raise Conflict("This team already has a shift with that name", code="DUPLICATE")
    active = changes.get("active", bool(before["active"]))
    await db.execute(
        ctx.conn,
        """UPDATE shift_templates SET name = ?, start_time = ?, end_time = ?, days_of_week = ?, min_headcount = ?,
                  active = ? WHERE id = ?""",
        (name, changes.get("start_time", before["start_time"]), changes.get("end_time", before["end_time"]),
         days_text, changes.get("min_headcount", before["min_headcount"]), int(active), template_id),
    )
    after = await get_template(ctx.conn, template_id)
    await audit.record(ctx.conn, ctx.user, "shift_template.update", "shift_template", template_id,
                       before=template_out(before), after=template_out(after), team_id=before["team_id"])
    if before["active"] and not active:
        rows = await db.fetch_all(
            ctx.conn, "SELECT * FROM shift_assignments WHERE shift_template_id = ? AND date >= ?",
            (template_id, clock.today().isoformat()),
        )
        await roster.remove_assignments(ctx.conn, rows, "Shift archived", ctx.user)
        manager_id = await team_manager_id(ctx.conn, before["team_id"])
        if manager_id != ctx.user["id"]:
            await notify(ctx.conn, [manager_id], "coverage",
                         f"Shift {before['name']} was archived; {len(rows)} future assignment(s) removed", "/roster")
    return template_out(after)
