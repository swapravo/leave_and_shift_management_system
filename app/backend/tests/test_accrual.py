"""C5 Accrual & Balances."""

import pytest

from app.services.accrual import monthly_credit

from .conftest import ANNUAL, EVE, HR, MONA, OLGA


@pytest.mark.parametrize("entitlement", [20, 7.5, 18, 12, 1, 0.1, 366, 13.33])
def test_twelve_monthly_credits_sum_exactly_to_the_entitlement(entitlement):
    credits = [monthly_credit(entitlement, m) for m in range(1, 13)]
    assert round(sum(credits), 2) == entitlement
    assert all(round(c, 2) == c for c in credits)


def test_monthly_credit_examples():
    assert monthly_credit(20, 1) == 1.67
    assert monthly_credit(20, 2) == 1.66
    assert [monthly_credit(18, m) for m in (1, 12)] == [1.5, 1.5]


def test_startup_catch_up_credits_january_to_this_month(world):
    assert world.balance(EVE) == 6.0
    periods = [r["period"] for r in world.sql(
        "SELECT period FROM balance_ledger WHERE user_id = ? AND kind = 'accrual' ORDER BY period", (EVE,))]
    assert periods == [f"2026-{m:02d}" for m in range(1, 7)]


def test_hr_admins_get_no_balances(world, hr):
    assert world.one("SELECT COUNT(*) FROM balance_ledger WHERE user_id = ?", (HR,)) == 0
    assert hr.get("/api/balances").json() == []


def test_monthly_run_is_idempotent_and_rejects_future_months(world, hr):
    assert hr.post("/api/accrual/monthly", {"year": 2026, "month": 6}).json() == {"entries_created": 0}
    world.sql("DELETE FROM balance_ledger WHERE user_id = ? AND period = '2026-06'", (EVE,))
    assert hr.post("/api/accrual/monthly", {"year": 2026, "month": 6}).json() == {"entries_created": 1}
    assert hr.post("/api/accrual/monthly", {"year": 2026, "month": 6}).json() == {"entries_created": 0}
    r = hr.post("/api/accrual/monthly", {"year": 2026, "month": 7})
    assert r.status_code == 400
    assert world.one("SELECT COUNT(*) FROM audit_log WHERE action = 'accrual.monthly' AND actor_id = 1") == 3


def test_accrual_starts_in_the_join_month(world, hr):
    r = hr.post("/api/users", {"name": "New", "email": "new@t.io", "role": "employee", "team_id": 1,
                               "password": "password123", "join_date": "2026-04-20"})
    assert r.status_code == 201
    new_id = r.json()["id"]
    assert world.balance(new_id) == 3.0  # April, May, June: full credit for the join month


def test_future_join_date_accrues_nothing_yet(world, hr):
    r = hr.post("/api/users", {"name": "Later", "email": "later@t.io", "role": "employee", "team_id": 1,
                               "password": "password123", "join_date": "2026-09-01"})
    assert world.balance(r.json()["id"]) == 0


def test_year_end_carries_forward_up_to_the_cap_and_the_rest_lapses(world, hr):
    # give Eve 2025 history: 12 accrued, 2 taken -> 10 left, cap 5 -> 5 carried, 5 lapse
    world.sql("""INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, period, created_at)
                 VALUES (3, 1, 2025, 'accrual', 12, '2025-01', '2025-01-01T00:00:00+05:30')""")
    world.sql("""INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, days, status, decided_by,
                                             decided_at, created_at)
                 VALUES (99, 3, 1, '2025-03-03', '2025-03-04', 2, 'approved', 2, '2025-03-01T00:00:00+05:30',
                         '2025-03-01T00:00:00+05:30')""")
    world.sql("""INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, leave_request_id, created_at)
                 VALUES (3, 1, 2025, 'leave_taken', -2, 99, '2025-03-01T00:00:00+05:30')""")
    assert hr.post("/api/accrual/year-end", {"closing_year": 2025}).json()["balances_closed"] >= 1
    assert world.balance(EVE, 2025) == 0
    carry = world.one("SELECT amount FROM balance_ledger WHERE user_id = 3 AND kind = 'carry_forward' AND year = 2026")
    assert carry == 5
    assert world.balance(EVE) == 11.0
    b = next(x for x in hr.get("/api/balances", user_id=EVE).json() if x["leave_type_id"] == ANNUAL)
    assert (b["accrued"], b["carried_forward"], b["used"], b["balance"]) == (6.0, 5.0, 0.0, 11.0)
    # idempotent
    assert hr.post("/api/accrual/year-end", {"closing_year": 2025}).json() == {"balances_closed": 0}
    assert world.one("SELECT COUNT(*) FROM balance_ledger WHERE kind = 'carry_forward' AND user_id = 3") == 1


def test_cannot_close_the_current_year(hr):
    assert hr.post("/api/accrual/year-end", {"closing_year": 2026}).status_code == 400


def test_adjustment_needs_a_reason_and_a_non_zero_amount(world, hr):
    base = {"user_id": EVE, "leave_type_id": ANNUAL}
    assert hr.post("/api/balances/adjustments", base | {"amount": 1, "reason": "  "}).status_code == 400
    assert hr.post("/api/balances/adjustments", base | {"amount": 0, "reason": "x"}).status_code == 400
    assert hr.post("/api/balances/adjustments", base | {"amount": 1, "reason": "x"} | {"user_id": HR}).status_code == 400
    r = hr.post("/api/balances/adjustments", base | {"amount": 1.5, "reason": "Comp-off for launch weekend"})
    assert r.status_code == 200
    annual = next(b for b in r.json() if b["leave_type_id"] == ANNUAL)
    assert (annual["adjustments"], annual["balance"]) == (1.5, 7.5)
    entry = world.sql("SELECT * FROM audit_log WHERE action = 'balance.adjust'")[0]
    assert entry["actor_id"] == HR and entry["team_id"] == 1


def test_balances_visible_to_self_team_manager_and_hr_only(world):
    mona, oscar, eve = world.login(MONA), world.login(6), world.login(EVE)
    assert mona.get("/api/balances", user_id=EVE).status_code == 200
    assert oscar.get("/api/balances", user_id=EVE).status_code == 403
    assert eve.get("/api/balances", user_id=MONA).status_code == 403
    assert eve.get("/api/balances", user_id=999).status_code == 404
    assert world.login(OLGA).get("/api/balances/ledger").status_code == 200


def test_ledger_lists_every_movement_oldest_first(eve):
    rows = eve.get("/api/balances/ledger").json()
    assert [r["kind"] for r in rows] == ["accrual"] * 6
    assert rows[0]["created_by_name"] is None and rows[0]["leave_type"] == "Annual"


def test_new_leave_type_accrues_this_year_to_date(world, hr):
    r = hr.post("/api/leave-types", {"name": "Study", "annual_entitlement": 6, "carry_forward_cap": 0})
    assert r.status_code == 201
    assert world.balance(EVE, type_id=r.json()["id"]) == 3.0
