"""C8 Swaps. Today is Wed 2026-06-10 08:00."""

from datetime import time

from app import clock

from .conftest import DAY, ED, ESA, EVE, HR, MONA, NIGHT, OLGA, OTHER_DAY


def propose(client, mine, theirs):
    return client.post("/api/swaps", {"my_assignment_id": mine, "their_assignment_id": theirs})


def test_full_flow_exchanges_the_two_shifts(world, eve, mona):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16", NIGHT)
    ed = world.login(ED)
    r = propose(eve, mine, theirs)
    assert r.status_code == 201, r.text
    swap = r.json()
    assert (swap["status"], swap["requester_name"], swap["target_name"]) == ("pending_peer", "Eve", "Ed")
    assert (swap["requester_shift_name"], swap["target_shift_name"]) == ("Day", "Night")
    assert ed.get("/api/swaps").json()[0]["can_respond"]
    r = ed.post(f"/api/swaps/{swap['id']}/respond", {"accept": True})
    assert r.json()["status"] == "pending_manager"
    assert [s["id"] for s in mona.get("/api/dashboard").json()["pending_swaps"]] == [swap["id"]]
    r = mona.post(f"/api/swaps/{swap['id']}/decision", {"approve": True})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert world.one("SELECT user_id FROM shift_assignments WHERE id = ?", (mine,)) == ED
    assert world.one("SELECT user_id FROM shift_assignments WHERE id = ?", (theirs,)) == EVE
    kinds = {r["user_id"]: r["kind"] for r in world.sql("SELECT user_id, kind FROM notifications ORDER BY id")}
    assert kinds[EVE] == "swap" and kinds[ED] == "swap"


def test_brd2_swap_involving_someone_on_approved_leave_is_blocked(world, eve):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    world.leave(ED, "2026-06-15", "2026-06-15", "approved")  # Ed would take Eve's shift on a leave day
    r = propose(eve, mine, theirs)
    assert r.status_code == 409
    assert r.json() == {"detail": "Ed is on approved leave on Mon 15 Jun 2026", "code": "SWAP_BLOCKED", "details": []}
    assert world.one("SELECT COUNT(*) FROM swap_requests") == 0


def test_pending_leave_on_either_date_also_blocks(world, eve):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    world.leave(EVE, "2026-06-16", "2026-06-16", "pending")
    r = propose(eve, mine, theirs)
    assert r.status_code == 409 and "Eve is on pending leave" in r.json()["detail"]


def test_leave_approved_after_proposal_blocks_acceptance_and_approval(world, eve, mona):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    ed = world.login(ED)
    swap_id = propose(eve, mine, theirs).json()["id"]
    leave_id = world.leave(ED, "2026-06-15", "2026-06-15", "pending")
    r = ed.post(f"/api/swaps/{swap_id}/respond", {"accept": True})
    assert r.status_code == 409 and r.json()["code"] == "SWAP_BLOCKED"
    world.sql("UPDATE leave_requests SET status = 'cancelled', cancelled_at = '2026-06-10T08:00:00+05:30' WHERE id = ?", (leave_id,))
    assert ed.post(f"/api/swaps/{swap_id}/respond", {"accept": True}).status_code == 200
    world.leave(EVE, "2026-06-16", "2026-06-16", "approved")
    r = mona.post(f"/api/swaps/{swap_id}/decision", {"approve": True})
    assert r.status_code == 409 and r.json()["code"] == "SWAP_BLOCKED"


def test_double_booking_after_the_swap_is_blocked(world, eve):
    mine = world.roster(EVE, "2026-06-15")           # Day Mon
    theirs = world.roster(ED, "2026-06-16", NIGHT)   # Night Tue
    world.sql("""INSERT INTO shift_templates (id, team_id, name, start_time, end_time, days_of_week, min_headcount)
                 VALUES (4, 1, 'Late', '20:00', '23:59', '0,1,2,3,4,5,6', 0)""")
    world.roster(EVE, "2026-06-16", 4)               # Eve already works Tue 20:00-23:59
    r = propose(eve, mine, theirs)
    assert r.status_code == 409 and r.json()["detail"].startswith("After the swap: Eve is already on Late")


def test_stale_snapshot_blocks(world, eve, mona):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    swap_id = propose(eve, mine, theirs).json()["id"]
    world.sql("UPDATE shift_assignments SET date = '2026-06-17' WHERE id = ?", (theirs,))
    r = world.login(ED).post(f"/api/swaps/{swap_id}/respond", {"accept": True})
    assert r.status_code == 409 and "changed since" in r.json()["detail"]


