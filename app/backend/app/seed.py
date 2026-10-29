"""P4 Seed: deterministic demo data relative to clock.today() (data model 5.5). P5 reset reuses it.

    python -m app.seed [--reset] [--db PATH]

Same ids every run. Every seeded user has the password `password123` and a fixed past password_changed_at, so
tokens survive a reset. Leave dates are chosen with the real coverage engine, so the seeded leave is exactly what
the app itself would have accepted.
"""

import argparse
import asyncio
from datetime import date, timedelta

import aiosqlite

from . import auth, clock, db
from .config import load_settings
from .services import accrual, audit, coverage
from .services.common import fmt_range

PASSWORD = "password123"
PASSWORD_CHANGED_AT = "2020-01-01T00:00:00+05:30"
EPOCH_MONDAY = date(2000, 1, 3)

HR = (1, "Asha Rao", "hr@example.com")
TEAMS = [
    # id, name, department, manager (id, name), employees [(id, name)]
    (1, "Customer Support", "Customer Experience", (2, "Meera Iyer"),
     [(3, "Arjun Mehta"), (4, "Priya Nair"), (5, "Karan Shah"), (6, "Neha Gupta"), (7, "Vikram Singh"),
      (8, "Sneha Patel"), (9, "Rohan Das"), (10, "Ananya Bose")]),
    (2, "Network Operations", "IT", (11, "Rahul Verma"),
     [(12, "Imran Khan"), (13, "Divya Menon"), (14, "Suresh Kumar"), (15, "Pooja Reddy")]),
    (3, "Billing", "Finance", (16, "Kavita Joshi"),
     [(17, "Amit Sharma"), (18, "Fatima Sheikh"), (19, "Deepak Rao")]),
]
LEAVE_TYPES = [(1, "Annual Leave", 18, 5), (2, "Sick Leave", 12, 0), (3, "Casual Leave", 6, 0)]
ANNUAL, SICK, CASUAL = 1, 2, 3
ALL_DAYS, WEEKDAYS, WEEKEND = "0,1,2,3,4,5,6", "0,1,2,3,4", "5,6"
TEMPLATES = [
    # id, team, name, start, end, days, min headcount
    (1, 1, "Morning", "06:00", "14:00", ALL_DAYS, 2),
    (2, 1, "Evening", "14:00", "22:00", ALL_DAYS, 2),
    (3, 1, "Night", "22:00", "06:00", ALL_DAYS, 1),
    (4, 2, "Day", "09:00", "18:00", WEEKDAYS, 2),
    (5, 2, "Weekend", "10:00", "18:00", WEEKEND, 1),
    (6, 3, "General", "09:30", "18:30", WEEKDAYS, 2),
]
TABLES_IN_DELETE_ORDER = [
    "audit_log", "notifications", "swap_requests", "leave_refund_days", "leave_removed_shifts", "balance_ledger",
    "leave_requests", "shift_assignments", "shift_templates", "users", "teams", "leave_types",
]

_hash_cache: dict[str, str] = {}


async def _password_hash() -> str:
    if PASSWORD not in _hash_cache:
        _hash_cache[PASSWORD] = await auth.hash_password(PASSWORD)
    return _hash_cache[PASSWORD]


def _email(name: str) -> str:
    return f"{name.split()[0].lower()}@example.com"


def _first_weekday_on_or_after(d: date, weekday: int) -> date:
    return d + timedelta(days=(weekday - d.weekday()) % 7)


