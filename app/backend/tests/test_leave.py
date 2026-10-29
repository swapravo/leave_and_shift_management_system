"""C6 Leave Requests: apply checks, preview, routing, approve/reject. Today is Wed 2026-06-10."""

from datetime import date

from app.services.leave import working_days

from .conftest import ANNUAL, DAY, ED, ESA, EVE, HR, MONA, NIGHT, d


def apply(client, start, end, type_id=ANNUAL, reason=""):
    return client.post("/api/leave-requests", {"leave_type_id": type_id, "start_date": start, "end_date": end,
                                               "reason": reason})


def annual(client) -> dict:
    return next(b for b in client.get("/api/balances").json() if b["leave_type_id"] == ANNUAL)


# ----------------------------------------------------------------------------------------- day counting
def test_working_days_counts_monday_to_friday_only():
    assert working_days(date(2026, 6, 12), date(2026, 6, 15)) == 2  # Fri..Mon
    assert working_days(date(2026, 6, 13), date(2026, 6, 14)) == 0  # weekend
    assert working_days(date(2026, 6, 15), date(2026, 6, 28)) == 10


# ----------------------------------------------------------------------------------------- BRD success criterion 1
def test_brd1_applying_for_leave_reduces_the_balance(world, eve, mona):
    before = annual(eve)
    assert (before["balance"], before["available"]) == (6.0, 6.0)
    r = apply(eve, "2026-06-15", "2026-06-16")
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending" and r.json()["days"] == 2
    pending = annual(eve)
    assert (pending["balance"], pending["pending"], pending["available"]) == (6.0, 2.0, 4.0)
    assert mona.post(f"/api/leave-requests/{r.json()['id']}/decision", {"approve": True}).status_code == 200
    after = annual(eve)
    assert (after["balance"], after["used"], after["pending"], after["available"]) == (4.0, 2.0, 0.0, 4.0)


# ----------------------------------------------------------------------------------------- apply rules
def test_dates_rules(eve):
    assert apply(eve, "2026-06-09", "2026-06-10").json()["detail"] == "Leave can't start in the past"
    assert apply(eve, "2026-06-16", "2026-06-15").status_code == 400
    r = apply(eve, "2026-12-31", "2027-01-01")
    assert r.status_code == 400 and "two calendar years" in r.json()["detail"]
    r = apply(eve, "2026-06-13", "2026-06-14")
    assert r.status_code == 400 and "no working days" in r.json()["detail"]


def test_leave_can_start_today(eve):
    assert apply(eve, "2026-06-10", "2026-06-10").status_code == 201


def test_overlap_with_own_pending_or_approved_leave(eve):
    assert apply(eve, "2026-06-15", "2026-06-17").status_code == 201
    r = apply(eve, "2026-06-17", "2026-06-18")
    assert r.status_code == 409 and r.json()["code"] == "LEAVE_OVERLAP"


def test_insufficient_balance_counts_pending_days(eve):
    assert apply(eve, "2026-06-15", "2026-06-19").status_code == 201  # 5 of 6
    r = apply(eve, "2026-06-22", "2026-06-23")  # 2 more, only 1 available
    assert r.status_code == 409 and r.json()["code"] == "INSUFFICIENT_BALANCE"
    assert apply(eve, "2026-06-22", "2026-06-22").status_code == 201


def test_archived_leave_type_cannot_be_applied_for(world, hr, eve):
    hr.patch(f"/api/leave-types/{ANNUAL}", {"active": False})
    assert apply(eve, "2026-06-15", "2026-06-15").status_code == 400


def test_hr_admin_cannot_apply(hr):
    assert apply(hr, "2026-06-15", "2026-06-15").status_code == 403


def test_team_without_manager_is_blocked(world, eve):
    world.sql("UPDATE teams SET manager_id = NULL WHERE id = 1")
    r = apply(eve, "2026-06-15", "2026-06-15")
    assert r.status_code == 409 and r.json()["code"] == "TEAM_HAS_NO_MANAGER"


