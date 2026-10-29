"""C10 Read Models (calendar, dashboard), C11 Audit Log, C12 Notifications."""

import sqlite3

import pytest

from .conftest import DAY, ED, ESA, EVE, HR, MONA, OLGA, OSCAR


# ----------------------------------------------------------------------------------------- dashboard
def test_brd3_manager_sees_todays_gaps_and_pending_approvals_in_one_view(world, mona):
    world.roster(EVE, "2026-06-10")  # Day today: 1 of 2
    world.roster(ED, "2026-06-12")
    world.roster(ESA, "2026-06-12")
    eve = world.login(EVE)
    leave_id = eve.post("/api/leave-requests", {"leave_type_id": 1, "start_date": "2026-06-22",
                                                 "end_date": "2026-06-22"}).json()["id"]
    dash = mona.get("/api/dashboard").json()
    assert dash["today"] == "2026-06-10"
    assert [(g["shift_name"], g["headcount"], g["min_headcount"]) for g in dash["gaps_today"]] == [("Day", 1, 2)]
    assert [p["id"] for p in dash["pending_leave"]] == [leave_id]
    assert dash["pending_leave"][0]["can_decide"]
    upcoming = {(g["date"], g["shift_name"]) for g in dash["upcoming_gaps"]}
    assert ("2026-06-11", "Day") in upcoming and ("2026-06-12", "Day") not in upcoming
    assert ("2026-06-17", "Day") in upcoming and ("2026-06-18", "Day") not in upcoming  # next 7 days only
    assert dash["teams"] == [{"id": 1, "name": "Ops"}]


def test_dashboard_availability(world, mona):
    world.roster(EVE, "2026-06-10")
    world.leave(ED, "2026-06-10", "2026-06-10", "approved")
    world.leave(ESA, "2026-06-10", "2026-06-10", "pending")
    avail = {a["name"]: a for a in mona.get("/api/dashboard").json()["availability"]}
    assert avail["Eve"]["status"] == "on_shift" and avail["Eve"]["shifts"] == ["Day 09:00-17:00"]
    assert avail["Ed"]["status"] == "on_leave"
    assert avail["Esa"]["status"] == "off" and avail["Esa"]["pending_leave_today"] is True
    assert avail["Mona"]["status"] == "off"
    assert "Olga" not in avail


def test_hr_dashboard_covers_all_teams_and_manager_leave(world, hr, mona):
    leave_id = mona.post("/api/leave-requests", {"leave_type_id": 1, "start_date": "2026-06-22",
                                                  "end_date": "2026-06-22"}).json()["id"]
    dash = hr.get("/api/dashboard").json()
    assert [t["name"] for t in dash["teams"]] == ["Ops", "Other"]
    assert [p["id"] for p in dash["pending_leave"]] == [leave_id]
    assert {a["name"] for a in dash["availability"]} == {"Mona", "Eve", "Ed", "Esa", "Oscar", "Olga"}


def test_inline_decision_from_the_dashboard_updates_it(world, mona):
    eve = world.login(EVE)
    leave_id = eve.post("/api/leave-requests", {"leave_type_id": 1, "start_date": "2026-06-22",
                                                 "end_date": "2026-06-22"}).json()["id"]
    mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": False, "comment": "Busy"})
    assert mona.get("/api/dashboard").json()["pending_leave"] == []


def test_employees_have_no_dashboard(eve):
    assert eve.get("/api/dashboard").status_code == 403


# ----------------------------------------------------------------------------------------- calendar
def test_calendar_combines_leave_and_coverage(world, eve):
    world.roster(ED, "2026-06-15")
    world.leave(ED, "2026-06-15", "2026-06-16", "approved")
    world.leave(ESA, "2026-06-17", "2026-06-17", "pending")
    cal = eve.get("/api/calendar", start="2026-06-15", end="2026-06-21").json()
    assert cal["teams"] == [{"id": 1, "name": "Ops", "department": "Operations"}]
    assert [(lv["user_name"], lv["status"]) for lv in cal["leaves"]] == [("Ed", "approved"), ("Esa", "pending")]
    day15 = next(c for c in cal["cells"] if c["date"] == "2026-06-15" and c["shift_template_id"] == DAY)
    assert day15["headcount"] == 0 and day15["gap"] and day15["assigned"][0]["leave_status"] == "approved"
    assert len(cal["cells"]) == 14  # Day + Night, 7 days


