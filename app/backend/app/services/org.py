"""C2 Org Admin: users (soft delete) and teams, including the single manager of each team."""

import re
from datetime import date

import aiosqlite

from .. import clock, db
from ..auth import ROLES, Ctx, hash_password, require_roles
from ..errors import Conflict, Forbidden, NotFound, ValidationFailed
from . import accrual, audit, birthday
from .common import get_user

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def user_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "team_id": row["team_id"],
        "team_name": row.get("team_name"),
        "join_date": row["join_date"],
        "date_of_birth": row["date_of_birth"],
        "active": bool(row["active"]),
        "created_at": row["created_at"],
        "deactivated_at": row["deactivated_at"],
    }


def _snapshot(row: dict) -> dict:
    return {k: row[k] for k in ("name", "email", "role", "team_id", "join_date", "date_of_birth", "active")}


def _normalise_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise ValidationFailed("Enter a valid email address")
    return email


def _check_birth_date(value: date | None) -> None:
    if value is not None and not date(1900, 1, 1) <= value < clock.today():
        raise ValidationFailed("Enter a date of birth in the past")


def _check_password(password: str) -> None:
    if len(password) < 8:
        raise ValidationFailed("Password must be at least 8 characters")
    if len(password.encode()) > 72:
        raise ValidationFailed("Password must be at most 72 bytes")


async def _check_team(conn: aiosqlite.Connection, role: str, team_id: int | None) -> None:
    if role == "hr_admin":
        if team_id is not None:
            raise ValidationFailed("HR Admins don't belong to a team")
        return
    if team_id is None:
        raise ValidationFailed("Employees and managers need a team")
    if not await db.fetch_value(conn, "SELECT 1 FROM teams WHERE id = ?", (team_id,)):
        raise NotFound("Team not found")


async def _email_taken(conn: aiosqlite.Connection, email: str, except_id: int | None = None) -> bool:
    return bool(
        await db.fetch_value(conn, "SELECT 1 FROM users WHERE email = ? AND id IS NOT ?", (email, except_id))
    )


async def _active_hr_count(conn: aiosqlite.Connection) -> int:
    return await db.fetch_value(conn, "SELECT COUNT(*) FROM users WHERE role = 'hr_admin' AND active = 1")


async def _release_future_shifts(conn: aiosqlite.Connection, actor: dict, user_id: int, reason: str) -> None:
    from . import roster

    rows = await db.fetch_all(
        conn, "SELECT * FROM shift_assignments WHERE user_id = ? AND date >= ?", (user_id, clock.today().isoformat())
    )
    await roster.remove_assignments(conn, rows, reason, actor, notify_user=False)


async def _stop_managing(conn: aiosqlite.Connection, actor: dict, user_id: int) -> None:
    team = await db.fetch_one(conn, "SELECT * FROM teams WHERE manager_id = ?", (user_id,))
    if team:
        await db.execute(conn, "UPDATE teams SET manager_id = NULL WHERE id = ?", (team["id"],))
        await audit.record(conn, actor, "team.update", "team", team["id"],
                           before={"manager_id": user_id}, after={"manager_id": None}, team_id=team["id"])


# --------------------------------------------------------------------------------------------------- users
async def list_users(ctx: Ctx, include_inactive: bool, team_id: int | None) -> list[dict]:
    require_roles(ctx.user, "hr_admin")
    rows = await db.fetch_all(
        ctx.conn,
        """SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id
            WHERE (? OR u.active = 1) AND (? IS NULL OR u.team_id = ?)
            ORDER BY u.name""",
        (include_inactive, team_id, team_id),
    )
    return [user_out(r) for r in rows]