async def seed(conn: aiosqlite.Connection) -> None:
    today = clock.today()
    stamp = f"{(today - timedelta(days=1)).isoformat()}T09:00:00+05:30"
    pw = await _password_hash()
    year, last = today.year, today.year - 1

    # ---- org ----------------------------------------------------------------------------------------------
    for team_id, name, dept, _, _ in TEAMS:
        await db.execute(conn, "INSERT INTO teams (id, name, department, created_at) VALUES (?, ?, ?, ?)",
                         (team_id, name, dept, stamp))
    users = [(HR[0], HR[1], HR[2], "hr_admin", None, f"{year - 4}-01-15")]
    for team_id, _, _, (mid, mname), employees in TEAMS:
        users.append((mid, mname, _email(mname), "manager", team_id, f"{year - 4}-06-01"))
        for i, (eid, ename) in enumerate(employees):
            users.append((eid, ename, _email(ename), "employee", team_id, f"{year - 3}-{(i % 9) + 1:02d}-01"))
    # one recent joiner, to show accrual starting in the join month
    recent = (10, f"{year}-{max(1, today.month - 3):02d}-01")
    for uid, name, email, role, team_id, joined in users:
        joined = recent[1] if uid == recent[0] else joined
        await db.execute(
            conn,
            """INSERT INTO users (id, name, email, password_hash, role, team_id, join_date, password_changed_at,
                                  created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (uid, name, email, pw, role, team_id, joined, PASSWORD_CHANGED_AT, stamp),
        )
    for team_id, _, _, (mid, _), _ in TEAMS:
        await db.execute(conn, "UPDATE teams SET manager_id = ? WHERE id = ?", (mid, team_id))
    for lt in LEAVE_TYPES:
        await db.execute(conn, "INSERT INTO leave_types (id, name, annual_entitlement, carry_forward_cap) VALUES (?, ?, ?, ?)", lt)
    for t in TEMPLATES:
        await db.execute(
            conn,
            """INSERT INTO shift_templates (id, team_id, name, start_time, end_time, days_of_week, min_headcount)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            t,
        )

    # ---- last year: accrual, leave taken, year-end close ----------------------------------------------------
    for month in range(1, 13):
        await accrual.run_monthly(conn, last, month, audited=False)
    past_leave = [
        (3, ANNUAL, _first_weekday_on_or_after(date(last, 8, 1), 0), 5, 2),   # Arjun, a week in August
        (4, SICK, _first_weekday_on_or_after(date(last, 3, 1), 1), 3, 2),     # Priya, Tue-Thu in March
        (11, ANNUAL, _first_weekday_on_or_after(date(last, 10, 1), 0), 4, 1),  # Rahul (manager -> HR approved)
        (17, CASUAL, _first_weekday_on_or_after(date(last, 12, 1), 3), 2, 16),  # Amit
    ]
    for user_id, type_id, start, days, approver in past_leave:
        await _approved_leave(conn, user_id, type_id, start, start + timedelta(days=days - 1), approver, stamp)
    await accrual.run_year_end(conn, last, audited=False)

    # ---- this year: accrual to date, one past leave --------------------------------------------------------
    for month in range(1, today.month + 1):
        await accrual.run_monthly(conn, year, month, audited=False)
    feb = _first_weekday_on_or_after(date(year, 2, 1), 0)
    if feb + timedelta(days=1) < today:
        await _approved_leave(conn, 7, CASUAL, feb, feb + timedelta(days=1), 2, stamp)  # Vikram

    # ---- four weeks of roster: last week, this week and the next two ----------------------------------------
    monday = today - timedelta(days=today.weekday())
    first, last_day = monday - timedelta(days=7), monday + timedelta(days=20)
    assignment_id = 0
    rows = []
    cs = [e[0] for e in TEAMS[0][4]]
    netops = [e[0] for e in TEAMS[1][4]]
    billing = [e[0] for e in TEAMS[2][4]]
    for day in clock.days(first, last_day):
        i = (day - EPOCH_MONDAY).days
        for slot in range(3):
            rows.append((cs[(i + slot) % 8], 1, day))         # Morning x3
        rows.append((cs[(i + 3) % 8], 2, day))                 # Evening x2
        if day != today:                                       # deliberate gap today: Evening 1 of 2
            rows.append((cs[(i + 4) % 8], 2, day))
        rows.append((cs[(i + 5) % 8], 3, day))                 # Night x1
        if day.weekday() < 5:
            for k in range(4):
                if k != i % 4:
                    rows.append((netops[k], 4, day))           # Day x3 (one off each weekday)
            for e in billing:
                rows.append((e, 6, day))                       # General x3
        else:
            rows.append((netops[i % 4], 5, day))               # Weekend x1
    for user_id, template_id, day in rows:
        assignment_id += 1
        await db.execute(
            conn,
            """INSERT INTO shift_assignments (id, user_id, shift_template_id, date, created_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (assignment_id, user_id, template_id, day.isoformat(), 2 if template_id <= 3 else 11 if template_id <= 5 else 16, stamp),
        )

    # ---- upcoming leave: Priya approved next week, Karan and Neha pending ------------------------------------
    next_monday = monday + timedelta(days=7)
    priya = await _window(conn, 4, next_monday, next_monday + timedelta(days=4), (2, 1))
    await _approved_leave(conn, 4, ANNUAL, priya[0], priya[1], 2, stamp, remove_shifts=True)
    week3 = monday + timedelta(days=14)
    for user_id, type_id in ((5, ANNUAL), (6, CASUAL)):
        start, end = await _window(conn, user_id, week3, week3 + timedelta(days=4), (2, 1))
        days = sum(1 for d in clock.days(start, end) if d.weekday() < 5)
        await db.execute(
            conn,
            """INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, reason, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (user_id, type_id, start.isoformat(), end.isoformat(), days, "Family function", stamp),
        )

    await audit.record(conn, None, "seed", "system", None, after={"today": today.isoformat()})


