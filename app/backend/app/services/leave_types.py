"""C3 Leave Type Config: name, annual entitlement, carry-forward cap, archive."""

from .. import db
from ..auth import Ctx, require_roles
from ..errors import Conflict, NotFound, ValidationFailed
from . import accrual, audit


def type_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "annual_entitlement": row["annual_entitlement"],
        "carry_forward_cap": row["carry_forward_cap"],
        "active": bool(row["active"]),
    }


def _validate(name: str, entitlement: float, cap: float) -> str:
    name = (name or "").strip()
    if not name:
        raise ValidationFailed("Name is required")
    if not 0 <= entitlement <= 366:
        raise ValidationFailed("Annual entitlement must be between 0 and 366 days")
    if cap < 0:
        raise ValidationFailed("Carry-forward cap can't be negative")
    return name


async def _name_taken(ctx: Ctx, name: str, except_id: int | None = None) -> bool:
    return bool(await db.fetch_value(
        ctx.conn, "SELECT 1 FROM leave_types WHERE name = ? COLLATE NOCASE AND id IS NOT ?", (name, except_id)
    ))


async def list_types(ctx: Ctx, include_inactive: bool) -> list[dict]:
    show_all = include_inactive and ctx.is_hr
    rows = await db.fetch_all(
        ctx.conn, f"SELECT * FROM leave_types {'' if show_all else 'WHERE active = 1'} ORDER BY name"
    )
    return [type_out(r) for r in rows]


async def create_type(ctx: Ctx, name: str, entitlement: float, cap: float) -> dict:
    require_roles(ctx.user, "hr_admin")
    name = _validate(name, entitlement, cap)
    if await _name_taken(ctx, name):
        raise Conflict("A leave type with this name already exists", code="DUPLICATE")
    type_id = await db.execute(
        ctx.conn, "INSERT INTO leave_types (name, annual_entitlement, carry_forward_cap) VALUES (?, ?, ?)",
        (name, entitlement, cap),
    )
    row = await db.fetch_one(ctx.conn, "SELECT * FROM leave_types WHERE id = ?", (type_id,))
    await audit.record(ctx.conn, ctx.user, "leave_type.create", "leave_type", type_id, after=type_out(row))
    await accrual.catch_up(ctx.conn)  # credit this year's months to date for the new type
    return type_out(row)


async def update_type(ctx: Ctx, type_id: int, changes: dict) -> dict:
    require_roles(ctx.user, "hr_admin")
    before = await db.fetch_one(ctx.conn, "SELECT * FROM leave_types WHERE id = ?", (type_id,))
    if before is None:
        raise NotFound("Leave type not found")
    name = changes.get("name", before["name"])
    entitlement = changes.get("annual_entitlement", before["annual_entitlement"])
    cap = changes.get("carry_forward_cap", before["carry_forward_cap"])
    active = changes.get("active", bool(before["active"]))
    name = _validate(name, entitlement, cap)
    if await _name_taken(ctx, name, type_id):
        raise Conflict("A leave type with this name already exists", code="DUPLICATE")
    await db.execute(
        ctx.conn,
        "UPDATE leave_types SET name = ?, annual_entitlement = ?, carry_forward_cap = ?, active = ? WHERE id = ?",
        (name, entitlement, cap, int(active), type_id),
    )
    after = await db.fetch_one(ctx.conn, "SELECT * FROM leave_types WHERE id = ?", (type_id,))
    await audit.record(ctx.conn, ctx.user, "leave_type.update", "leave_type", type_id,
                       before=type_out(before), after=type_out(after))
    if active and not before["active"]:
        await accrual.catch_up(ctx.conn)
    return type_out(after)
