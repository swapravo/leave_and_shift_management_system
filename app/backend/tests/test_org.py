"""C2 Org Admin: users (soft delete), teams and the single team manager; C3/C4 config."""

from .conftest import DAY, ED, ESA, EVE, HR, MONA, NIGHT, OLGA, OSCAR


def new_user(hr, **overrides):
    body = {"name": "Nia", "email": "nia@t.io", "role": "employee", "team_id": 1, "password": "password123"}
    return hr.post("/api/users", body | overrides)


def test_create_user_validations(world, hr):
    assert new_user(hr, email="not-an-email").status_code == 400
    assert new_user(hr, password="short").status_code == 400
    assert new_user(hr, password="x" * 73).status_code == 400
    assert new_user(hr, role="boss").status_code == 400
    assert new_user(hr, team_id=None).status_code == 400
    assert new_user(hr, role="hr_admin").status_code == 400  # HR Admins have no team
    assert new_user(hr, team_id=99).status_code == 404
    r = new_user(hr, email="EVE@t.io")
    assert r.status_code == 409 and r.json()["code"] == "DUPLICATE"
    r = new_user(hr, email=" Nia@T.io ")
    assert r.status_code == 201 and r.json()["email"] == "nia@t.io" and r.json()["join_date"] == "2026-06-10"
    assert world.one("SELECT password_hash FROM users WHERE email = 'nia@t.io'").startswith("$2b$")


def test_users_list_hides_inactive_unless_asked(world, hr):
    hr.delete(f"/api/users/{ED}")
    names = [u["name"] for u in hr.get("/api/users").json()]
    assert "Ed" not in names
    all_names = [u["name"] for u in hr.get("/api/users", include_inactive="true").json()]
    assert "Ed" in all_names
    assert [u["name"] for u in hr.get("/api/users", team_id=2).json()] == ["Olga", "Oscar"]


def test_deactivation_side_effects(world, hr, mona):
    eve = world.login(EVE)
    future = world.roster(EVE, "2026-06-15")
    world.roster(ESA, "2026-06-15")
    past = world.roster(EVE, "2026-06-09")
    theirs = world.roster(ED, "2026-06-16", NIGHT)
    swap_id = eve.post("/api/swaps", {"my_assignment_id": future, "their_assignment_id": theirs}).json()["id"]
    leave_id = eve.post("/api/leave-requests", {"leave_type_id": 1, "start_date": "2026-06-22",
                                                 "end_date": "2026-06-22"}).json()["id"]
    r = hr.delete(f"/api/users/{EVE}")
    assert r.status_code == 200 and r.json()["active"] is False and r.json()["deactivated_at"]
    assert world.one("SELECT status FROM leave_requests WHERE id = ?", (leave_id,)) == "cancelled"
    assert world.one("SELECT status FROM swap_requests WHERE id = ?", (swap_id,)) == "cancelled"
    left = [r["id"] for r in world.sql("SELECT id FROM shift_assignments WHERE user_id = ?", (EVE,))]
    assert left == [past]  # history kept, future released
    alert = world.one("SELECT message FROM notifications WHERE user_id = ? AND kind = 'coverage'", (MONA,))
    assert alert == "Day on Mon 15 Jun 2026 is below minimum (1 of 2)"
    assert world.one("SELECT name FROM users WHERE id = ?", (EVE,)) == "Eve"  # soft delete
    assert hr.delete(f"/api/users/{EVE}").status_code == 409


def test_deactivating_a_manager_leaves_the_team_without_one(world, hr):
    hr.delete(f"/api/users/{MONA}")
    team = next(t for t in hr.get("/api/teams").json() if t["id"] == 1)
    assert team["manager_id"] is None and team["member_count"] == 3


def test_cannot_deactivate_self_or_change_own_role(world, hr):
    assert hr.delete(f"/api/users/{HR}").status_code == 400
    assert hr.patch(f"/api/users/{HR}", {"role": "employee", "team_id": 1}).status_code == 403


def test_another_hr_admin_can_be_demoted_or_deactivated_while_one_remains(world, hr):
    hal = new_user(hr, name="Hal", email="hal@t.io", role="hr_admin", team_id=None).json()["id"]
    r = hr.patch(f"/api/users/{hal}", {"role": "employee", "team_id": 1})
    assert r.status_code == 200 and r.json()["team_id"] == 1
    assert hr.patch(f"/api/users/{hal}", {"role": "hr_admin"}).json()["team_id"] is None
    assert hr.delete(f"/api/users/{hal}").status_code == 200
    # LAST_HR_ADMIN is defensive: through the API the acting admin is always a second active HR Admin


