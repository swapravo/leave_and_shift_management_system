"""Small lookups and formatting shared by several components."""

from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

import aiosqlite

from .. import clock, db


def r2(value: float | Decimal) -> float:
    """Round a leave quantity to 2 decimals (half up), as stored."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def parse_days(text: str) -> list[int]:
    return [int(x) for x in text.split(",") if x != ""]


def template_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "team_id": row["team_id"],
        "team_name": row.get("team_name"),
        "name": row["name"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "days_of_week": parse_days(row["days_of_week"]),
        "min_headcount": row["min_headcount"],
        "active": bool(row["active"]),
    }


def runs_on(template: dict, day: date) -> bool:
    return day.weekday() in parse_days(template["days_of_week"])


def shift_interval(template: dict, day: date) -> tuple[datetime, datetime]:
    """Start and end of the shift that starts on `day`; end <= start means it ends the next day."""
    start = datetime.combine(day, time.fromisoformat(template["start_time"]), clock.IST)
    end = datetime.combine(day, time.fromisoformat(template["end_time"]), clock.IST)
    if end <= start:
        end += timedelta(days=1)
    return start, end


def intervals_overlap(a: tuple[datetime, datetime], b: tuple[datetime, datetime]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def fmt_day(d: date | str) -> str:
    d = date.fromisoformat(d) if isinstance(d, str) else d
    return d.strftime("%a %d %b %Y")


def fmt_range(start: date | str, end: date | str) -> str:
    return fmt_day(start) if start == end else f"{fmt_day(start)} – {fmt_day(end)}"


async def get_template(conn: aiosqlite.Connection, template_id: int) -> dict | None:
    return await db.fetch_one(
        conn,
        """SELECT s.*, t.name AS team_name FROM shift_templates s JOIN teams t ON t.id = s.team_id
            WHERE s.id = ?""",
        (template_id,),
    )


async def get_user(conn: aiosqlite.Connection, user_id: int) -> dict | None:
    return await db.fetch_one(
        conn,
        """SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id WHERE u.id = ?""",
        (user_id,),
    )


async def team_manager_id(conn: aiosqlite.Connection, team_id: int | None) -> int | None:
    """The team's active manager, or None."""
    if team_id is None:
        return None
    return await db.fetch_value(
        conn,
        """SELECT u.id FROM teams t JOIN users u ON u.id = t.manager_id
            WHERE t.id = ? AND u.active = 1 AND u.role = 'manager'""",
        (team_id,),
    )


async def hr_admin_ids(conn: aiosqlite.Connection) -> list[int]:
    rows = await db.fetch_all(conn, "SELECT id FROM users WHERE role = 'hr_admin' AND active = 1 ORDER BY id")
    return [r["id"] for r in rows]


def can_manage_team(user: dict, team_id: int) -> bool:
    """HR Admins manage every team; a manager manages the team they lead."""
    return user["role"] == "hr_admin" or (user["managed_team_id"] is not None and user["managed_team_id"] == team_id)
