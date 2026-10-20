'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

let conn = null;
const cache = new Map();
let depth = 0;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee','manager','hr_admin')),
  manager_id INTEGER REFERENCES users(id),
  department TEXT NOT NULL,
  title TEXT,
  hire_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leave_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  annual_allowance REAL NOT NULL DEFAULT 0,
  carry_over_max REAL NOT NULL DEFAULT 0,
  paid INTEGER NOT NULL DEFAULT 1,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  allow_negative INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leave_balances (
  user_id INTEGER NOT NULL REFERENCES users(id),
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  allocated REAL,            -- NULL = use the leave type's annual allowance
  carried_over REAL NOT NULL DEFAULT 0,
  adjustment REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, leave_type_id, year)
);
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  half_day INTEGER NOT NULL DEFAULT 0,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);
CREATE TABLE IF NOT EXISTS leave_request_days (
  request_id INTEGER NOT NULL REFERENCES leave_requests(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  PRIMARY KEY (request_id, date)
);
CREATE INDEX IF NOT EXISTS idx_lrd_date ON leave_request_days(date);
CREATE TABLE IF NOT EXISTS holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shift_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  shift_type_id INTEGER REFERENCES shift_types(id),
  label TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shift_user_date ON shifts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_date ON shifts(date);
CREATE TABLE IF NOT EXISTS shift_swaps (
  id INTEGER PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  requester_shift_id INTEGER NOT NULL REFERENCES shifts(id),
  target_id INTEGER NOT NULL REFERENCES users(id),
  target_shift_id INTEGER REFERENCES shifts(id),
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_peer','pending_manager','approved','rejected','declined','cancelled','expired')),
  peer_responded_at TEXT,
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  actor_id INTEGER,
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  summary TEXT NOT NULL,
  details TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
`;

function open(file) {
  if (conn) close();
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  conn = new DatabaseSync(file);
  conn.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') conn.exec('PRAGMA journal_mode = WAL;');
  conn.exec('PRAGMA busy_timeout = 5000;');
  conn.exec(SCHEMA);
  return conn;
}
function close() {
  if (conn) conn.close();
  conn = null;
  cache.clear();
  depth = 0;
}
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) {
    s = conn.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}
const norm = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
const all = (sql, ...p) => stmt(sql).all(...norm(p)).map((r) => ({ ...r }));
const get = (sql, ...p) => {
  const r = stmt(sql).get(...norm(p));
  return r ? { ...r } : undefined;
};
const run = (sql, ...p) => {
  const r = stmt(sql).run(...norm(p));
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
};
// Run fn atomically. Nested calls join the outer transaction.
function tx(fn) {
  if (depth > 0) return fn();
  conn.exec('BEGIN IMMEDIATE');
  depth++;
  try {
    const r = fn();
    conn.exec('COMMIT');
    return r;
  } catch (e) {
    conn.exec('ROLLBACK');
    throw e;
  } finally {
    depth--;
  }
}

module.exports = { open, close, all, get, run, tx };