def test_moving_a_user_to_another_team_releases_future_shifts(world, hr):
    world.roster(EVE, "2026-06-15")
    world.roster(EVE, "2026-06-09")
    r = hr.patch(f"/api/users/{EVE}", {"team_id": 2})
    assert r.status_code == 200 and r.json()["team_name"] == "Other"
    assert [x["date"] for x in world.sql("SELECT date FROM shift_assignments WHERE user_id = ?", (EVE,))] == ["2026-06-09"]


def test_manager_changing_role_stops_managing(world, hr):
    assert hr.patch(f"/api/users/{MONA}", {"role": "employee"}).status_code == 200
    assert world.one("SELECT manager_id FROM teams WHERE id = 1") is None


def test_password_reset_needs_8_characters(hr):
    assert hr.patch(f"/api/users/{EVE}", {"password": "short"}).status_code == 400


def test_teams_create_update_and_manager_rules(world, hr):
    r = hr.post("/api/teams", {"name": "ops"})
    assert r.status_code == 409 and r.json()["code"] == "DUPLICATE"
    team = hr.post("/api/teams", {"name": "Field", "department": "Ops"}).json()
    assert team["manager_id"] is None and team["member_count"] == 0
    assert hr.patch(f"/api/teams/{team['id']}", {"manager_id": EVE}).status_code == 400   # not a manager
    r = hr.patch(f"/api/teams/{team['id']}", {"manager_id": MONA})
    assert r.status_code == 409  # Mona already manages Ops
    # a manager without a team to manage moves into the new team
    world.roster(OSCAR, "2026-06-15", 3)
    hr.patch("/api/teams/2", {"manager_id": None})
    r = hr.patch(f"/api/teams/{team['id']}", {"manager_id": OSCAR})
    assert r.status_code == 200 and r.json()["manager_name"] == "Oscar" and r.json()["member_count"] == 1
    assert world.one("SELECT team_id FROM users WHERE id = ?", (OSCAR,)) == team["id"]
    assert world.one("SELECT COUNT(*) FROM shift_assignments WHERE user_id = ?", (OSCAR,)) == 0
    assert any(t["name"] == "Field" for t in world.login(OLGA).get("/api/teams").json())


def test_leave_type_rules(world, hr, mona):
    assert hr.post("/api/leave-types", {"name": "annual", "annual_entitlement": 1, "carry_forward_cap": 0}).status_code == 409
    assert hr.post("/api/leave-types", {"name": "X", "annual_entitlement": 400, "carry_forward_cap": 0}).status_code == 400
    assert hr.post("/api/leave-types", {"name": "X", "annual_entitlement": 1, "carry_forward_cap": -1}).status_code == 400
    assert hr.patch("/api/leave-types/1", {"active": False}).json()["active"] is False
    assert mona.get("/api/leave-types").json() == []
    assert [t["name"] for t in hr.get("/api/leave-types", include_inactive="true").json()] == ["Annual"]
    assert [t["name"] for t in mona.get("/api/leave-types", include_inactive="true").json()] == []


def test_shift_template_rules(world, hr, mona, oscar):
    base = {"team_id": 1, "name": "Late", "start_time": "14:00", "end_time": "22:00", "days_of_week": [4, 0, 2],
            "min_headcount": 1}
    r = mona.post("/api/shift-templates", base)
    assert r.status_code == 201 and r.json()["days_of_week"] == [0, 2, 4]
    assert oscar.post("/api/shift-templates", base | {"name": "Nope"}).status_code == 403
    assert mona.post("/api/shift-templates", base | {"team_id": 2}).status_code == 403
    assert mona.post("/api/shift-templates", base | {"name": "day"}).status_code == 409
    for bad in ({"start_time": "24:00"}, {"end_time": "14:00"}, {"days_of_week": []}, {"days_of_week": [7]},
                {"days_of_week": [1, 1]}, {"min_headcount": -1}, {"name": " "}):
        assert mona.post("/api/shift-templates", base | {"name": "Late2"} | bad).status_code == 400, bad
    assert hr.post("/api/shift-templates", base | {"team_id": 2}).status_code == 201


def test_archiving_a_shift_removes_future_assignments_and_tells_the_manager(world, hr):
    world.roster(EVE, "2026-06-09", NIGHT)
    world.roster(EVE, "2026-06-15", NIGHT)
    assert hr.patch(f"/api/shift-templates/{NIGHT}", {"active": False}).status_code == 200
    assert [x["date"] for x in world.sql("SELECT date FROM shift_assignments WHERE shift_template_id = ?", (NIGHT,))] == ["2026-06-09"]
    assert "archived" in world.one("SELECT message FROM notifications WHERE user_id = ? AND kind = 'coverage'", (MONA,))
    assert world.login(EVE).get("/api/shift-templates", team_id=1).json()[0]["name"] == "Day"
    assert len(world.login(MONA).get("/api/shift-templates", team_id=1, include_inactive="true").json()) == 2
    assert DAY == 1
