"""C6 cancellation: withdraw pending; cancel approved before it starts with re-roster and per-day refund."""

from datetime import date

from app import clock

from .conftest import ANNUAL, DAY, ED, ESA, EVE, HR, NIGHT
from .test_leave import annual, apply

TEMP = 4


def add_temp_template(world) -> None:
    world.sql("""INSERT INTO shift_templates (id, team_id, name, start_time, end_time, days_of_week, min_headcount)
                 VALUES (4, 1, 'Temp', '09:00', '17:00', '0,1,2,3,4,5,6', 0)""")


def approved(world, eve, mona, start, end) -> int:
    leave_id = apply(eve, start, end).json()["id"]
    assert mona.post(f"/api/leave-requests/{leave_id}/decision", {"approve": True}).status_code == 200
    return leave_id


def test_withdraw_pending_leave(world, eve, mona):
    leave_id = apply(eve, "2026-06-15", "2026-06-16").json()["id"]
    r = eve.post(f"/api/leave-requests/{leave_id}/cancel")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert annual(eve)["available"] == 6.0
    assert mona.get("/api/leave-requests", scope="pending").json() == []


def test_only_the_requester_can_cancel(world, eve, mona):
    leave_id = apply(eve, "2026-06-15", "2026-06-16").json()["id"]
    assert mona.post(f"/api/leave-requests/{leave_id}/cancel").status_code == 403
    assert world.login(ED).post(f"/api/leave-requests/{leave_id}/cancel").status_code == 404


def test_approved_leave_cannot_be_cancelled_once_started(world, eve, mona):
    leave_id = approved(world, eve, mona, "2026-06-10", "2026-06-11")
    r = eve.post(f"/api/leave-requests/{leave_id}/cancel")
    assert r.status_code == 409 and "before it starts" in r.json()["detail"]


def test_cancel_approved_restores_shifts_and_refunds_every_day(world, eve, mona):
    for u in (EVE, ED, ESA):
        world.roster(u, "2026-06-15")
    world.roster(EVE, "2026-06-13", NIGHT)  # weekend shift inside the range
    leave_id = approved(world, eve, mona, "2026-06-12", "2026-06-16")  # Fri..Tue = 3 days
    assert annual(eve)["balance"] == 3.0
    r = eve.post(f"/api/leave-requests/{leave_id}/cancel")
    assert r.status_code == 200
    detail = r.json()
    assert detail["status"] == "cancelled"
    assert sorted((s["date"], s["status"]) for s in detail["removed_shifts"]) == [
        ("2026-06-13", "restored"), ("2026-06-15", "restored")]
    assert [(x["date"], x["status"]) for x in detail["refund_days"]] == [
        ("2026-06-12", "refunded"), ("2026-06-15", "refunded"), ("2026-06-16", "refunded")]
    assert annual(eve)["balance"] == 6.0 and annual(eve)["used"] == 0.0
    mine = {(s["date"], s["shift_template_id"]) for s in eve.get("/api/roster/mine").json()}
    assert mine == {("2026-06-13", NIGHT), ("2026-06-15", DAY)}
    restored = world.sql("SELECT created_by FROM shift_assignments WHERE user_id = ? AND date = '2026-06-15'", (EVE,))
    assert restored == [{"created_by": None}]
    assert world.sql("SELECT action FROM audit_log WHERE action = 'roster.restore'") != []


def test_shift_that_cannot_be_restored_leaves_an_owed_day(world, hr, eve, mona):
    add_temp_template(world)
    world.roster(EVE, "2026-06-16", TEMP)
    leave_id = approved(world, eve, mona, "2026-06-15", "2026-06-16")
    assert hr.patch(f"/api/shift-templates/{TEMP}", {"active": False}).status_code == 200
    detail = eve.post(f"/api/leave-requests/{leave_id}/cancel").json()
    assert detail["removed_shifts"][0]["status"] == "not_restored"
    assert detail["removed_shifts"][0]["note"] == "Temp is archived"
    assert [(x["date"], x["status"]) for x in detail["refund_days"]] == [
        ("2026-06-15", "refunded"), ("2026-06-16", "owed")]
    assert annual(eve)["balance"] == 5.0  # one day still deducted
    message = world.one("SELECT message FROM notifications WHERE user_id = ? ORDER BY id DESC", (EVE,))
    assert "Still owed" in message and "16 Jun" in message


