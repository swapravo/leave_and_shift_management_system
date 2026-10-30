-- Leave & Shift Management System: SQLite schema.
-- Source of truth for the design: docs/05-data-model.md (tables, derived values, state machines).
--
-- Run by P1 init_db() at startup. Every statement is idempotent (IF NOT EXISTS / OR IGNORE), so it is safe
-- to run on an existing database.
--
-- Set per connection by db.connect(), not here: PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000.
-- Set once per database by init_db():       PRAGMA journal_mode = WAL.
--
-- Conventions
--   * STRICT tables: SQLite rejects values of the wrong type instead of silently storing them.
--   * Dates      TEXT 'YYYY-MM-DD' (IST calendar date), checked with date(x) = x.
--   * Times      TEXT 'HH:MM' (24 h).
--   * Timestamps TEXT ISO-8601 with '+05:30', e.g. '2026-10-28T10:15:00+05:30'.
--   * Booleans   INTEGER 0/1.
--   * Leave quantities REAL, rounded to 2 decimals in code.
--   * Nothing is hard-deleted except shift_assignments rows (an unassignment), and every such delete is audited.
--   * Rules that need other rows (e.g. "manager_id points to an active manager of this team") are enforced in
--     the service layer; CHECKs here cover what a single row can prove.

-- ---------------------------------------------------------------------------------------------------------------
-- schema_meta
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
) STRICT;

INSERT OR IGNORE INTO schema_meta (key, value) VALUES ('schema_version', '2');   -- 2: birthday leave (db.upgrade)

-- ---------------------------------------------------------------------------------------------------------------
-- teams  (C2). Flat: department is only a label. manager_id NULL = no manager -> members can't submit leave/swaps.
-- Service invariant: manager_id is an active user with role 'manager' whose team_id is this team.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
    department TEXT    NOT NULL DEFAULT '',
    manager_id INTEGER UNIQUE REFERENCES users (id),          -- UNIQUE: a user manages at most one team
    created_at TEXT    NOT NULL
) STRICT;

-- ---------------------------------------------------------------------------------------------------------------
-- users  (C2). Soft delete only: active = 0 plus deactivated_at.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY,
    name                TEXT    NOT NULL CHECK (length(trim(name)) > 0),
    email               TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (email COLLATE BINARY = lower(email) AND email LIKE '%_@_%'),
    password_hash       TEXT    NOT NULL CHECK (length(password_hash) > 0),            -- bcrypt
    role                TEXT    NOT NULL CHECK (role IN ('employee', 'manager', 'hr_admin')),
    team_id             INTEGER REFERENCES teams (id),
    join_date           TEXT    NOT NULL CHECK (date(join_date) IS join_date),          -- accrual starts this month
    date_of_birth       TEXT    CHECK (date_of_birth IS NULL OR date(date_of_birth) IS date_of_birth),  -- birthday leave
    active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    password_changed_at TEXT    NOT NULL,                                               -- older JWTs are rejected
    created_at          TEXT    NOT NULL,
    deactivated_at      TEXT,
    CHECK ((role = 'hr_admin') = (team_id IS NULL)),          -- HR Admins have no team; everyone else has one
    CHECK ((active = 0) = (deactivated_at IS NOT NULL))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_users_team ON users (team_id, active);

-- ---------------------------------------------------------------------------------------------------------------
-- leave_types  (C3). active = 0 means archived: no new accrual or applications; history stays.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_types (
    id                 INTEGER PRIMARY KEY,
    name               TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
    annual_entitlement REAL    NOT NULL CHECK (annual_entitlement BETWEEN 0 AND 366),
    carry_forward_cap  REAL    NOT NULL CHECK (carry_forward_cap >= 0),
    active             INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
) STRICT;

-- ---------------------------------------------------------------------------------------------------------------
-- shift_templates  (C4). Per team; team_id never changes. end_time <= start_time means the shift ends the next day.
-- days_of_week: comma-separated, 0 = Monday ... 6 = Sunday, e.g. '0,1,2,3,4' (sorted, no repeats: service-enforced).
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_templates (
    id            INTEGER PRIMARY KEY,
    team_id       INTEGER NOT NULL REFERENCES teams (id),
    name          TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
    start_time    TEXT    NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]' AND start_time < '24:00'),
    end_time      TEXT    NOT NULL CHECK (end_time GLOB '[0-2][0-9]:[0-5][0-9]' AND end_time < '24:00'),
    days_of_week  TEXT    NOT NULL CHECK (
                      days_of_week GLOB '[0-6]*'
                      AND days_of_week NOT GLOB '*[^0-6,]*'
                      AND days_of_week NOT GLOB '*,'
                      AND days_of_week NOT GLOB '*,,*'
                      AND days_of_week NOT GLOB '*[0-6][0-6]*'
                  ),
    min_headcount INTEGER NOT NULL CHECK (min_headcount >= 0),
    active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    CHECK (end_time <> start_time),
    UNIQUE (team_id, name)
) STRICT;

