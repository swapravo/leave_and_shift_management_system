"""Schema constraints (D-009): good rows load, bad rows are rejected, the file is idempotent, triggers hold."""

import sqlite3

from app.db import SCHEMA_PATH

TS = "2026-06-10T09:00:00+05:30"


def test_schema_constraints():
    sql = SCHEMA_PATH.read_text()
    db = sqlite3.connect(":memory:", isolation_level=None)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(sql)
    db.executescript(sql)  # idempotent
    assert db.execute("SELECT value FROM schema_meta").fetchall() == [("1",)]
    fails = []


    def ok(stmt, params=()):
        try:
            return db.execute(stmt, params).lastrowid
        except sqlite3.Error as e:
            fails.append(f"SHOULD PASS: {stmt} {params} -> {e}")

    def bad(label, stmt, params=()):
        db.execute("SAVEPOINT s")
        try:
            db.execute(stmt, params)
            fails.append(f"SHOULD FAIL ({label}): {stmt} {params}")
        except sqlite3.Error:
            pass
        db.execute("ROLLBACK TO s")
        db.execute("RELEASE s")

    # --- good data -------------------------------------------------------------------------------------------------
    ok("INSERT INTO teams (id, name, created_at) VALUES (1, 'Support', ?)", (TS,))
    U = "INSERT INTO users (id, name, email, password_hash, role, team_id, join_date, password_changed_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ok(U, (1, "Asha", "hr@example.com", "h", "hr_admin", None, "2025-01-01", TS, TS))
    ok(U, (2, "Meera", "meera@example.com", "h", "manager", 1, "2025-01-01", TS, TS))
    ok(U, (3, "Arjun", "arjun@example.com", "h", "employee", 1, "2025-03-15", TS, TS))
    ok(U, (4, "Priya", "priya@example.com", "h", "employee", 1, "2025-03-15", TS, TS))
    ok("UPDATE teams SET manager_id = 2 WHERE id = 1")
    ok("INSERT INTO leave_types (id, name, annual_entitlement, carry_forward_cap) VALUES (1, 'Annual', 18, 5)")
    ST = "INSERT INTO shift_templates (id, team_id, name, start_time, end_time, days_of_week, min_headcount) VALUES (?,?,?,?,?,?,?)"
    ok(ST, (1, 1, "Morning", "06:00", "14:00", "0,1,2,3,4,5,6", 2))
    ok(ST, (2, 1, "Night", "22:00", "06:00", "0,1,2,3,4", 1))
    A = "INSERT INTO shift_assignments (id, user_id, shift_template_id, date, created_by, created_at) VALUES (?,?,?,?,?,?)"
    ok(A, (1, 3, 1, "2026-06-15", 2, TS))
    ok(A, (2, 4, 1, "2026-06-16", 2, TS))
    ok(A, (3, 3, 2, "2026-06-17", None, TS))
    LR = "INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, days, status, decided_by, decided_at, decision_comment, cancelled_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    ok(LR, (1, 3, 1, "2026-06-15", "2026-06-16", 2, "pending", None, None, None, None, TS))
    ok(LR, (2, 4, 1, "2026-06-22", "2026-06-26", 5, "approved", 2, TS, None, None, TS))
    ok(LR, (3, 4, 1, "2026-07-01", "2026-07-01", 1, "rejected", 2, TS, "Busy week", None, TS))
    ok(LR, (4, 3, 1, "2026-07-06", "2026-07-07", 2, "cancelled", 2, TS, None, TS, TS))
    L = "INSERT INTO balance_ledger (user_id, leave_type_id, year, kind, amount, period, leave_request_id, reason, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ok(L, (3, 1, 2026, "accrual", 1.5, "2026-06", None, "", None, TS))
    ok(L, (3, 1, 2025, "year_end_close", -4.0, "2025", None, "", None, TS))
    ok(L, (3, 1, 2026, "carry_forward", 4.0, "2025", None, "", None, TS))
    ok(L, (4, 1, 2026, "leave_taken", -5, None, 2, "", 2, TS))
    ok(L, (3, 1, 2026, "adjustment", -0.5, None, None, "Correction", 1, TS))
    refund_ledger = ok(L, (3, 1, 2026, "leave_refund", 1, None, 4, "", None, TS))
    ok("INSERT INTO leave_removed_shifts (leave_request_id, user_id, shift_template_id, date) VALUES (4, 3, 1, '2026-07-06')")
    ok("INSERT INTO leave_removed_shifts (leave_request_id, user_id, shift_template_id, date, status, restored_assignment_id) VALUES (4, 3, 2, '2026-07-07', 'restored', 3)")
    RD = "INSERT INTO leave_refund_days (leave_request_id, user_id, leave_type_id, date, shifts_removed, status, ledger_entry_id, resolved_at) VALUES (?,?,?,?,?,?,?,?)"
    ok(RD, (4, 3, 1, "2026-07-06", 1, "owed", None, None))
    ok(RD, (4, 3, 1, "2026-07-07", 1, "refunded", refund_ledger, TS))
    SW = "INSERT INTO swap_requests (requester_id, target_id, team_id, requester_assignment_id, target_assignment_id, requester_shift_id, requester_date, target_shift_id, target_date, status, peer_responded_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    ok(SW, (3, 4, 1, 1, 2, 1, "2026-06-15", 1, "2026-06-16", "pending_peer", None, TS))
    ok("INSERT INTO notifications (user_id, kind, message, link, created_at) VALUES (2, 'approval', 'New leave request', '/approvals', ?)", (TS,))
    ok("INSERT INTO audit_log (actor_id, actor_name, action, entity_type, entity_id, team_id, after_json, created_at) VALUES (2, 'Meera', 'leave.approve', 'leave_request', 2, 1, '{\"status\":\"approved\"}', ?)", (TS,))
    ok("INSERT INTO audit_log (actor_id, actor_name, action, entity_type, created_at) VALUES (NULL, 'System', 'seed', 'system', ?)", (TS,))

    # restored assignment deleted -> link cleared, not blocked
    ok("DELETE FROM shift_assignments WHERE id = 3")
    assert db.execute("SELECT restored_assignment_id FROM leave_removed_shifts WHERE shift_template_id = 2").fetchone() == (None,)

    # --- bad data --------------------------------------------------------------------------------------------------
    bad("dup team name, other case", "INSERT INTO teams (name, created_at) VALUES ('SUPPORT', ?)", (TS,))
    bad("manager of two teams", "INSERT INTO teams (name, manager_id, created_at) VALUES ('Billing', 2, ?)", (TS,))
    bad("upper-case email", U, (9, "X", "X@example.com", "h", "employee", 1, "2026-01-01", TS, TS))
    bad("dup email", U, (9, "X", "arjun@example.com", "h", "employee", 1, "2026-01-01", TS, TS))
    bad("hr with team", U, (9, "X", "x@example.com", "h", "hr_admin", 1, "2026-01-01", TS, TS))
    bad("employee no team", U, (9, "X", "x@example.com", "h", "employee", None, "2026-01-01", TS, TS))
    bad("bad role", U, (9, "X", "x@example.com", "h", "boss", 1, "2026-01-01", TS, TS))
    bad("bad join date", U, (9, "X", "x@example.com", "h", "employee", 1, "2026-02-30", TS, TS))
    bad("unknown team fk", U, (9, "X", "x@example.com", "h", "employee", 99, "2026-01-01", TS, TS))
    bad("inactive without deactivated_at", "UPDATE users SET active = 0 WHERE id = 3")
    bad("entitlement > 366", "INSERT INTO leave_types (name, annual_entitlement, carry_forward_cap) VALUES ('X', 400, 0)")
    bad("entitlement as text", "INSERT INTO leave_types (name, annual_entitlement, carry_forward_cap) VALUES ('X', 'lots', 0)")
    bad("dup shift name in team", ST, (9, 1, "morning", "06:00", "14:00", "0", 1))
    bad("start = end", ST, (9, 1, "X", "06:00", "06:00", "0", 1))
    bad("time 24:00", ST, (9, 1, "X", "24:00", "06:00", "0", 1))
    bad("time 7:00", ST, (9, 1, "X", "7:00", "15:00", "0", 1))
    for dow in ["", "7", "0,,1", "0,", ",0", "01", "0;1", "a"]:
        bad(f"days_of_week {dow!r}", ST, (9, 1, "X", "06:00", "14:00", dow, 1))
    bad("negative min headcount", ST, (9, 1, "X", "06:00", "14:00", "0", -1))
    bad("fractional min headcount", ST, (9, 1, "X", "06:00", "14:00", "0", 1.5))
    bad("double assignment", A, (9, 3, 1, "2026-06-15", 2, TS))
    bad("bad assignment date", A, (9, 3, 1, "2026-6-15", 2, TS))
    bad("end before start", LR, (9, 3, 1, "2026-06-16", "2026-06-15", 1, "pending", None, None, None, None, TS))
    bad("spans two years", LR, (9, 3, 1, "2026-12-31", "2027-01-01", 1, "pending", None, None, None, None, TS))
    bad("zero days", LR, (9, 3, 1, "2026-06-13", "2026-06-14", 0, "pending", None, None, None, None, TS))
    bad("reject without comment", LR, (9, 3, 1, "2026-06-15", "2026-06-15", 1, "rejected", 2, TS, "  ", None, TS))
    bad("approved without decider", LR, (9, 3, 1, "2026-06-15", "2026-06-15", 1, "approved", None, None, None, None, TS))
    bad("cancelled without cancelled_at", LR, (9, 3, 1, "2026-06-15", "2026-06-15", 1, "cancelled", None, None, None, None, TS))
    bad("dup accrual (idempotency)", L, (3, 1, 2026, "accrual", 1.5, "2026-06", None, "", None, TS))
    bad("accrual no period", L, (3, 1, 2026, "accrual", 1.5, None, None, "", None, TS))
    bad("accrual month 13", L, (3, 1, 2026, "accrual", 1.5, "2026-13", None, "", None, TS))
    bad("accrual wrong year", L, (3, 1, 2026, "accrual", 1.5, "2025-12", None, "", None, TS))
    bad("negative accrual", L, (3, 1, 2026, "accrual", -1, "2026-05", None, "", None, TS))
    bad("carry_forward period = own year", L, (4, 1, 2026, "carry_forward", 1, "2026", None, "", None, TS))
    bad("positive year_end_close", L, (4, 1, 2025, "year_end_close", 1, "2025", None, "", None, TS))
    bad("leave_taken positive", L, (3, 1, 2026, "leave_taken", 2, None, 1, "", None, TS))
    bad("leave_taken without request", L, (3, 1, 2026, "leave_taken", -2, None, None, "", None, TS))
    bad("second leave_taken for request", L, (4, 1, 2026, "leave_taken", -5, None, 2, "", 2, TS))
    bad("adjustment no reason", L, (3, 1, 2026, "adjustment", 1, None, None, " ", 1, TS))
    bad("adjustment zero", L, (3, 1, 2026, "adjustment", 0, None, None, "x", 1, TS))
    bad("accrual with request id", L, (3, 1, 2026, "accrual", 1, "2026-05", 1, "", None, TS))
    bad("not_restored without note", "INSERT INTO leave_removed_shifts (leave_request_id, user_id, shift_template_id, date, status) VALUES (4, 3, 1, '2026-07-07', 'not_restored')")
    bad("refund day on Saturday", RD, (4, 3, 1, "2026-07-11", 1, "owed", None, None))
    bad("refunded without ledger", RD, (4, 3, 1, "2026-07-08", 1, "refunded", None, TS))
    bad("owed with resolved_at", RD, (4, 3, 1, "2026-07-08", 1, "owed", None, TS))
    bad("forfeited without resolved_at", RD, (4, 3, 1, "2026-07-08", 1, "forfeited", None, None))
    bad("owed with zero shifts", RD, (4, 3, 1, "2026-07-08", 0, "owed", None, None))
    bad("dup refund day", RD, (4, 3, 1, "2026-07-06", 1, "owed", None, None))
    bad("swap with self", SW, (3, 3, 1, 5, 6, 1, "2026-06-15", 1, "2026-06-16", "pending_peer", None, TS))
    bad("assignment in two open swaps", SW, (3, 4, 1, 1, 7, 1, "2026-06-15", 1, "2026-06-16", "pending_peer", None, TS))
    bad("pending_manager without peer response", SW, (3, 4, 1, 8, 9, 1, "2026-06-15", 1, "2026-06-16", "pending_manager", None, TS))
    bad("bad notification kind", "INSERT INTO notifications (user_id, kind, message, created_at) VALUES (2, 'email', 'x', ?)", (TS,))
    bad("invalid audit json", "INSERT INTO audit_log (actor_name, action, entity_type, before_json, created_at) VALUES ('S', 'user.update', 'user', '{oops', ?)", (TS,))
    bad("audit update", "UPDATE audit_log SET actor_name = 'X'")
    bad("audit delete", "DELETE FROM audit_log")

    # closed swaps free the assignment for a new one
    ok("UPDATE swap_requests SET status = 'cancelled'")
    ok(SW, (3, 4, 1, 1, 2, 1, "2026-06-15", 1, "2026-06-16", "pending_peer", None, TS))

    # reset path (P5): drop triggers, clear tables, re-run schema
    db.executescript("DROP TRIGGER audit_log_no_update; DROP TRIGGER audit_log_no_delete; DELETE FROM audit_log;")
    db.executescript(sql)
    ok("INSERT INTO audit_log (actor_name, action, entity_type, created_at) VALUES ('System', 'seed', 'system', ?)", (TS,))
    bad("audit delete after re-create", "DELETE FROM audit_log")

    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    db.close()
    assert fails == []
