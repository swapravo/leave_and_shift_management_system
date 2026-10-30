"""C6 Birthday leave: a bonus day of Casual Leave, booked automatically on the person's birthday.

For each active employee or manager with a date of birth, the system books one day of Casual Leave on their birthday
(the nearest working day when it falls on a weekend), a few weeks ahead so the roster can plan for it:

  * +1 Casual Leave is credited, then the day is taken, so it never uses up their normal Casual days.
  * The leave is approved on the spot (there is no approver), and their shift that day comes off the roster. If that
    leaves a shift below its minimum, the manager gets the usual coverage notice.
  * If they are already on leave that day, the +1 day is still credited and nothing is booked.
  * A birthday is granted once. `birthday_grants` remembers it even if the person later cancels the leave.
"""

from datetime import date, timedelta

import aiosqlite

from .. import clock, db
from . import audit, coverage
from .common import fmt_day, hr_admin_ids, team_manager_id
from .notify import notify

LEAVE_TYPE_NAME = "Casual Leave"
REASON = "Birthday leave"  # also what the schema allows to be approved without an approver
LOOKAHEAD_DAYS = 30


def booking_date(birthday: date, year: int) -> date:
    """The working day that carries the birthday in `year`: 29 Feb becomes 28 Feb in a common year, Saturday moves to
    the Friday before and Sunday to the Monday after."""
    try:
        day = date(year, birthday.month, birthday.day)
    except ValueError:
        day = date(year, 2, 28)
    if day.weekday() == 5:
        return day - timedelta(days=1)
    if day.weekday() == 6:
        return day + timedelta(days=1)
    return day


async def _leave_type(conn: aiosqlite.Connection) -> dict | None:
    return await db.fetch_one(conn, "SELECT * FROM leave_types WHERE name = ? AND active = 1", (LEAVE_TYPE_NAME,))


async def run(conn: aiosqlite.Connection, user_id: int | None = None) -> int:
    """Grant every birthday leave that is due and not yet granted. Idempotent; returns how many people were granted."""
    leave_type = await _leave_type(conn)
    if leave_type is None:
        return 0
    today = clock.today()
    horizon = today + timedelta(days=LOOKAHEAD_DAYS)
    users = await db.fetch_all(
        conn,
        """SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id
            WHERE u.active = 1 AND u.role IN ('employee', 'manager') AND u.date_of_birth IS NOT NULL
              AND (? IS NULL OR u.id = ?) ORDER BY u.id""",
        (user_id, user_id),
    )
    granted = 0
    for user in users:
        birthday = date.fromisoformat(user["date_of_birth"])
        for year in sorted({today.year, horizon.year}):
            day = booking_date(birthday, year)
            if not (today <= day <= horizon) or day.isoformat() < user["join_date"]:
                continue
            if await db.fetch_value(conn, "SELECT 1 FROM birthday_grants WHERE user_id = ? AND year = ?", (user["id"], year)):
                continue
            await _grant(conn, user, leave_type, year, day)
            granted += 1
    return granted


async def _grant(conn: aiosqlite.Connection, user: dict, leave_type: dict, year: int, day: date) -> None:
    from . import roster

    now = clock.now_iso()
    iso = day.isoformat()
    team_id = user["team_id"]
    await db.execute(
        conn,
        """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, reason, created_at)
           VALUES (?, ?, ?, 'adjustment', 1, ?, ?)""",
        (user["id"], leave_type["id"], day.year, "Birthday bonus day", now),
    )
    busy = await db.fetch_one(
        conn,
        """SELECT 1 FROM leave_requests WHERE user_id = ? AND status IN ('pending', 'approved')
              AND start_date <= ? AND end_date >= ?""",
        (user["id"], iso, iso),
    )
    leave_id = None
    removed = 0
    short = []
    if busy is None:
        short = await coverage.leave_violations(conn, user["id"], day, day)  # before the leave exists
        leave_id = await db.execute(
            conn,
            """INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, reason, status,
                                           decided_at, decision_comment, created_at)
               VALUES (?, ?, ?, ?, 1, ?, 'approved', ?, 'Added automatically for your birthday', ?)""",
            (user["id"], leave_type["id"], iso, iso, REASON, now, now),
        )
        await db.execute(
            conn,
            """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, leave_request_id, reason, created_at)
               VALUES (?, ?, ?, 'leave_taken', -1, ?, ?, ?)""",
            (user["id"], leave_type["id"], day.year, leave_id, f"Leave {fmt_day(day)}", now),
        )
        assignments = await db.fetch_all(
            conn, "SELECT * FROM shift_assignments WHERE user_id = ? AND date = ? ORDER BY id", (user["id"], iso)
        )
        for a in assignments:
            await db.execute(
                conn,
                "INSERT INTO leave_removed_shifts (leave_request_id, user_id, shift_template_id, date) VALUES (?, ?, ?, ?)",
                (leave_id, a["user_id"], a["shift_template_id"], a["date"]),
            )
        await roster.remove_assignments(conn, assignments, "On birthday leave", None, notify_user=False)
        removed = len(assignments)
    await db.execute(
        conn, "INSERT INTO birthday_grants (user_id, year, leave_request_id, created_at) VALUES (?, ?, ?, ?)",
        (user["id"], year, leave_id, now),
    )
    await audit.record(
        conn, None, "leave.birthday", "leave_request" if leave_id else "user", leave_id or user["id"],
        after={"user_id": user["id"], "date": iso, "leave_type": leave_type["name"], "booked": leave_id is not None,
               "shifts_removed": removed},
        team_id=team_id,
    )

    if leave_id is None:
        await notify(conn, [user["id"]], "leave",
                     f"Happy birthday! You're already on leave on {fmt_day(day)}, so a bonus {leave_type['name']} day "
                     f"was added to your balance to use whenever you like.", "/requests")
        return
    shifts = ("" if not removed else " Your shift that day was taken off your roster." if removed == 1
              else f" Your {removed} shifts that day were taken off your roster.")
    await notify(conn, [user["id"]], "leave",
                 f"Happy birthday! {fmt_day(day)} is booked as a bonus {leave_type['name']} day, on top of your usual "
                 f"days.{shifts}", "/requests")
    manager_id = await team_manager_id(conn, team_id) if user["role"] == "employee" else None
    watchers = [manager_id] if manager_id is not None else (await hr_admin_ids(conn) if user["role"] == "manager" else [])
    await notify(conn, watchers, "leave",
                 f"{user['name']} is on birthday leave on {fmt_day(day)} (added automatically).", "/calendar")
    for v in short:  # the same wording the roster uses when a removal leaves a shift short
        await notify(conn, watchers, "coverage",
                     f"{v['shift_name']} on {fmt_day(v['date'])} is below minimum "
                     f"({v['headcount_without_you']} of {v['min_headcount']})", "/roster")