def test_calendar_team_access(world, eve, hr):
    assert eve.get("/api/calendar", start="2026-06-15", end="2026-06-21", team_id=2).status_code == 403
    assert eve.get("/api/calendar", start="2026-06-15", end="2026-06-21", team_id=1).status_code == 200
    every = hr.get("/api/calendar", start="2026-06-15", end="2026-06-21").json()
    assert [t["name"] for t in every["teams"]] == ["Ops", "Other"]
    assert [t["name"] for t in hr.get("/api/calendar", start="2026-06-15", end="2026-06-21", team_id=2).json()["teams"]] == ["Other"]
    assert eve.get("/api/calendar", start="2026-06-01", end="2026-08-02").status_code == 400  # > 62 days


# ----------------------------------------------------------------------------------------- audit
def test_audit_rows_for_writes_and_manager_scope(world, hr, mona):
    world.roster(EVE, "2026-06-15")
    world.roster(ED, "2026-06-15")
    world.roster(ESA, "2026-06-15")
    eve = world.login(EVE)
    leave_id = eve.post("/api/leave-requests", {"leave_type_id": 1, "start_date": "2026-06-15",
                                                 "end_date": "2026-06-15"}).json()["id"]
    mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    hr.post("/api/teams", {"name": "Field"})
    page = hr.get("/api/audit", entity_type="leave_request").json()
    approve = page["entries"][0]
    assert (approve["action"], approve["actor_name"], approve["entity_id"]) == ("leave.approve", "Mona", leave_id)
    assert approve["before"]["status"] == "pending" and approve["after"]["status"] == "approved"
    mona_view = mona.get("/api/audit", limit=500).json()["entries"]
    assert mona_view and all(e["team_id"] == 1 for e in mona_view)
    assert not any(e["action"] == "team.create" for e in mona_view)
    assert world.login(OSCAR).get("/api/audit", entity_type="leave_request").json()["total"] == 0
    assert eve.get("/api/audit").status_code == 403
    assert hr.get("/api/audit", limit=0).status_code == 400
    assert hr.get("/api/audit", actor_id=MONA).json()["entries"][0]["actor_id"] == MONA


def test_audit_never_stores_password_hashes(world, hr):
    hr.post("/api/users", {"name": "Nia", "email": "nia@t.io", "role": "employee", "team_id": 1,
                           "password": "password123"})
    hr.patch(f"/api/users/{EVE}", {"password": "another-pass"})
    blobs = " ".join((r["before_json"] or "") + (r["after_json"] or "") for r in world.sql("SELECT * FROM audit_log"))
    assert "$2b$" not in blobs and "password123" not in blobs and "another-pass" not in blobs


def test_audit_log_is_append_only(world):
    world.sql("INSERT INTO audit_log (actor_name, action, entity_type, created_at) VALUES ('S', 'seed', 'system', 'x')")
    with pytest.raises(sqlite3.IntegrityError, match="append-only"):
        world.sql("UPDATE audit_log SET actor_name = 'X'")
    with pytest.raises(sqlite3.IntegrityError, match="append-only"):
        world.sql("DELETE FROM audit_log")


def test_a_rolled_back_change_leaves_no_audit_row(world, eve):
    world.roster(EVE, "2026-06-15")
    before = world.one("SELECT COUNT(*) FROM audit_log")
    r = eve.post("/api/leave-requests", {"leave_type_id": 1, "start_date": "2026-06-15", "end_date": "2026-06-15"})
    assert r.status_code == 409
    assert world.one("SELECT COUNT(*) FROM audit_log") == before


# ----------------------------------------------------------------------------------------- notifications
def test_notifications_inbox(world, mona):
    eve = world.login(EVE)
    for day in ("2026-06-22", "2026-06-24"):
        eve.post("/api/leave-requests", {"leave_type_id": 1, "start_date": day, "end_date": day})
    inbox = mona.get("/api/notifications").json()
    assert inbox["unread"] == 2 and len(inbox["notifications"]) == 2
    first = inbox["notifications"][0]
    assert first["kind"] == "approval" and first["link"] == "/approvals" and first["read"] is False
    assert mona.post(f"/api/notifications/{first['id']}/read").status_code == 204
    assert mona.get("/api/notifications").json()["unread"] == 1
    assert len(mona.get("/api/notifications", unread_only="true").json()["notifications"]) == 1
    assert eve.post(f"/api/notifications/{first['id']}/read").status_code == 404  # not hers
    assert mona.post("/api/notifications/read-all").status_code == 204
    assert mona.get("/api/notifications").json()["unread"] == 0


def test_nobody_is_notified_about_their_own_assignment(world, mona):
    mona.post("/api/roster/assignments", {"shift_template_id": DAY, "user_id": MONA, "date": "2026-06-15"})
    assert world.one("SELECT COUNT(*) FROM notifications WHERE user_id = ?", (MONA,)) == 0
    assert HR and OLGA
