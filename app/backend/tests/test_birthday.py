"""C6 Birthday leave: a bonus Casual Leave day booked on the person's birthday. Today is Wed 2026-06-10."""

import asyncio
import sqlite3

import pytest

from app.db import SCHEMA_PATH, connect, init_db
from app.services import birthday
from app.services.birthday import booking_date

from .conftest import DAY, ED, EVE, HR, MONA, d

CASUAL = 2


@pytest.fixture
def casual(world, hr):
    """A Casual Leave type with Jan-Jun accrued, so a person starts with 6.0 days."""
    world.sql("INSERT INTO leave_types (id, name, annual_entitlement, carry_forward_cap) VALUES (2, 'Casual Leave', 12, 0)")
    for month in range(1, 7):
        hr.post("/api/accrual/monthly", {"year": 2026, "month": month})
    assert world.balance(EVE, type_id=CASUAL) == 6.0


def set_birth(hr, user_id: int, dob: str | None):
    return hr.patch(f"/api/users/{user_id}", {"date_of_birth": dob})


def run_everyone(world) -> int:
    """What the hourly housekeeping and startup do: look at everyone, not just one person."""
    async def go():
        conn = await connect(str(world.db_path))
        try:
            await conn.execute("BEGIN IMMEDIATE")
            n = await birthday.run(conn)
            await conn.commit()
            return n
        finally:
            await conn.close()
    return asyncio.run(go())


def birthday_leave(world, user_id: int):
    return world.sql("SELECT * FROM leave_requests WHERE user_id = ? AND reason = 'Birthday leave'", (user_id,))


# ------------------------------------------------------------------------------------------ which day it lands on
@pytest.mark.parametrize("born,year,expected", [
    ("1995-06-24", 2026, "2026-06-24"),   # a Wednesday: as is
    ("1995-06-27", 2026, "2026-06-26"),   # a Saturday: the Friday before
    ("1995-06-28", 2026, "2026-06-29"),   # a Sunday: the Monday after
    ("1996-02-29", 2027, "2027-03-01"),   # 29 Feb in a common year is 28 Feb, a Sunday: the Monday after
    ("1996-02-29", 2028, "2028-02-29"),   # a leap year keeps 29 Feb, a Tuesday
])
def test_booking_date(born, year, expected):
    assert booking_date(d(born), year).isoformat() == expected


# ------------------------------------------------------------------------------------------ the grant
def test_a_birthday_inside_the_window_books_an_approved_bonus_day(world, hr, casual):
    r = set_birth(hr, EVE, "1995-06-24")
    assert r.status_code == 200 and r.json()["date_of_birth"] == "1995-06-24"
    [leave] = birthday_leave(world, EVE)
    assert (leave["start_date"], leave["end_date"], leave["days"], leave["status"]) == ("2026-06-24", "2026-06-24", 1, "approved")
    assert leave["leave_type_id"] == CASUAL and leave["decided_by"] is None
    # +1 bonus then -1 taken: the normal 6 days are untouched
    kinds = world.sql("SELECT kind, amount FROM balance_ledger WHERE user_id = ? AND leave_type_id = ? AND kind IN ('adjustment', 'leave_taken')", (EVE, CASUAL))
    assert sorted((k["kind"], k["amount"]) for k in kinds) == [("adjustment", 1.0), ("leave_taken", -1.0)]
    assert world.balance(EVE, type_id=CASUAL) == 6.0
    assert world.one("SELECT COUNT(*) FROM birthday_grants WHERE user_id = ?", (EVE,)) == 1


def test_it_reads_as_approved_leave_to_the_person_and_the_calendar(world, hr, casual, eve):
    set_birth(hr, EVE, "1995-06-24")
    mine = [r for r in eve.get("/api/leave-requests", scope="mine").json() if r["reason"] == "Birthday leave"]
    assert len(mine) == 1 and mine[0]["status"] == "approved" and mine[0]["decided_by_name"] is None
    cal = eve.get("/api/calendar", start="2026-06-22", end="2026-06-28").json()
    assert any(l["user_id"] == EVE and l["start_date"] == "2026-06-24" and l["status"] == "approved" for l in cal["leaves"])
    assert eve.get("/api/auth/me").json()["today"] == "2026-06-10"


def test_a_weekend_birthday_moves_to_the_nearest_working_day(world, hr, casual):
    set_birth(hr, EVE, "1995-06-27")
    set_birth(hr, ED, "1995-06-28")
    assert [r["start_date"] for r in birthday_leave(world, EVE)] == ["2026-06-26"]
    assert [r["start_date"] for r in birthday_leave(world, ED)] == ["2026-06-29"]