# ----------------------------------------------------------------------------------------- coverage hard block
def test_coverage_block_names_the_shift_and_date(world, eve):
    world.roster(EVE, "2026-06-15")
    world.roster(ED, "2026-06-15")  # Day min 2: without Eve only 1 left
    r = apply(eve, "2026-06-15", "2026-06-16")
    assert r.status_code == 409
    body = r.json()
    assert body["code"] == "COVERAGE_VIOLATION"
    assert body["details"] == [{"date": "2026-06-15", "shift_template_id": DAY, "shift_name": "Day",
                                "min_headcount": 2, "headcount_without_you": 1}]
    assert "Day on Mon 15 Jun 2026" in body["detail"]


def test_coverage_counts_other_peoples_pending_leave(world, eve):
    for u in (EVE, ED, ESA):
        world.roster(u, "2026-06-15")
    world.leave(ED, "2026-06-15", "2026-06-15", status="pending")
    r = apply(eve, "2026-06-15", "2026-06-15")
    assert r.status_code == 409 and r.json()["details"][0]["headcount_without_you"] == 1


def test_leave_is_fine_when_enough_people_remain(world, eve):
    for u in (EVE, ED, ESA):
        world.roster(u, "2026-06-15")
    assert apply(eve, "2026-06-15", "2026-06-15").status_code == 201


def test_shift_with_min_zero_never_blocks(world, eve):
    world.roster(EVE, "2026-06-15", NIGHT)
    assert apply(eve, "2026-06-15", "2026-06-15").status_code == 201


def test_preview_reports_everything_without_saving(world, eve):
    world.roster(EVE, "2026-06-15")
    r = eve.post("/api/leave-requests/preview", {"leave_type_id": ANNUAL, "start_date": "2026-06-15",
                                                 "end_date": "2026-06-23"})
    assert r.status_code == 200
    p = r.json()
    assert (p["days"], p["available"], p["remaining_after"]) == (7.0, 6.0, -1.0)
    assert len(p["violations"]) == 1
    assert len(p["errors"]) == 2  # balance + coverage
    assert world.one("SELECT COUNT(*) FROM leave_requests") == 0


def test_preview_with_no_problems(eve):
    p = eve.post("/api/leave-requests/preview", {"leave_type_id": ANNUAL, "start_date": "2026-06-15",
                                                 "end_date": "2026-06-16"}).json()
    assert p == {"days": 2.0, "available": 6.0, "remaining_after": 4.0, "violations": [], "errors": []}


# ----------------------------------------------------------------------------------------- routing
def test_employee_leave_goes_to_the_team_manager(world, eve, mona, hr):
    leave_id = apply(eve, "2026-06-15", "2026-06-15").json()["id"]
    note = world.sql("SELECT user_id, kind, link FROM notifications")
    assert note == [{"user_id": MONA, "kind": "approval", "link": "/approvals"}]
    assert [x["id"] for x in mona.get("/api/leave-requests", scope="pending").json()] == [leave_id]
    assert hr.get("/api/leave-requests", scope="pending").json() == []
    r = hr.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    assert r.status_code == 403


def test_manager_leave_goes_to_hr(world, mona, hr):
    leave_id = apply(mona, "2026-06-15", "2026-06-15").json()["id"]
    assert world.one("SELECT user_id FROM notifications") == HR
    assert mona.get("/api/leave-requests", scope="pending").json() == []
    assert [x["id"] for x in hr.get("/api/leave-requests", scope="pending").json()] == [leave_id]
    assert mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True}).status_code == 403
    assert hr.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True}).status_code == 200


def test_other_team_manager_cannot_see_the_request(world, eve):
    leave_id = apply(eve, "2026-06-15", "2026-06-15").json()["id"]
    oscar = world.login(6)
    assert oscar.get(f"/api/leave-requests/{leave_id}").status_code == 404
    assert oscar.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True}).status_code == 404