async def create_user(
    ctx: Ctx, name: str, email: str, role: str, team_id: int | None, password: str, join_date: date | None,
    date_of_birth: date | None = None,
) -> dict:
    require_roles(ctx.user, "hr_admin")
    name = (name or "").strip()
    if not name:
        raise ValidationFailed("Name is required")
    email = _normalise_email(email)
    if role not in ROLES:
        raise ValidationFailed("Unknown role")
    await _check_team(ctx.conn, role, team_id)
    _check_password(password)
    _check_birth_date(date_of_birth)
    if await _email_taken(ctx.conn, email):
        raise Conflict("A user with this email already exists", code="DUPLICATE")
    now = clock.now_iso()
    user_id = await db.execute(
        ctx.conn,
        """INSERT INTO users (name, email, password_hash, role, team_id, join_date, date_of_birth,
                              password_changed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, email, await hash_password(password), role, team_id, (join_date or clock.today()).isoformat(),
         date_of_birth.isoformat() if date_of_birth else None, clock.real_now().isoformat(), now),
    )
    row = await get_user(ctx.conn, user_id)
    await audit.record(ctx.conn, ctx.user, "user.create", "user", user_id, after=_snapshot(row), team_id=team_id)
    if role in accrual.ELIGIBLE_ROLES:
        await accrual.catch_up(ctx.conn, user_id)
        await birthday.run(ctx.conn, user_id)
    return user_out(await get_user(ctx.conn, user_id))


async def update_user(ctx: Ctx, user_id: int, changes: dict) -> dict:
    """`changes` holds only the fields that were sent (team_id may be None)."""
    require_roles(ctx.user, "hr_admin")
    before = await get_user(ctx.conn, user_id)
    if before is None:
        raise NotFound("User not found")
    if not before["active"]:
        raise Conflict("This user is deactivated")

    name = changes.get("name", before["name"])
    name = (name or "").strip()
    if not name:
        raise ValidationFailed("Name is required")
    email = _normalise_email(changes["email"]) if "email" in changes else before["email"]
    role = changes.get("role", before["role"])
    if role not in ROLES:
        raise ValidationFailed("Unknown role")
    if role != before["role"] and user_id == ctx.user["id"]:
        raise Forbidden("You can't change your own role")
    if "team_id" in changes:
        team_id = changes["team_id"]
    else:
        team_id = None if role == "hr_admin" else before["team_id"]
    await _check_team(ctx.conn, role, team_id)
    if before["role"] == "hr_admin" and role != "hr_admin" and await _active_hr_count(ctx.conn) <= 1:
        raise Conflict("This is the last active HR Admin", code="LAST_HR_ADMIN")
    if email != before["email"] and await _email_taken(ctx.conn, email, user_id):
        raise Conflict("A user with this email already exists", code="DUPLICATE")
    password = changes.get("password")
    if password is not None:
        _check_password(password)
    dob = changes.get("date_of_birth", date.fromisoformat(before["date_of_birth"]) if before["date_of_birth"] else None)
    _check_birth_date(dob)

    if team_id != before["team_id"] or role != before["role"]:
        await _stop_managing(ctx.conn, ctx.user, user_id)
    if before["team_id"] is not None and (team_id != before["team_id"] or role == "hr_admin"):
        await _release_future_shifts(ctx.conn, ctx.user, user_id, "Moved to another team")

    await db.execute(
        ctx.conn, "UPDATE users SET name = ?, email = ?, role = ?, team_id = ?, date_of_birth = ? WHERE id = ?",
        (name, email, role, team_id, dob.isoformat() if dob else None, user_id),
    )
    if password is not None:
        await db.execute(
            ctx.conn, "UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?",
            (await hash_password(password), clock.real_now().isoformat(), user_id),
        )
    after = await get_user(ctx.conn, user_id)
    snap_after = _snapshot(after) | ({"password": "changed"} if password is not None else {})
    await audit.record(ctx.conn, ctx.user, "user.update", "user", user_id, before=_snapshot(before),
                       after=snap_after, team_id=team_id or before["team_id"])
    if role in accrual.ELIGIBLE_ROLES and before["role"] not in accrual.ELIGIBLE_ROLES:
        await accrual.catch_up(ctx.conn, user_id)
    if role in accrual.ELIGIBLE_ROLES:
        await birthday.run(ctx.conn, user_id)
    return user_out(await get_user(ctx.conn, user_id))


async def deactivate_user(ctx: Ctx, user_id: int) -> dict:
    from . import leave, swaps

    require_roles(ctx.user, "hr_admin")
    before = await get_user(ctx.conn, user_id)
    if before is None:
        raise NotFound("User not found")
    if user_id == ctx.user["id"]:
        raise ValidationFailed("You can't deactivate yourself")
    if not before["active"]:
        raise Conflict("This user is already deactivated")
    if before["role"] == "hr_admin" and await _active_hr_count(ctx.conn) <= 1:
        raise Conflict("This is the last active HR Admin", code="LAST_HR_ADMIN")

    await _stop_managing(ctx.conn, ctx.user, user_id)
    await leave.cancel_pending_for_user(ctx.conn, ctx.user, user_id, "User deactivated")
    await swaps.cancel_for_user(ctx.conn, ctx.user, user_id, "User deactivated")
    await _release_future_shifts(ctx.conn, ctx.user, user_id, "User deactivated")
    await db.execute(
        ctx.conn, "UPDATE users SET active = 0, deactivated_at = ? WHERE id = ?", (clock.now_iso(), user_id)
    )
    after = await get_user(ctx.conn, user_id)
    await audit.record(ctx.conn, ctx.user, "user.deactivate", "user", user_id,
                       before=_snapshot(before), after=_snapshot(after), team_id=before["team_id"])
    return user_out(after)


# --------------------------------------------------------------------------------------------------- teams
async def _team_row(conn: aiosqlite.Connection, team_id: int) -> dict | None:
    return await db.fetch_one(
        conn,
        """SELECT t.*, m.name AS manager_name,
                  (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id AND u.active = 1) AS member_count
             FROM teams t LEFT JOIN users m ON m.id = t.manager_id WHERE t.id = ?""",
        (team_id,),
    )


def team_out(row: dict) -> dict:
    return {k: row[k] for k in ("id", "name", "department", "manager_id", "manager_name", "member_count", "created_at")}


async def list_teams(ctx: Ctx) -> list[dict]:
    rows = await db.fetch_all(
        ctx.conn,
        """SELECT t.*, m.name AS manager_name,
                  (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id AND u.active = 1) AS member_count
             FROM teams t LEFT JOIN users m ON m.id = t.manager_id ORDER BY t.name""",
    )
    return [team_out(r) for r in rows]


async def _set_manager(ctx: Ctx, team_id: int, manager_id: int | None) -> None:
    if manager_id is None:
        await db.execute(ctx.conn, "UPDATE teams SET manager_id = NULL WHERE id = ?", (team_id,))
        return
    user = await get_user(ctx.conn, manager_id)
    if user is None:
        raise NotFound("User not found")
    if not user["active"] or user["role"] != "manager":
        raise ValidationFailed("The team manager must be an active user with the Manager role")
    other = await db.fetch_value(
        ctx.conn, "SELECT name FROM teams WHERE manager_id = ? AND id <> ?", (manager_id, team_id)
    )
    if other:
        raise Conflict(f"{user['name']} already manages {other}")
    if user["team_id"] != team_id:
        await _release_future_shifts(ctx.conn, ctx.user, manager_id, "Moved to another team")
        await db.execute(ctx.conn, "UPDATE users SET team_id = ? WHERE id = ?", (team_id, manager_id))
        await audit.record(ctx.conn, ctx.user, "user.update", "user", manager_id,
                           before={"team_id": user["team_id"]}, after={"team_id": team_id}, team_id=team_id)
    await db.execute(ctx.conn, "UPDATE teams SET manager_id = ? WHERE id = ?", (manager_id, team_id))


async def _check_team_name(conn: aiosqlite.Connection, name: str, except_id: int | None = None) -> str:
    name = (name or "").strip()
    if not name:
        raise ValidationFailed("Team name is required")
    if await db.fetch_value(conn, "SELECT 1 FROM teams WHERE name = ? COLLATE NOCASE AND id IS NOT ?", (name, except_id)):
        raise Conflict("A team with this name already exists", code="DUPLICATE")
    return name


async def create_team(ctx: Ctx, name: str, department: str, manager_id: int | None) -> dict:
    require_roles(ctx.user, "hr_admin")
    name = await _check_team_name(ctx.conn, name)
    team_id = await db.execute(
        ctx.conn, "INSERT INTO teams (name, department, created_at) VALUES (?, ?, ?)",
        (name, (department or "").strip(), clock.now_iso()),
    )
    await _set_manager(ctx, team_id, manager_id)
    row = await _team_row(ctx.conn, team_id)
    await audit.record(ctx.conn, ctx.user, "team.create", "team", team_id, after=team_out(row), team_id=team_id)
    return team_out(row)


async def update_team(ctx: Ctx, team_id: int, changes: dict) -> dict:
    require_roles(ctx.user, "hr_admin")
    before = await _team_row(ctx.conn, team_id)
    if before is None:
        raise NotFound("Team not found")
    name = await _check_team_name(ctx.conn, changes["name"], team_id) if "name" in changes else before["name"]
    department = (changes.get("department", before["department"]) or "").strip()
    await db.execute(ctx.conn, "UPDATE teams SET name = ?, department = ? WHERE id = ?", (name, department, team_id))
    if "manager_id" in changes and changes["manager_id"] != before["manager_id"]:
        await _set_manager(ctx, team_id, changes["manager_id"])
    after = await _team_row(ctx.conn, team_id)
    await audit.record(ctx.conn, ctx.user, "team.update", "team", team_id,
                       before=team_out(before), after=team_out(after), team_id=team_id)
    return team_out(after)