async def _window(conn: aiosqlite.Connection, user_id: int, first: date, last: date,
                  lengths: tuple[int, ...]) -> tuple[date, date]:
    """The earliest weekday window in [first, last] the user could take as leave without a coverage violation."""
    for length in lengths:
        for start in clock.days(first, last):
            end = start + timedelta(days=length - 1)
            if end > last or any(d.weekday() >= 5 for d in clock.days(start, end)):
                continue
            if not await coverage.leave_violations(conn, user_id, start, end):
                return start, end
    raise RuntimeError(f"seed: no leave window for user {user_id} between {first} and {last}")


async def _approved_leave(conn: aiosqlite.Connection, user_id: int, type_id: int, start: date, end: date,
                          approver: int, stamp: str, remove_shifts: bool = False) -> None:
    days = sum(1 for d in clock.days(start, end) if d.weekday() < 5)
    leave_id = await db.execute(
        conn,
        """INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, reason, status,
                                       decided_by, decided_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)""",
        (user_id, type_id, start.isoformat(), end.isoformat(), days, "Planned leave", approver, stamp, stamp),
    )
    await db.execute(
        conn,
        """INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, leave_request_id, reason,
                                       created_by, created_at)
           VALUES (?, ?, ?, 'leave_taken', ?, ?, ?, ?, ?)""",
        (user_id, type_id, start.year, -days, leave_id, f"Leave {fmt_range(start, end)}", approver, stamp),
    )
    if remove_shifts:
        shifts = await db.fetch_all(
            conn, "SELECT * FROM shift_assignments WHERE user_id = ? AND date BETWEEN ? AND ?",
            (user_id, start.isoformat(), end.isoformat()),
        )
        for a in shifts:
            await db.execute(
                conn,
                "INSERT INTO leave_removed_shifts (leave_request_id, user_id, shift_template_id, date) VALUES (?, ?, ?, ?)",
                (leave_id, user_id, a["shift_template_id"], a["date"]),
            )
            await db.execute(conn, "DELETE FROM shift_assignments WHERE id = ?", (a["id"],))


async def wipe(conn: aiosqlite.Connection) -> None:
    """Delete every row (the audit triggers are dropped for this and re-created)."""
    await db.execute(conn, "DROP TRIGGER IF EXISTS audit_log_no_update")
    await db.execute(conn, "DROP TRIGGER IF EXISTS audit_log_no_delete")
    await db.execute(conn, "UPDATE teams SET manager_id = NULL")
    for table in TABLES_IN_DELETE_ORDER:
        await db.execute(conn, f"DELETE FROM {table}")
    for statement in db.audit_trigger_statements():
        await db.execute(conn, statement)


async def reset(conn: aiosqlite.Connection) -> None:
    await wipe(conn)
    await seed(conn)


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Load the demo data")
    parser.add_argument("--reset", action="store_true", help="delete all existing data first")
    parser.add_argument("--db", help="SQLite file (default: LSM_DB_PATH or app/backend/data/app.db)")
    args = parser.parse_args()
    settings = load_settings()
    clock.set_today(settings.today)
    auth.configure(settings.jwt_secret, settings.jwt_hours, settings.cookie_secure, settings.bcrypt_rounds)
    db.configure(args.db or settings.db_path)
    conn = await db.connect()
    try:
        await db.init_db(conn)
        await conn.execute("BEGIN IMMEDIATE")
        if await db.fetch_value(conn, "SELECT 1 FROM users LIMIT 1") and not args.reset:
            await conn.rollback()
            raise SystemExit("The database already has data. Use --reset to replace it.")
        await reset(conn)
        await conn.commit()
    finally:
        await conn.close()
    print(f"Seeded {args.db or settings.db_path} for {clock.today()} — every user's password is {PASSWORD}")


if __name__ == "__main__":
    asyncio.run(_main())
