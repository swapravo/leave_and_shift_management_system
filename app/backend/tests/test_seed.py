"""P4 Seed and P5 test reset: deterministic demo data for the pinned date, and the reset endpoint."""

from fastapi.testclient import TestClient

from app.main import create_app

from .conftest import settings_for

SEED_LOGINS = ["hr@example.com", "meera@example.com", "arjun@example.com", "priya@example.com", "rahul@example.com"]


def seeded(tmp_path, test_mode=True):
    app = create_app(settings_for(tmp_path, test_mode=test_mode))
    client = TestClient(app)
    return app, client


def login(app, email):
    c = TestClient(app)
    assert c.post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 200
    return c


def test_reset_seeds_the_demo_data_and_is_deterministic(tmp_path):
    app, _ = seeded(tmp_path)
    with TestClient(app) as c:
        assert c.post("/api/test/reset").json() == {"today": "2026-06-10"}
        for email in SEED_LOGINS:
            login(app, email)
        meera = login(app, "meera@example.com")
        first = meera.get("/api/dashboard").json()
        # one deliberate gap today: Customer Support Evening, 1 of 2
        assert [(g["team_name"], g["shift_name"], g["headcount"], g["min_headcount"]) for g in first["gaps_today"]] == [
            ("Customer Support", "Evening", 1, 2)]
        assert len(first["pending_leave"]) == 2 and first["upcoming_gaps"] == []
        priya = login(app, "priya@example.com")
        approved = [r for r in priya.get("/api/leave-requests", params={"scope": "mine"}).json() if r["status"] == "approved"]
        assert any(r["start_date"] > "2026-06-10" for r in approved)
        arjun = login(app, "arjun@example.com")
        annual = next(b for b in arjun.get("/api/balances").json() if b["leave_type"] == "Annual Leave")
        assert annual["carried_forward"] == 5 and annual["accrued"] == 9 and annual["available"] == 14
        assert arjun.get("/api/roster/mine", params={"start": "2026-06-08", "end": "2026-06-14"}).json()  # rostered this week

        # write something, reset, and get identical data back; old cookies still work
        meera.post("/api/roster/copy-week", json={"team_id": 1, "week_start": "2026-07-06"})
        assert c.post("/api/test/reset").status_code == 200
        assert meera.get("/api/dashboard").json() == first


def test_seed_data_passes_every_rule(tmp_path):
    """The seeded leave and roster are what the app itself would accept: no seeded leave breaks coverage."""
    app, _ = seeded(tmp_path)
    with TestClient(app) as c:
        c.post("/api/test/reset")
        hr = login(app, "hr@example.com")
        cal = hr.get("/api/calendar", params={"start": "2026-06-01", "end": "2026-06-28"}).json()  # the 4 seeded weeks
        gaps = [(x["shift_name"], x["date"]) for x in cal["cells"] if x["gap"] and x["date"] >= "2026-06-10"]
        assert gaps == [("Evening", "2026-06-10")]
        audit = hr.get("/api/audit").json()
        assert [e["action"] for e in audit["entries"]] == ["user.login", "seed"]


def test_reset_route_only_exists_in_test_mode(tmp_path):
    app, _ = seeded(tmp_path, test_mode=False)
    with TestClient(app) as c:
        assert c.post("/api/test/reset").status_code == 404
