"""C7 Roster and C9 Coverage Engine. Today is Wed 2026-06-10."""

import pytest

from .conftest import DAY, ED, ESA, EVE, HR, MONA, NIGHT, OLGA, OTHER_DAY


def assign(client, user_id, day, template=DAY):
    return client.post("/api/roster/assignments", {"shift_template_id": template, "user_id": user_id, "date": day})


def cell(view, template_id, day):
    return next(c for c in view["cells"] if c["shift_template_id"] == template_id and c["date"] == day)


def test_assign_and_unassign(world, mona):
    r = assign(mona, EVE, "2026-06-11")
    assert r.status_code == 201
    a = r.json()
    assert (a["user_name"], a["shift_name"], a["date"], a["team_id"]) == ("Eve", "Day", "2026-06-11", 1)
    assert world.one("SELECT kind FROM notifications WHERE user_id = ?", (EVE,)) == "roster"
    assert mona.delete(f"/api/roster/assignments/{a['id']}").status_code == 204
    assert world.one("SELECT COUNT(*) FROM shift_assignments") == 0
    assert [r["action"] for r in world.sql("SELECT action FROM audit_log WHERE action LIKE 'roster.%' ORDER BY id")] == [
        "roster.assign", "roster.unassign"]


def test_hr_can_edit_any_team_manager_only_their_own(world, hr, mona):
    assert assign(hr, OLGA, "2026-06-11", OTHER_DAY).status_code == 201
    assert assign(mona, OLGA, "2026-06-12", OTHER_DAY).status_code == 403


@pytest.mark.parametrize("setup,user,day,template,message", [
    ("leave_approved", EVE, "2026-06-15", DAY, "Eve is on approved leave on Mon 15 Jun 2026"),
    ("leave_pending", EVE, "2026-06-15", DAY, "Eve is on pending leave on Mon 15 Jun 2026"),
    ("none", OLGA, "2026-06-15", DAY, "Olga isn't in this shift's team"),
    ("none", HR, "2026-06-15", DAY, "Hana is an HR Admin and can't be rostered"),
    ("inactive", EVE, "2026-06-15", DAY, "Eve is deactivated"),
    ("archived", EVE, "2026-06-15", DAY, "Day is archived"),
    ("none", OLGA, "2026-06-13", OTHER_DAY, "Other Day doesn't run on Saturdays"),
    ("duplicate", EVE, "2026-06-15", DAY, "Eve is already on Day on Mon 15 Jun 2026"),
])
def test_each_guard(world, hr, setup, user, day, template, message):
    if setup == "leave_approved":
        world.leave(EVE, "2026-06-15", "2026-06-15", "approved")
    elif setup == "leave_pending":
        world.leave(EVE, "2026-06-15", "2026-06-15", "pending")
    elif setup == "inactive":
        world.sql("UPDATE users SET active = 0, deactivated_at = '2026-06-01T00:00:00+05:30' WHERE id = ?", (EVE,))
    elif setup == "archived":
        world.sql("UPDATE shift_templates SET active = 0 WHERE id = ?", (DAY,))
    elif setup == "duplicate":
        world.roster(EVE, day)
    r = assign(hr, user, day, template)
    assert r.status_code == 409, r.text
    assert r.json() == {"detail": message, "code": "ROSTER_CONFLICT", "details": []}


def test_overnight_shift_overlaps_the_next_mornings_early_shift(world, mona):
    world.sql("""INSERT INTO shift_templates (id, team_id, name, start_time, end_time, days_of_week, min_headcount)
                 VALUES (4, 1, 'Early', '05:00', '13:00', '0,1,2,3,4,5,6', 0)""")
    world.roster(EVE, "2026-06-14", NIGHT)  # Sun 22:00 -> Mon 06:00
    r = assign(mona, EVE, "2026-06-15", 4)
    assert r.status_code == 409
    assert "Night (22:00–06:00) on Sun 14 Jun 2026, which overlaps" in r.json()["detail"]
    assert assign(mona, EVE, "2026-06-15", DAY).status_code == 201  # 09:00 starts after 06:00


def test_back_to_back_shifts_do_not_overlap(world, mona):
    world.roster(EVE, "2026-06-15", DAY)  # until 17:00
    world.sql("""INSERT INTO shift_templates (id, team_id, name, start_time, end_time, days_of_week, min_headcount)
                 VALUES (4, 1, 'Late', '17:00', '23:00', '0,1,2,3,4,5,6', 0)""")
    assert assign(mona, EVE, "2026-06-15", 4).status_code == 201


def test_past_dates_are_read_only(world, mona):
    assert assign(mona, EVE, "2026-06-09").status_code == 400
    old = world.roster(EVE, "2026-06-09")
    assert mona.delete(f"/api/roster/assignments/{old}").status_code == 400
    assert assign(mona, EVE, "2026-06-10").status_code == 201  # today is editable