def test_the_shift_that_day_comes_off_the_roster_and_the_manager_is_warned_if_it_leaves_it_short(world, hr, casual):
    world.roster(EVE, "2026-06-24")
    world.roster(ED, "2026-06-24")           # Day needs 2: without Eve it has 1
    set_birth(hr, EVE, "1995-06-24")
    assert world.one("SELECT COUNT(*) FROM shift_assignments WHERE user_id = ? AND date = '2026-06-24'", (EVE,)) == 0
    assert world.one("SELECT COUNT(*) FROM leave_removed_shifts WHERE user_id = ? AND date = '2026-06-24'", (EVE,)) == 1
    notes = world.sql("SELECT kind, message FROM notifications WHERE user_id = ? ORDER BY id", (MONA,))
    assert any(n["kind"] == "coverage" and "below minimum" in n["message"] for n in notes)
    assert any("birthday leave" in n["message"] and "Eve" in n["message"] for n in notes)
    mine = world.sql("SELECT message FROM notifications WHERE user_id = ?", (EVE,))
    assert any("Happy birthday" in n["message"] and "bonus Casual Leave day" in n["message"] for n in mine)


def test_the_grant_is_audited_as_the_system(world, hr, casual):
    set_birth(hr, EVE, "1995-06-24")
    [entry] = world.sql("SELECT actor_id, actor_name, entity_type FROM audit_log WHERE action = 'leave.birthday'")
    assert entry["actor_id"] is None and entry["actor_name"] == "System" and entry["entity_type"] == "leave_request"


# ------------------------------------------------------------------------------------------ once only
def test_it_is_granted_once_even_after_the_leave_is_cancelled(world, hr, casual, eve):
    set_birth(hr, EVE, "1995-06-24")
    [leave] = birthday_leave(world, EVE)
    assert eve.post(f"/api/leave-requests/{leave['id']}/cancel").status_code == 200
    hr.patch(f"/api/users/{EVE}", {"name": "Eve Again"})   # any update looks at birthdays again
    set_birth(hr, EVE, "1995-06-24")
    assert len(birthday_leave(world, EVE)) == 1
    assert world.one("SELECT COUNT(*) FROM birthday_grants WHERE user_id = ?", (EVE,)) == 1
    # cancelling gave the day back: the bonus stays in the balance for Eve to use when she likes
    assert world.balance(EVE, type_id=CASUAL) == 7.0


@pytest.mark.parametrize("born", ["1995-06-01", "1995-08-15", "1995-07-14"])
def test_birthdays_in_the_past_or_beyond_the_window_are_not_booked_yet(world, hr, casual, born):
    set_birth(hr, EVE, born)
    assert birthday_leave(world, EVE) == []
    assert world.one("SELECT COUNT(*) FROM birthday_grants") == 0


def test_the_last_day_of_the_window_is_included(world, hr, casual):
    set_birth(hr, EVE, "1995-07-10")   # exactly 30 days ahead
    assert [r["start_date"] for r in birthday_leave(world, EVE)] == ["2026-07-10"]


def test_someone_already_on_leave_that_day_just_gets_the_bonus_day(world, hr, casual):
    world.leave(EVE, "2026-06-22", "2026-06-26")
    set_birth(hr, EVE, "1995-06-24")
    assert birthday_leave(world, EVE) == []
    assert world.balance(EVE, type_id=CASUAL) == 7.0
    assert world.one("SELECT leave_request_id FROM birthday_grants WHERE user_id = ?", (EVE,)) is None
    assert world.one("SELECT COUNT(*) FROM birthday_grants WHERE user_id = ?", (EVE,)) == 1
    notes = world.sql("SELECT message FROM notifications WHERE user_id = ?", (EVE,))
    assert any("already on leave" in n["message"] for n in notes)


# ------------------------------------------------------------------------------------------ who gets it
def test_hr_admins_and_deactivated_users_get_none(world, hr, casual):
    hr.delete(f"/api/users/{ED}")
    world.sql("UPDATE users SET date_of_birth = '1995-06-24' WHERE id IN (?, ?)", (ED, HR))
    assert run_everyone(world) == 0
    assert world.one("SELECT COUNT(*) FROM leave_requests WHERE reason = 'Birthday leave'") == 0


def test_nothing_happens_without_a_casual_leave_type(world, hr):
    set_birth(hr, EVE, "1995-06-24")
    assert world.one("SELECT COUNT(*) FROM leave_requests WHERE reason = 'Birthday leave'") == 0
    world.sql("INSERT INTO leave_types (id, name, annual_entitlement, carry_forward_cap, active) VALUES (2, 'Casual Leave', 12, 0, 0)")
    set_birth(hr, EVE, "1995-06-24")   # archived: still nothing
    assert world.one("SELECT COUNT(*) FROM leave_requests WHERE reason = 'Birthday leave'") == 0


def test_a_manager_s_birthday_notifies_hr(world, hr, casual):
    set_birth(hr, MONA, "1985-06-24")
    assert len(birthday_leave(world, MONA)) == 1
    assert any("Mona" in n["message"] for n in world.sql("SELECT message FROM notifications WHERE user_id = ?", (HR,)))


# ------------------------------------------------------------------------------------------ the date of birth itself
def test_date_of_birth_must_be_in_the_past(hr, world):
    assert set_birth(hr, EVE, "2026-06-10").status_code == 400
    assert set_birth(hr, EVE, "2030-01-01").status_code == 400
    assert set_birth(hr, EVE, "1899-12-31").status_code == 400