def test_started_shift_cannot_be_swapped(world, eve):
    mine = world.roster(EVE, "2026-06-10")   # today 09:00
    theirs = world.roster(ED, "2026-06-11")
    assert propose(eve, mine, theirs).status_code == 201
    eve.post("/api/swaps/1/cancel")
    clock.set_time(time(9, 30))
    r = propose(eve, mine, theirs)
    assert r.status_code == 409 and "already started" in r.json()["detail"]


def test_proposal_rules(world, eve):
    mine = world.roster(EVE, "2026-06-15")
    eds = world.roster(ED, "2026-06-16")
    olgas = world.roster(OLGA, "2026-06-16", OTHER_DAY)
    also_mine = world.roster(EVE, "2026-06-17")
    assert propose(eve, eds, mine).status_code == 403             # offering someone else's shift
    assert propose(eve, mine, also_mine).status_code == 400       # both mine
    assert propose(eve, mine, olgas).status_code == 400           # other team
    assert propose(eve, mine, 999).status_code == 404
    assert propose(world.login(HR), mine, eds).status_code == 403
    assert propose(eve, mine, eds).status_code == 201
    r = propose(eve, also_mine, eds)
    assert r.status_code == 409 and r.json()["code"] == "INVALID_STATE"  # Ed's shift is already in an open swap


def test_team_without_manager_cannot_propose(world, eve):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    world.sql("UPDATE teams SET manager_id = NULL WHERE id = 1")
    r = propose(eve, mine, theirs)
    assert r.status_code == 409 and r.json()["code"] == "TEAM_HAS_NO_MANAGER"


def test_decline_and_cancel(world, eve):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    ed = world.login(ED)
    first = propose(eve, mine, theirs).json()["id"]
    assert eve.post(f"/api/swaps/{first}/respond", {"accept": True}).status_code == 403
    assert ed.post(f"/api/swaps/{first}/respond", {"accept": False}).json()["status"] == "declined"
    second = propose(eve, mine, theirs).json()["id"]
    assert ed.post(f"/api/swaps/{second}/cancel").status_code == 403
    assert eve.post(f"/api/swaps/{second}/cancel").json()["status"] == "cancelled"
    assert eve.post(f"/api/swaps/{second}/cancel").status_code == 409


def test_reject_needs_a_comment(world, eve, mona):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    swap_id = propose(eve, mine, theirs).json()["id"]
    world.login(ED).post(f"/api/swaps/{swap_id}/respond", {"accept": True})
    assert mona.post(f"/api/swaps/{swap_id}/decision", {"approve": False}).status_code == 400
    r = mona.post(f"/api/swaps/{swap_id}/decision", {"approve": False, "comment": "Keep the rota stable"})
    assert r.json()["status"] == "rejected" and r.json()["decision_comment"] == "Keep the rota stable"
    assert world.one("SELECT user_id FROM shift_assignments WHERE id = ?", (mine,)) == EVE


def test_swap_with_the_manager_is_approved_by_hr(world, hr, mona):
    eve = world.login(EVE)
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(MONA, "2026-06-16")
    swap_id = propose(eve, mine, theirs).json()["id"]
    assert mona.post(f"/api/swaps/{swap_id}/respond", {"accept": True}).status_code == 200
    assert mona.post(f"/api/swaps/{swap_id}/decision", {"approve": True}).status_code == 403
    assert [s["id"] for s in hr.get("/api/dashboard").json()["pending_swaps"]] == [swap_id]
    assert hr.post(f"/api/swaps/{swap_id}/decision", {"approve": True}).status_code == 200


def test_unassigning_a_shift_auto_cancels_its_open_swap(world, eve, mona):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    swap_id = propose(eve, mine, theirs).json()["id"]
    assert mona.delete(f"/api/roster/assignments/{theirs}").status_code == 204
    assert world.one("SELECT status FROM swap_requests WHERE id = ?", (swap_id,)) == "cancelled"
    assert world.one("SELECT COUNT(*) FROM audit_log WHERE action = 'swap.auto_cancel'") == 1


def test_list_visibility(world, eve, mona):
    mine = world.roster(EVE, "2026-06-15")
    theirs = world.roster(ED, "2026-06-16")
    propose(eve, mine, theirs)
    assert len(mona.get("/api/swaps").json()) == 1
    assert len(world.login(ESA).get("/api/swaps").json()) == 0
    assert len(world.login(6).get("/api/swaps").json()) == 0
    assert len(world.login(HR).get("/api/swaps").json()) == 1
    assert DAY == 1