# ----------------------------------------------------------------------------------------- approve / reject
def test_reject_needs_a_comment_and_the_employee_sees_it(world, eve, mona):
    leave_id = apply(eve, "2026-06-15", "2026-06-15").json()["id"]
    r = mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": False})
    assert r.status_code == 400
    r = mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": False, "comment": "Quarter end"})
    assert r.json()["status"] == "rejected"
    mine = eve.get("/api/leave-requests", scope="mine").json()[0]
    assert (mine["status"], mine["decision_comment"], mine["decided_by_name"]) == ("rejected", "Quarter end", "Mona")
    assert annual(eve)["available"] == 6.0
    assert world.sql("SELECT kind, message FROM notifications WHERE user_id = ?", (EVE,))[0]["kind"] == "leave"


def test_cannot_decide_twice(eve, mona):
    leave_id = apply(eve, "2026-06-15", "2026-06-15").json()["id"]
    mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    r = mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    assert r.status_code == 409 and r.json()["code"] == "INVALID_STATE"


def test_approval_removes_shifts_in_the_range_and_records_them(world, eve, mona):
    for u in (EVE, ED, ESA):
        world.roster(u, "2026-06-15")
    world.roster(EVE, "2026-06-13", NIGHT)  # Saturday night, outside the range
    world.roster(EVE, "2026-06-16", NIGHT)
    leave_id = apply(eve, "2026-06-15", "2026-06-16").json()["id"]
    assert mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True}).status_code == 200
    left = world.sql("SELECT date, shift_template_id FROM shift_assignments WHERE user_id = ? ORDER BY date", (EVE,))
    assert left == [{"date": "2026-06-13", "shift_template_id": NIGHT}]
    removed = world.sql("SELECT date, shift_template_id, status FROM leave_removed_shifts ORDER BY date")
    assert removed == [{"date": "2026-06-15", "shift_template_id": DAY, "status": "removed"},
                       {"date": "2026-06-16", "shift_template_id": NIGHT, "status": "removed"}]
    message = world.one("SELECT message FROM notifications WHERE user_id = ? ORDER BY id DESC", (EVE,))
    assert "2 shift(s)" in message
    assert eve.get("/api/roster/mine").json()[0]["date"] == "2026-06-13"


def test_approval_rechecks_coverage(world, eve, mona):
    for u in (EVE, ED, ESA):
        world.roster(u, "2026-06-15")
    leave_id = apply(eve, "2026-06-15", "2026-06-15").json()["id"]
    world.sql("DELETE FROM shift_assignments WHERE user_id = ?", (ESA,))  # coverage worsened since applying
    r = mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    assert r.status_code == 409 and r.json()["code"] == "COVERAGE_VIOLATION"
    assert world.one("SELECT status FROM leave_requests WHERE id = ?", (leave_id,)) == "pending"


def test_approval_rechecks_balance(world, eve, mona):
    leave_id = apply(eve, "2026-06-15", "2026-06-19").json()["id"]
    world.sql("""INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, reason, created_by, created_at)
                 VALUES (3, 1, 2026, 'adjustment', -3, 'correction', 1, '2026-06-10T08:00:00+05:30')""")
    r = mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    assert r.status_code == 409 and r.json()["code"] == "INSUFFICIENT_BALANCE"


def test_detail_and_lists(world, eve, mona):
    leave_id = apply(eve, "2026-06-15", "2026-06-15", reason="Dentist").json()["id"]
    detail = eve.get(f"/api/leave-requests/{leave_id}").json()
    assert detail["reason"] == "Dentist" and detail["can_cancel"] and not detail["can_decide"]
    assert detail["removed_shifts"] == [] and detail["refund_days"] == []
    assert mona.get(f"/api/leave-requests/{leave_id}").json()["can_decide"]
    mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    assert [x["id"] for x in mona.get("/api/leave-requests", scope="decided").json()] == [leave_id]
    assert world.login(ED).get(f"/api/leave-requests/{leave_id}").status_code == 404


def test_approved_leave_starting_today_keeps_past_roster_untouched(world, eve, mona):
    world.roster(EVE, "2026-06-10", NIGHT)
    leave_id = apply(eve, "2026-06-10", "2026-06-10").json()["id"]
    mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True})
    assert world.one("SELECT COUNT(*) FROM shift_assignments WHERE user_id = ?", (EVE,)) == 0
    assert d("2026-06-10").weekday() == 2