def test_rostering_the_person_on_an_owed_day_refunds_it(world, hr, eve, mona):
    add_temp_template(world)
    world.roster(EVE, "2026-06-16", TEMP)
    leave_id = approved(world, eve, mona, "2026-06-16", "2026-06-16")
    hr.patch(f"/api/shift-templates/{TEMP}", {"active": False})
    eve.post(f"/api/leave-requests/{leave_id}/cancel")
    assert annual(eve)["balance"] == 5.0
    r = mona.post("/api/roster/assignments", {"shift_template_id": DAY, "user_id": EVE, "date": "2026-06-16"})
    assert r.status_code == 201
    assert annual(eve)["balance"] == 6.0
    day = eve.get(f"/api/leave-requests/{leave_id}").json()["refund_days"][0]
    assert day["status"] == "refunded" and day["resolved_at"]
    assert world.sql("SELECT action FROM audit_log WHERE action = 'leave.refund_owed_day'") != []


def test_owed_day_is_refunded_when_a_swap_puts_the_person_back(world, hr, eve, mona):
    add_temp_template(world)
    world.roster(EVE, "2026-06-16", TEMP)
    leave_id = approved(world, eve, mona, "2026-06-16", "2026-06-16")
    hr.patch(f"/api/shift-templates/{TEMP}", {"active": False})
    eve.post(f"/api/leave-requests/{leave_id}/cancel")
    mine = world.roster(EVE, "2026-06-18", DAY)
    theirs = world.roster(ED, "2026-06-16", NIGHT)
    ed = world.login(ED)
    swap = eve.post("/api/swaps", {"my_assignment_id": mine, "their_assignment_id": theirs}).json()
    assert ed.post(f"/api/swaps/{swap['id']}/respond", {"accept": True}).status_code == 200
    assert mona.post(f"/api/swaps/{swap['id']}/decision", {"approve": True}).status_code == 200
    assert annual(eve)["balance"] == 6.0


def test_owed_day_is_forfeited_once_the_date_passes(world, hr, eve, mona):
    add_temp_template(world)
    world.roster(EVE, "2026-06-16", TEMP)
    leave_id = approved(world, eve, mona, "2026-06-16", "2026-06-16")
    hr.patch(f"/api/shift-templates/{TEMP}", {"active": False})
    eve.post(f"/api/leave-requests/{leave_id}/cancel")
    clock.set_today(date(2026, 6, 17))
    # read path reports it as forfeited straight away
    assert eve.get(f"/api/leave-requests/{leave_id}").json()["refund_days"][0]["status"] == "forfeited"
    # the next write that touches refunds stores it
    mona.post("/api/roster/assignments", {"shift_template_id": DAY, "user_id": ED, "date": "2026-06-17"})
    assert world.one("SELECT status FROM leave_refund_days") == "forfeited"
    assert annual(eve)["balance"] == 5.0
    assert world.one("SELECT actor_id FROM audit_log WHERE action = 'leave.refund_forfeited'") is None


def test_owed_day_needs_as_many_shifts_as_were_removed(world, hr, eve, mona):
    add_temp_template(world)
    world.roster(EVE, "2026-06-16", TEMP)
    world.roster(EVE, "2026-06-16", NIGHT)
    leave_id = approved(world, eve, mona, "2026-06-16", "2026-06-16")
    hr.patch(f"/api/shift-templates/{TEMP}", {"active": False})
    detail = eve.post(f"/api/leave-requests/{leave_id}/cancel").json()
    # Night restored, Temp not: owed with 2 removed, 1 back
    assert detail["refund_days"][0]["status"] == "owed" and detail["refund_days"][0]["shifts_removed"] == 2
    mona.post("/api/roster/assignments", {"shift_template_id": DAY, "user_id": EVE, "date": "2026-06-16"})
    assert annual(eve)["balance"] == 6.0


def test_cancelled_leave_cannot_be_cancelled_again(eve):
    leave_id = apply(eve, "2026-06-15", "2026-06-15").json()["id"]
    eve.post(f"/api/leave-requests/{leave_id}/cancel")
    assert eve.post(f"/api/leave-requests/{leave_id}/cancel").status_code == 409


def test_hr_sees_any_request(world, eve, hr):
    leave_id = apply(eve, "2026-06-15", "2026-06-15").json()["id"]
    assert hr.get(f"/api/leave-requests/{leave_id}").status_code == 200
    assert HR != EVE and ANNUAL == 1
