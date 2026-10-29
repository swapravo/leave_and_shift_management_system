"""C1 Identity & Access: login, JWT cookie, per-request DB check, RBAC, JSON-only writes."""

import jwt
import pytest
from fastapi.testclient import TestClient

from .conftest import EMAILS, ESA, EVE, HR, MONA, PASSWORD


def test_login_returns_me_and_sets_httponly_cookie(world):
    c = TestClient(world.app)
    r = c.post("/api/auth/login", json={"email": "  EVE@t.io ", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json() == {"id": EVE, "name": "Eve", "email": "eve@t.io", "role": "employee", "team_id": 1,
                        "team_name": "Ops", "managed_team_id": None, "today": "2026-06-10"}
    cookie = r.headers["set-cookie"]
    assert "lsm_token=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie and "Max-Age=28800" in cookie
    assert c.get("/api/auth/me").json()["id"] == EVE
    assert world.one("SELECT action FROM audit_log ORDER BY id DESC LIMIT 1") == "user.login"


def test_manager_me_has_managed_team(mona):
    assert mona.me["managed_team_id"] == 1


@pytest.mark.parametrize("email,password", [("eve@t.io", "wrong-password"), ("nobody@t.io", PASSWORD)])
def test_bad_credentials_get_the_same_401(world, email, password):
    r = TestClient(world.app).post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 401
    assert r.json() == {"detail": "Invalid email or password", "code": "NOT_AUTHENTICATED", "details": []}


def test_deactivated_user_cannot_log_in_and_existing_token_dies(world, hr):
    eve = world.login(EVE)
    assert hr.delete(f"/api/users/{EVE}").status_code == 200
    assert eve.get("/api/auth/me").status_code == 401
    r = TestClient(world.app).post("/api/auth/login", json={"email": EMAILS[EVE], "password": PASSWORD})
    assert r.status_code == 401


def test_no_cookie_is_401(world):
    r = TestClient(world.app).get("/api/auth/me")
    assert r.status_code == 401 and r.json()["code"] == "NOT_AUTHENTICATED"


def test_tampered_and_expired_tokens_are_rejected(world):
    c = TestClient(world.app)
    forged = jwt.encode({"sub": str(HR), "iat": 1893456000, "exp": 1893459600}, "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256")
    c.cookies.set("lsm_token", forged)
    assert c.get("/api/auth/me").status_code == 401
    expired = jwt.encode({"sub": str(HR), "iat": 1000, "exp": 2000}, "test-secret-that-is-at-least-32-bytes-long", algorithm="HS256")
    c.cookies.set("lsm_token", expired)
    assert c.get("/api/auth/me").status_code == 401


def test_password_reset_invalidates_old_tokens(world, hr):
    eve = world.login(EVE)
    # make the old token clearly older than the reset
    world.sql("UPDATE users SET password_changed_at = '2020-01-01T00:00:00+05:30'")
    old = eve.http.cookies.get("lsm_token")
    claims = jwt.decode(old, options={"verify_signature": False})
    forged_old = jwt.encode(claims | {"iat": claims["iat"] - 60}, "test-secret-that-is-at-least-32-bytes-long", algorithm="HS256")
    eve.http.cookies.clear()
    eve.http.cookies.set("lsm_token", forged_old)
    assert hr.patch(f"/api/users/{EVE}", {"password": "new-password-1"}).status_code == 200
    r = eve.get("/api/auth/me")
    assert r.status_code == 401 and "password" in r.json()["detail"].lower()
    r = TestClient(world.app).post("/api/auth/login", json={"email": EMAILS[EVE], "password": "new-password-1"})
    assert r.status_code == 200


def test_role_comes_from_the_database_not_the_token(world, hr):
    esa = world.login(ESA)
    assert esa.get("/api/users").status_code == 403
    world.sql("UPDATE users SET role = 'hr_admin', team_id = NULL WHERE id = ?", (ESA,))
    assert esa.get("/api/users").status_code == 200


def test_logout_clears_the_cookie(world):
    eve = world.login(EVE)
    r = eve.post("/api/auth/logout")
    assert r.status_code == 204
    assert eve.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("method,url", [
    ("get", "/api/users"), ("post", "/api/users"), ("post", "/api/teams"), ("post", "/api/leave-types"),
    ("post", "/api/accrual/monthly"), ("post", "/api/balances/adjustments"), ("get", "/api/dashboard"),
    ("get", "/api/audit"), ("get", "/api/roster?team_id=1&start=2026-06-10&end=2026-06-11"),
    ("post", "/api/roster/assignments"), ("post", "/api/shift-templates"),
])
def test_employee_is_forbidden_from_admin_and_manager_endpoints(world, method, url):
    eve = world.login(EVE)
    bodies = {
        "/api/users": {"name": "X", "email": "x@t.io", "role": "employee", "password": "12345678", "team_id": 1},
        "/api/teams": {"name": "New"},
        "/api/leave-types": {"name": "X", "annual_entitlement": 1, "carry_forward_cap": 0},
        "/api/accrual/monthly": {"year": 2026, "month": 6},
        "/api/balances/adjustments": {"user_id": EVE, "leave_type_id": 1, "amount": 1, "reason": "x"},
        "/api/roster/assignments": {"shift_template_id": 1, "user_id": EVE, "date": "2026-06-11"},
        "/api/shift-templates": {"team_id": 1, "name": "X", "start_time": "01:00", "end_time": "02:00",
                                 "days_of_week": [0], "min_headcount": 1},
    }
    r = eve.get(url) if method == "get" else eve.post(url, bodies[url])
    assert r.status_code == 403, r.text
    assert r.json()["code"] == "FORBIDDEN"


def test_write_with_non_json_body_is_refused(world):
    eve = world.login(EVE)
    r = eve.http.post("/api/leave-requests", content="leave_type_id=1", headers={"content-type": "application/x-www-form-urlencoded"})
    assert r.status_code == 415


def test_unknown_api_path_is_json_404(world):
    r = TestClient(world.app).get("/api/nope")
    assert r.status_code == 404 and r.json()["code"] == "NOT_FOUND"


def test_health_needs_no_login(world):
    assert TestClient(world.app).get("/api/health").json() == {"ok": True}


def test_manager_cannot_open_another_teams_roster(world):
    mona = world.login(MONA)
    r = mona.get("/api/roster", team_id=2, start="2026-06-10", end="2026-06-12")
    assert r.status_code == 403