def test_the_hourly_pass_finds_birthdays_that_come_into_range(world, hr, casual):
    world.sql("UPDATE users SET date_of_birth = '1995-07-20' WHERE id = ?", (EVE,))   # 40 days away: not yet
    assert run_everyone(world) == 0
    from app import clock
    clock.set_today(d("2026-06-25"))                                                   # 25 days away: now
    assert run_everyone(world) == 1 and run_everyone(world) == 0
    assert [r["start_date"] for r in birthday_leave(world, EVE)] == ["2026-07-20"]


def test_it_can_be_set_on_create_changed_and_cleared(world, hr, casual):
    r = hr.post("/api/users", {"name": "Zed", "email": "zed@t.io", "role": "employee", "team_id": 1,
                               "password": "password123", "date_of_birth": "1999-06-24"})
    assert r.status_code == 201 and r.json()["date_of_birth"] == "1999-06-24"
    assert len(birthday_leave(world, r.json()["id"])) == 1
    assert set_birth(hr, EVE, "1995-03-01").json()["date_of_birth"] == "1995-03-01"
    assert set_birth(hr, EVE, None).json()["date_of_birth"] is None


def test_only_hr_can_see_dates_of_birth(world, hr, eve, casual):
    set_birth(hr, ED, "1995-03-01")
    assert eve.get("/api/users").status_code == 403
    assert eve.get("/api/auth/me").json().get("date_of_birth") is None
    assert next(u for u in hr.get("/api/users").json() if u["id"] == ED)["date_of_birth"] == "1995-03-01"


# ------------------------------------------------------------------------------------------ the schema
def test_only_the_birthday_grant_can_be_approved_without_an_approver(world):
    approve = ("INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, reason, status, decided_at, created_at) "
               "VALUES (3, 1, '2026-06-24', '2026-06-24', 1, ?, 'approved', '2026-06-10T08:00:00+05:30', '2026-06-10T08:00:00+05:30')")
    conn = sqlite3.connect(world.db_path, isolation_level=None)
    conn.execute(approve, ("Birthday leave",))
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(approve, ("Because I said so",))
    conn.close()


def test_an_older_database_is_upgraded_in_place(tmp_path):
    """A database made before birthday leave gets the new column and the relaxed check, and keeps its rows."""
    schema = SCHEMA_PATH.read_text()
    old = (schema
           .replace("    date_of_birth       TEXT    CHECK (date_of_birth IS NULL OR date(date_of_birth) IS date_of_birth),  -- birthday leave\n", "")
           .replace("    CHECK (status NOT IN ('approved', 'rejected') OR decided_at IS NOT NULL),\n"
                    "    CHECK (status <> 'rejected' OR decided_by IS NOT NULL),\n", "")
           .replace("    CHECK (status <> 'approved' OR decided_by IS NOT NULL OR reason = 'Birthday leave'),\n",
                    "    CHECK (status NOT IN ('approved', 'rejected') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)),\n")
           .replace("VALUES ('schema_version', '2')", "VALUES ('schema_version', '1')"))
    assert old != schema and "date_of_birth" not in old
    path = tmp_path / "old.db"
    raw = sqlite3.connect(path, isolation_level=None)
    raw.executescript(old)
    raw.executescript(
        """INSERT INTO teams (id, name, created_at) VALUES (1, 'Ops', 'x');
           INSERT INTO leave_types (id, name, annual_entitlement, carry_forward_cap) VALUES (1, 'Annual', 12, 0);
           INSERT INTO users (id, name, email, password_hash, role, team_id, join_date, password_changed_at, created_at)
                VALUES (3, 'Eve', 'eve@t.io', 'h', 'employee', 1, '2025-01-01', 'x', 'x');
           INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, days, status, decided_by, decided_at, created_at)
                VALUES (1, 3, 1, '2026-06-15', '2026-06-15', 1, 'approved', 3, 'x', 'x');
           INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, leave_request_id, created_at)
                VALUES (3, 1, 2026, 'leave_taken', -1, 1, 'x');"""
    )
    raw.close()

    async def upgrade():
        conn = await connect(str(path))
        try:
            await init_db(conn)
            await init_db(conn)  # and again: a no-op on a current database
        finally:
            await conn.close()

    asyncio.run(upgrade())
    db = sqlite3.connect(path, isolation_level=None)
    db.execute("PRAGMA foreign_keys = ON")
    assert db.execute("SELECT value FROM schema_meta").fetchall() == [("2",)]
    assert db.execute("SELECT date_of_birth FROM users WHERE id = 3").fetchall() == [(None,)]
    assert db.execute("SELECT id, status FROM leave_requests").fetchall() == [(1, "approved")]
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    assert {r[1] for r in db.execute("PRAGMA index_list(leave_requests)")} >= {"ix_leave_user_status", "ix_leave_dates"}
    db.execute("""INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, reason, status, decided_at, created_at)
                  VALUES (3, 1, '2026-06-24', '2026-06-24', 1, 'Birthday leave', 'approved', 'x', 'x')""")
    db.close()
