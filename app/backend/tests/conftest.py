"""Fixtures: a fresh temporary database per test, "today" pinned to Wed 2026-06-10 08:00 IST, and a small org.

Org (all passwords `password123`, joined 2025-01-01, so each has 6.0 Annual days accrued Jan-Jun 2026):
  1 Hana (HR Admin)
  team 1 "Ops":   2 Mona (manager), 3 Eve, 4 Ed, 5 Esa (employees)
  team 2 "Other": 6 Oscar (manager), 7 Olga (employee)
  leave type 1 "Annual" 12/year, cap 5
  shift 1 "Day" 09:00-17:00 every day, min 2 (team 1)
  shift 2 "Night" 22:00-06:00 every day, min 0 (team 1)
  shift 3 "Other Day" 09:00-17:00 Mon-Fri, min 1 (team 2)
"""

import sqlite3
from dataclasses import dataclass
from datetime import date, time
from pathlib import Path

import bcrypt
import pytest
from fastapi.testclient import TestClient

from app import clock
from app.config import Settings
from app.db import SCHEMA_PATH
from app.main import create_app

TODAY = date(2026, 6, 10)  # a Wednesday
PASSWORD = "password123"
PCA = "2020-01-01T00:00:00+05:30"
STAMP = "2026-06-01T09:00:00+05:30"
HASH = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()

HR, MONA, EVE, ED, ESA, OSCAR, OLGA = 1, 2, 3, 4, 5, 6, 7
DAY, NIGHT, OTHER_DAY = 1, 2, 3
ANNUAL = 1
EMAILS = {HR: "hana@t.io", MONA: "mona@t.io", EVE: "eve@t.io", ED: "ed@t.io", ESA: "esa@t.io",
          OSCAR: "oscar@t.io", OLGA: "olga@t.io"}


def d(text: str) -> date:
    return date.fromisoformat(text)


class Client:
    """A signed-in user. Each has its own cookie jar."""

    def __init__(self, app, email: str):
        self.http = TestClient(app)
        r = self.http.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        self.me = r.json()

    def get(self, url, **params):
        return self.http.get(url, params=params) if params else self.http.get(url)

    def post(self, url, json=None):
        return self.http.post(url, json=json)

    def patch(self, url, json):
        return self.http.patch(url, json=json)

    def delete(self, url):
        return self.http.delete(url)


@dataclass
class World:
    app: object
    db_path: Path

    def login(self, user_id: int) -> Client:
        return Client(self.app, EMAILS[user_id])

    def sql(self, query: str, params=()) -> list[dict]:
        conn = sqlite3.connect(self.db_path, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            return [dict(r) for r in conn.execute(query, params).fetchall()]
        finally:
            conn.close()

    def one(self, query: str, params=()):
        rows = self.sql(query, params)
        return next(iter(rows[0].values())) if rows else None

    def roster(self, user_id: int, day: str, template_id: int = DAY) -> int:
        conn = sqlite3.connect(self.db_path, isolation_level=None)
        try:
            cur = conn.execute(
                "INSERT INTO shift_assignments (user_id, shift_template_id, date, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, template_id, day, MONA, STAMP),
            )
            return cur.lastrowid
        finally:
            conn.close()

    def leave(self, user_id: int, start: str, end: str, status: str = "approved", days: float | None = None) -> int:
        """Insert a leave request directly (no ledger rows), for coverage/guard set-ups."""
        days = days if days is not None else sum(1 for x in clock.days(d(start), d(end)) if x.weekday() < 5) or 1
        decided = (MONA, STAMP) if status in ("approved", "rejected") else (None, None)
        conn = sqlite3.connect(self.db_path, isolation_level=None)
        try:
            cur = conn.execute(
                """INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, status, decided_by,
                                               decided_at, decision_comment, created_at)
                   VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (user_id, start, end, days, status, *decided, "no" if status == "rejected" else None, STAMP),
            )
            return cur.lastrowid
        finally:
            conn.close()

    def balance(self, user_id: int, year: int = 2026, type_id: int = ANNUAL) -> float:
        return round(self.one("SELECT COALESCE(SUM(amount), 0) FROM balance_ledger WHERE user_id = ? AND year = ? AND leave_type_id = ?",
                              (user_id, year, type_id)), 2)


def build_org(path: Path) -> None:
    conn = sqlite3.connect(path, isolation_level=None)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA_PATH.read_text())
    conn.executescript(
        f"""
        INSERT INTO teams (id, name, department, created_at) VALUES (1, 'Ops', 'Operations', '{STAMP}'),
                                                                   (2, 'Other', 'Elsewhere', '{STAMP}');
        INSERT INTO leave_types (id, name, annual_entitlement, carry_forward_cap) VALUES (1, 'Annual', 12, 5);
        INSERT INTO shift_templates (id, team_id, name, start_time, end_time, days_of_week, min_headcount) VALUES
            (1, 1, 'Day', '09:00', '17:00', '0,1,2,3,4,5,6', 2),
            (2, 1, 'Night', '22:00', '06:00', '0,1,2,3,4,5,6', 0),
            (3, 2, 'Other Day', '09:00', '17:00', '0,1,2,3,4', 1);
        """
    )
    users = [
        (HR, "Hana", "hr_admin", None), (MONA, "Mona", "manager", 1), (EVE, "Eve", "employee", 1),
        (ED, "Ed", "employee", 1), (ESA, "Esa", "employee", 1), (OSCAR, "Oscar", "manager", 2),
        (OLGA, "Olga", "employee", 2),
    ]
    for uid, name, role, team in users:
        conn.execute(
            """INSERT INTO users (id, name, email, password_hash, role, team_id, join_date, password_changed_at,
                                  created_at) VALUES (?, ?, ?, ?, ?, ?, '2025-01-01', ?, ?)""",
            (uid, name, EMAILS[uid], HASH, role, team, PCA, STAMP),
        )
    conn.execute("UPDATE teams SET manager_id = 2 WHERE id = 1")
    conn.execute("UPDATE teams SET manager_id = 6 WHERE id = 2")
    conn.close()


def settings_for(tmp_path: Path, test_mode: bool = True) -> Settings:
    return Settings(
        db_path=str(tmp_path / "test.db"),
        jwt_secret="test-secret-that-is-at-least-32-bytes-long",
        jwt_hours=8,
        cookie_secure=False,
        today=TODAY,
        test_mode=test_mode,
        bcrypt_rounds=4,
        frontend_dist=tmp_path / "no-frontend",
    )


@pytest.fixture
def world(tmp_path):
    build_org(tmp_path / "test.db")
    app = create_app(settings_for(tmp_path))
    clock.set_time(time(8, 0))
    with TestClient(app):  # runs startup: accrual catch-up credits Jan-Jun
        yield World(app, tmp_path / "test.db")
    clock.set_today(None)
    clock.set_time(None)


@pytest.fixture
def hr(world):
    return world.login(HR)


@pytest.fixture
def mona(world):
    return world.login(MONA)


@pytest.fixture
def eve(world):
    return world.login(EVE)


@pytest.fixture
def ed(world):
    return world.login(ED)


@pytest.fixture
def oscar(world):
    return world.login(OSCAR)