def test_cells_show_headcount_against_minimum(world, mona):
    world.roster(EVE, "2026-06-15")
    world.roster(ED, "2026-06-15")
    world.roster(ESA, "2026-06-15")
    world.leave(ESA, "2026-06-15", "2026-06-15", "pending")
    view = mona.get("/api/roster", team_id=1, start="2026-06-15", end="2026-06-16").json()
    c = cell(view, DAY, "2026-06-15")
    assert (c["headcount"], c["min_headcount"], c["gap"]) == (2, 2, False)
    assert {p["user_name"]: p["leave_status"] for p in c["assigned"]} == {"Ed": None, "Esa": "pending", "Eve": None}
    empty = cell(view, DAY, "2026-06-16")
    assert (empty["headcount"], empty["gap"]) == (0, True)
    assert [m["name"] for m in view["members"]] == ["Ed", "Esa", "Eve", "Mona"]
    assert view["leaves"][0]["user_name"] == "Esa"


def test_roster_range_is_limited(mona):
    assert mona.get("/api/roster", team_id=1, start="2026-06-01", end="2026-07-13").status_code == 400
    assert mona.get("/api/roster", team_id=1, start="2026-06-10", end="2026-06-09").status_code == 400
    assert mona.get("/api/roster", team_id=99, start="2026-06-10", end="2026-06-11").status_code == 404


def test_inactive_people_do_not_count(world, mona):
    world.roster(EVE, "2026-06-09")
    world.sql("UPDATE users SET active = 0, deactivated_at = '2026-06-10T00:00:00+05:30' WHERE id = ?", (EVE,))
    view = mona.get("/api/roster", team_id=1, start="2026-06-09", end="2026-06-09").json()
    assert cell(view, DAY, "2026-06-09")["headcount"] == 0


def test_grid_shows_unscheduled_days_only_when_someone_is_assigned(world, hr):
    view = hr.get("/api/roster", team_id=2, start="2026-06-13", end="2026-06-14").json()
    assert view["cells"] == []  # Other Day doesn't run at weekends
    world.roster(OLGA, "2026-06-13", OTHER_DAY)  # legacy row from before the schedule changed
    view = hr.get("/api/roster", team_id=2, start="2026-06-13", end="2026-06-14").json()
    assert [(c["date"], c["headcount"]) for c in view["cells"]] == [("2026-06-13", 1)]


def test_copy_previous_week(world, mona):
    world.roster(EVE, "2026-06-08")   # Mon, past -> its copy (06-15) is fine
    world.roster(ED, "2026-06-10")    # Wed
    world.roster(ESA, "2026-06-12")
    world.leave(ESA, "2026-06-19", "2026-06-19", "approved")
    r = mona.post("/api/roster/copy-week", {"team_id": 1, "week_start": "2026-06-15"})
    assert r.status_code == 200
    result = r.json()
    assert result["copied"] == 2
    assert result["skipped"] == ["Esa · Day Fri 19 Jun 2026: Esa is on approved leave on Fri 19 Jun 2026"]
    again = mona.post("/api/roster/copy-week", {"team_id": 1, "week_start": "2026-06-15"}).json()
    assert again["copied"] == 0 and len(again["skipped"]) == 3
    assert mona.post("/api/roster/copy-week", {"team_id": 1, "week_start": "2026-06-16"}).status_code == 400


def test_copy_into_a_week_that_has_started_skips_past_days(world, mona):
    world.roster(EVE, "2026-06-01")  # Mon -> 06-08 is past
    world.roster(EVE, "2026-06-05")  # Fri -> 06-12 is future
    result = mona.post("/api/roster/copy-week", {"team_id": 1, "week_start": "2026-06-08"}).json()
    assert result["copied"] == 1
    assert result["skipped"] == ["Eve · Day Mon 08 Jun 2026: date is in the past"]


def test_gap_alert_goes_to_the_manager_unless_they_caused_it(world, hr, mona):
    a = world.roster(EVE, "2026-06-15")
    b = world.roster(ED, "2026-06-15")
    assert hr.delete(f"/api/roster/assignments/{a}").status_code == 204
    alerts = world.sql("SELECT message FROM notifications WHERE user_id = ? AND kind = 'coverage'", (MONA,))
    assert alerts == [{"message": "Day on Mon 15 Jun 2026 is below minimum (1 of 2)"}]
    # already below minimum: removing more doesn't alert again; and Mona's own changes never alert her
    world.roster(ESA, "2026-06-16")
    c = world.roster(EVE, "2026-06-16")
    mona.delete(f"/api/roster/assignments/{c}")
    assert world.one("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND kind = 'coverage'", (MONA,)) == 1
    assert b


def test_my_shifts_defaults_to_the_next_28_days(world, eve):
    world.roster(EVE, "2026-06-10")
    world.roster(EVE, "2026-07-07")  # day 28
    world.roster(EVE, "2026-07-08")  # day 29
    assert [s["date"] for s in eve.get("/api/roster/mine").json()] == ["2026-06-10", "2026-07-07"]
    shift = eve.get("/api/roster/mine").json()[0]
    assert (shift["shift_name"], shift["start_time"], shift["end_time"], shift["team_name"]) == ("Day", "09:00", "17:00", "Ops")