-- ---------------------------------------------------------------------------------------------------------------
-- shift_assignments  (C7) - the roster. One row = one person on one shift on one date (the date the shift starts).
-- A swap changes user_id on two rows in place. Unassigning deletes the row (audited).
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_assignments (
    id                INTEGER PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users (id),
    shift_template_id INTEGER NOT NULL REFERENCES shift_templates (id),
    date              TEXT    NOT NULL CHECK (date(date) IS date),
    created_by        INTEGER REFERENCES users (id),          -- NULL = system (e.g. restored on leave cancel)
    created_at        TEXT    NOT NULL,
    UNIQUE (user_id, shift_template_id, date)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_assignments_shift_date ON shift_assignments (shift_template_id, date);
CREATE INDEX IF NOT EXISTS ix_assignments_user_date  ON shift_assignments (user_id, date);
CREATE INDEX IF NOT EXISTS ix_assignments_date       ON shift_assignments (date);

-- ---------------------------------------------------------------------------------------------------------------
-- leave_requests  (C6). days = Mon-Fri dates in the range, fixed at submission.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users (id),
    leave_type_id    INTEGER NOT NULL REFERENCES leave_types (id),
    start_date       TEXT    NOT NULL CHECK (date(start_date) IS start_date),
    end_date         TEXT    NOT NULL CHECK (date(end_date) IS end_date),
    days             REAL    NOT NULL CHECK (days > 0),
    reason           TEXT    NOT NULL DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    decided_by       INTEGER REFERENCES users (id),
    decided_at       TEXT,
    decision_comment TEXT,
    cancelled_at     TEXT,
    created_at       TEXT    NOT NULL,
    CHECK (end_date >= start_date),
    CHECK (substr(start_date, 1, 4) = substr(end_date, 1, 4)),                 -- one calendar year per request
    CHECK (status NOT IN ('approved', 'rejected') OR decided_at IS NOT NULL),
    CHECK (status <> 'rejected' OR decided_by IS NOT NULL),
    -- Only the system's birthday grant is approved without a human approver (decided_by NULL).
    CHECK (status <> 'approved' OR decided_by IS NOT NULL OR reason = 'Birthday leave'),
    CHECK (status <> 'rejected' OR length(trim(coalesce(decision_comment, ''))) > 0),
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_leave_user_status ON leave_requests (user_id, status);
CREATE INDEX IF NOT EXISTS ix_leave_dates       ON leave_requests (start_date, end_date);

-- ---------------------------------------------------------------------------------------------------------------
-- birthday_grants  (C6). One row per person per birthday year, so the grant runs at most once even if the leave it
-- created is cancelled later. year = the calendar year of the birthday itself. leave_request_id is NULL when the day
-- was only credited (they were already on leave that day).
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS birthday_grants (
    user_id          INTEGER NOT NULL REFERENCES users (id),
    year             INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    leave_request_id INTEGER UNIQUE REFERENCES leave_requests (id),
    created_at       TEXT    NOT NULL,
    PRIMARY KEY (user_id, year)
) STRICT;

-- ---------------------------------------------------------------------------------------------------------------
-- leave_removed_shifts  (C6). Shifts taken away when leave was approved, so a cancellation can restore them.
-- status stays 'removed' until the leave is cancelled, then becomes 'restored' or 'not_restored' (+ note).
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_removed_shifts (
    id                     INTEGER PRIMARY KEY,
    leave_request_id       INTEGER NOT NULL REFERENCES leave_requests (id),
    user_id                INTEGER NOT NULL REFERENCES users (id),
    shift_template_id      INTEGER NOT NULL REFERENCES shift_templates (id),
    date                   TEXT    NOT NULL CHECK (date(date) IS date),
    status                 TEXT    NOT NULL DEFAULT 'removed'
                                   CHECK (status IN ('removed', 'restored', 'not_restored')),
    -- The assignment created on restore. It may be unassigned later, so the link is cleared rather than blocking.
    restored_assignment_id INTEGER REFERENCES shift_assignments (id) ON DELETE SET NULL,
    note                   TEXT,                              -- why it wasn't restored, e.g. 'Shift archived'
    CHECK (status <> 'not_restored' OR note IS NOT NULL),
    UNIQUE (leave_request_id, shift_template_id, date)
) STRICT;

-- ---------------------------------------------------------------------------------------------------------------
-- balance_ledger  (C5). Every balance movement; balances are never stored, only summed (data model 5.3).
-- year = the balance year the movement belongs to.
-- period: 'YYYY-MM' for accrual; the closing year 'YYYY' for year_end_close (in that year) and carry_forward
-- (in the following year); NULL otherwise.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS balance_ledger (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users (id),
    leave_type_id    INTEGER NOT NULL REFERENCES leave_types (id),
    year             INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    kind             TEXT    NOT NULL CHECK (kind IN ('accrual', 'carry_forward', 'year_end_close',
                                                      'leave_taken', 'leave_refund', 'adjustment')),
    amount           REAL    NOT NULL,                        -- + credit, - debit
    period           TEXT,
    leave_request_id INTEGER REFERENCES leave_requests (id),
    reason           TEXT    NOT NULL DEFAULT '',
    created_by       INTEGER REFERENCES users (id),           -- NULL = system
    created_at       TEXT    NOT NULL,
    -- sign of each kind
    CHECK (kind NOT IN ('accrual', 'carry_forward') OR amount >= 0),
    CHECK (kind <> 'year_end_close' OR amount <= 0),
    CHECK (kind <> 'leave_taken' OR amount < 0),
    CHECK (kind <> 'leave_refund' OR amount > 0),
    CHECK (kind <> 'adjustment' OR (amount <> 0 AND length(trim(reason)) > 0)),
    -- period shape of each kind
    CHECK (CASE kind
               WHEN 'accrual'        THEN period IS NOT NULL
                                          AND period GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'
                                          AND substr(period, 6, 2) BETWEEN '01' AND '12'
                                          AND CAST(substr(period, 1, 4) AS INTEGER) = year
               WHEN 'year_end_close' THEN period IS CAST(year AS TEXT)
               WHEN 'carry_forward'  THEN period IS CAST(year - 1 AS TEXT)
               ELSE period IS NULL
           END),
    -- leave movements point at their request; nothing else does
    CHECK ((kind IN ('leave_taken', 'leave_refund')) = (leave_request_id IS NOT NULL))
) STRICT;

CREATE INDEX IF NOT EXISTS ix_ledger_user_year ON balance_ledger (user_id, year, leave_type_id);

-- Accrual and year-end runs are idempotent: one row per (user, type, kind, period).
CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_period
    ON balance_ledger (user_id, leave_type_id, kind, period)
    WHERE kind IN ('accrual', 'carry_forward', 'year_end_close');

-- An approved request is deducted exactly once.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_leave_taken
    ON balance_ledger (leave_request_id)
    WHERE kind = 'leave_taken';

-- ---------------------------------------------------------------------------------------------------------------
-- leave_refund_days  (C6). Per-day refund state after cancelling approved leave (data model 5.4).
--   refunded  - ledger_entry_id points at the +1 leave_refund row
--   owed      - waits until the person is rostered on >= shifts_removed shifts that day
--   forfeited - the date passed while owed
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_refund_days (
    id               INTEGER PRIMARY KEY,
    leave_request_id INTEGER NOT NULL REFERENCES leave_requests (id),
    user_id          INTEGER NOT NULL REFERENCES users (id),
    leave_type_id    INTEGER NOT NULL REFERENCES leave_types (id),
    date             TEXT    NOT NULL CHECK (date(date) IS date AND strftime('%w', date) NOT IN ('0', '6')),
    shifts_removed   INTEGER NOT NULL CHECK (shifts_removed >= 0),
    status           TEXT    NOT NULL CHECK (status IN ('refunded', 'owed', 'forfeited')),
    ledger_entry_id  INTEGER UNIQUE REFERENCES balance_ledger (id),
    resolved_at      TEXT,
    CHECK ((status = 'refunded') = (ledger_entry_id IS NOT NULL)),
    CHECK ((status = 'owed') = (resolved_at IS NULL)),
    CHECK (status <> 'owed' OR shifts_removed > 0),
    UNIQUE (leave_request_id, date)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_refund_user_date ON leave_refund_days (user_id, date, status);

-- ---------------------------------------------------------------------------------------------------------------
-- swap_requests  (C8). 1-for-1 exchange inside one team.
-- The *_assignment_id columns have no foreign key on purpose: closed swaps keep pointing at assignments that may
-- since have been unassigned (deleted). The snapshot columns record what each shift was at proposal time.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS swap_requests (
    id                      INTEGER PRIMARY KEY,
    requester_id            INTEGER NOT NULL REFERENCES users (id),
    target_id               INTEGER NOT NULL REFERENCES users (id),
    team_id                 INTEGER NOT NULL REFERENCES teams (id),
    requester_assignment_id INTEGER NOT NULL,                 -- the shift the requester gives away
    target_assignment_id    INTEGER NOT NULL,                 -- the shift the requester takes over
    requester_shift_id      INTEGER NOT NULL REFERENCES shift_templates (id),
    requester_date          TEXT    NOT NULL CHECK (date(requester_date) IS requester_date),
    target_shift_id         INTEGER NOT NULL REFERENCES shift_templates (id),
    target_date             TEXT    NOT NULL CHECK (date(target_date) IS target_date),
    status                  TEXT    NOT NULL DEFAULT 'pending_peer'
                                    CHECK (status IN ('pending_peer', 'pending_manager', 'approved',
                                                      'rejected', 'declined', 'cancelled')),
    peer_responded_at       TEXT,
    decided_by              INTEGER REFERENCES users (id),
    decided_at              TEXT,
    decision_comment        TEXT,
    created_at              TEXT    NOT NULL,
    CHECK (requester_id <> target_id),
    CHECK (requester_assignment_id <> target_assignment_id),
    CHECK (status NOT IN ('pending_manager', 'approved', 'rejected', 'declined') OR peer_responded_at IS NOT NULL),
    CHECK (status NOT IN ('approved', 'rejected') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)),
    CHECK (status <> 'rejected' OR length(trim(coalesce(decision_comment, ''))) > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_swaps_requester ON swap_requests (requester_id, status);
CREATE INDEX IF NOT EXISTS ix_swaps_target    ON swap_requests (target_id, status);
CREATE INDEX IF NOT EXISTS ix_swaps_team      ON swap_requests (team_id, status);

-- An assignment can be in at most one open swap per side. (Being the requester side of one open swap and the target
-- side of another is caught by the service, since one index can't span two columns.)
CREATE UNIQUE INDEX IF NOT EXISTS ux_swaps_open_requester_assignment
    ON swap_requests (requester_assignment_id) WHERE status IN ('pending_peer', 'pending_manager');
CREATE UNIQUE INDEX IF NOT EXISTS ux_swaps_open_target_assignment
    ON swap_requests (target_assignment_id) WHERE status IN ('pending_peer', 'pending_manager');

-- ---------------------------------------------------------------------------------------------------------------
-- notifications  (C12). In-app only.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    kind       TEXT    NOT NULL CHECK (kind IN ('approval', 'leave', 'swap', 'roster', 'coverage')),
    message    TEXT    NOT NULL CHECK (length(message) > 0),
    link       TEXT    NOT NULL DEFAULT '',                   -- in-app route, e.g. '/approvals'
    read       INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
    created_at TEXT    NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications (user_id, read, id);

-- ---------------------------------------------------------------------------------------------------------------
-- audit_log  (C11). Append-only: the triggers below abort any UPDATE or DELETE.
-- actor_id NULL = System. actor_name is copied so the log reads correctly forever.
-- before_json / after_json never contain password hashes (stripped by services/audit.py).
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY,
    actor_id    INTEGER REFERENCES users (id),
    actor_name  TEXT    NOT NULL,
    action      TEXT    NOT NULL CHECK (action GLOB '[a-z]*' AND (action GLOB '*.*' OR action = 'seed')),
    entity_type TEXT    NOT NULL,
    entity_id   INTEGER,
    team_id     INTEGER REFERENCES teams (id),                -- lets a manager see their team's entries
    before_json TEXT    CHECK (before_json IS NULL OR json_valid(before_json)),
    after_json  TEXT    CHECK (after_json IS NULL OR json_valid(after_json)),
    created_at  TEXT    NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_audit_team   ON audit_log (team_id, id);
CREATE INDEX IF NOT EXISTS ix_audit_actor  ON audit_log (actor_id, id);
CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log (entity_type, entity_id);

-- The test-only reset (P5) drops these two triggers, clears every table, re-runs this file, then seeds.
CREATE TRIGGER IF NOT EXISTS audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only');
END;
