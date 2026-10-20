'use strict';
// Users, holidays, notifications, audit log, calendar, dashboards.
const db = require('./db');
const L = require('./lib');
const core = require('./core');
const auth = require('./auth');
const leave = require('./leave');
const shifts = require('./shifts');

const inList = (arr) => arr.map(() => '?').join(',');

// ---------------------------------------------------------------- me
function me({ user }) {
  shifts.sweepSwaps();
  const unread = db.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL', user.id).n;
  let approvals = 0;
  if (core.isApprover(user)) {
    approvals = leave.listRequests({ user, query: { scope: 'approvals', status: 'pending' } }).length
      + shifts.listSwaps({ user, query: { scope: 'approvals' } }).swaps.filter((s) => s.can_decide).length;
  }
  const incoming = db.get("SELECT COUNT(*) n FROM shift_swaps WHERE target_id=? AND status='pending_peer'", user.id).n;
  const mgr = user.manager_id ? core.getUser(user.manager_id) : null;
  return { user: { ...auth.publicUser(user), manager_name: mgr ? mgr.name : null }, today: L.today(), unread, approvals, incoming_swaps: incoming };
}
function changePassword({ user, body }) {
  const row = core.getUser(user.id);
  if (!auth.verifyPassword(String(body.current || ''), row.password_hash)) throw L.bad('Current password is incorrect', 'current');
  auth.checkPasswordPolicy(body.password);
  db.run('UPDATE users SET password_hash=? WHERE id=?', auth.hashPassword(body.password), user.id);
  core.audit(user, 'user.change_password', 'user', user.id, `${user.name} changed their password`, null);
  return { ok: true };
}

// ---------------------------------------------------------------- users (HR)
function userOut(u) {
  const { password_hash, ...rest } = u;
  return { ...rest, active: !!rest.active };
}
function listUsers({ user, query }) {
  if (user.role === 'hr_admin') {
    const rows = db.all(`SELECT u.*, m.name AS manager_name FROM users u LEFT JOIN users m ON m.id=u.manager_id ${query.include_inactive ? '' : 'WHERE u.active=1'} ORDER BY u.active DESC, u.name`);
    return { users: rows.map(userOut) };
  }
  return { users: core.visibleUsers(user).map(core.slim) };
}
function userInput(b, existing) {
  const role = L.oneOf(b.role ?? existing?.role, 'role', ['employee', 'manager', 'hr_admin']);
  let manager_id = b.manager_id === undefined ? existing?.manager_id ?? null : b.manager_id;
  if (manager_id === '' || manager_id === null) manager_id = null;
  else manager_id = L.int(manager_id, 'manager_id');
  return {
    name: L.str(b.name ?? existing?.name, 'name', { min: 2, max: 80 }),
    email: L.str(b.email ?? existing?.email, 'email', { max: 120 }).toLowerCase(),
    role,
    manager_id,
    department: L.str(b.department ?? existing?.department, 'department', { max: 60 }),
    title: L.str(b.title === undefined ? existing?.title : b.title, 'title', { required: false, max: 80 }),
    hire_date: L.date(b.hire_date === undefined ? existing?.hire_date : b.hire_date, 'hire_date', false),
  };
}
function checkUserRules(u, id) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) throw L.bad('Enter a valid email address', 'email');
  if (db.get('SELECT id FROM users WHERE email=? AND id<>?', u.email, id || 0)) throw L.conflict('That email is already in use');
  if (u.manager_id !== null) {
    const m = core.getUser(u.manager_id);
    if (!m || !m.active) throw L.bad('Manager not found', 'manager_id');
    if (m.role === 'employee') throw L.bad('The manager must have the Manager or HR admin role', 'manager_id');
    if (id) {
      for (let cur = m, hops = 0; cur && hops < 50; cur = cur.manager_id ? core.getUser(cur.manager_id) : null, hops++) {
        if (cur.id === id) throw L.bad('That would create a reporting loop', 'manager_id');
      }
    }
  }
}
function createUser({ user, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const u = userInput(body);
    checkUserRules(u);
    auth.checkPasswordPolicy(body.password);
    const id = db.run(
      'INSERT INTO users(name,email,password_hash,role,manager_id,department,title,hire_date,active,created_at) VALUES(?,?,?,?,?,?,?,?,1,?)',
      u.name, u.email, auth.hashPassword(body.password), u.role, u.manager_id, u.department, u.title, u.hire_date, L.nowIso(),
    ).id;
    core.audit(user, 'user.create', 'user', id, `${user.name} created ${u.role} account for ${u.name}`, u);
    if (u.manager_id) core.notify(u.manager_id, { type: 'team.added', title: 'New team member', body: `${u.name} now reports to you`, link: '#/team' });
    return { user: userOut(core.getUser(id)) };
  });
}
function updateUser({ user, params, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const id = Number(params.id);
    const before = core.requireUser(id);
    const u = userInput(body, before);
    const active = body.active === undefined ? !!before.active : L.bool(body.active);
    checkUserRules(u, id);
    if (id === user.id && (!active || u.role !== 'hr_admin')) throw L.conflict('You cannot deactivate or demote your own account');
    if (u.role === 'employee') {
      const reports = db.get('SELECT COUNT(*) n FROM users WHERE manager_id=? AND active=1', id).n;
      if (reports) throw L.conflict(`${before.name} has ${reports} direct report(s). Reassign them before changing this role.`);
    }
    if (!active && before.active) {
      const reports = db.get('SELECT COUNT(*) n FROM users WHERE manager_id=? AND active=1', id).n;
      if (reports) throw L.conflict(`${before.name} has ${reports} direct report(s). Reassign them before deactivating.`);
    }
    db.run('UPDATE users SET name=?,email=?,role=?,manager_id=?,department=?,title=?,hire_date=?,active=? WHERE id=?',
      u.name, u.email, u.role, u.manager_id, u.department, u.title, u.hire_date, active, id);
    const changes = {};
    for (const k of Object.keys(u)) if (before[k] !== u[k]) changes[k] = { from: before[k], to: u[k] };
    if (!!before.active !== active) changes.active = { from: !!before.active, to: active };
    if (!active && before.active) {
      auth.destroyUserSessions(id);
      const now = L.nowIso();
      db.run("UPDATE leave_requests SET status='cancelled', decision_note='Account deactivated', decided_at=?, updated_at=? WHERE user_id=? AND status='pending'", now, now, id);
      for (const s of db.all("SELECT id FROM shifts WHERE user_id=? AND status='scheduled' AND date>=?", id, L.today())) shifts.cancelShift(s.id, user, 'Employee account deactivated');
    }
    core.audit(user, 'user.update', 'user', id, `${user.name} updated ${u.name}'s account`, changes);
    if (before.manager_id !== u.manager_id && u.manager_id) core.notify(u.manager_id, { type: 'team.added', title: 'New team member', body: `${u.name} now reports to you`, link: '#/team' });
    return { user: userOut(core.getUser(id)) };
  });
}
function resetPassword({ user, params, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const t = core.requireUser(Number(params.id));
    auth.checkPasswordPolicy(body.password);
    db.run('UPDATE users SET password_hash=? WHERE id=?', auth.hashPassword(body.password), t.id);
    auth.destroyUserSessions(t.id);
    core.audit(user, 'user.reset_password', 'user', t.id, `${user.name} reset the password for ${t.name}`, null);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- holidays (HR)
function listHolidays({ query }) {
  const year = query.year ? Number(query.year) : Number(L.today().slice(0, 4));
  return { year, holidays: db.all('SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date', `${year}-01-01`, `${year}-12-31`) };
}
function addHoliday({ user, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const date = L.date(body.date, 'date');
    const name = L.str(body.name, 'name', { max: 80 });
    if (db.get('SELECT 1 x FROM holidays WHERE date=?', date)) throw L.conflict('There is already a holiday on that date');
    db.run('INSERT INTO holidays(date,name) VALUES(?,?)', date, name);
    core.audit(user, 'holiday.create', 'holiday', null, `${user.name} added holiday "${name}" on ${date}`, { date, name });
    return { ok: true };
  });
}
function deleteHoliday({ user, params }) {
  core.requireHr(user);
  return db.tx(() => {
    const h = db.get('SELECT * FROM holidays WHERE date=?', params.date);
    if (!h) throw L.notFound('Holiday not found');
    db.run('DELETE FROM holidays WHERE date=?', params.date);
    core.audit(user, 'holiday.delete', 'holiday', null, `${user.name} removed holiday "${h.name}" on ${h.date}`, h);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- notifications
function listNotifications({ user, query }) {
  const limit = Math.min(Number(query.limit) || 30, 100);
  const rows = db.all(`SELECT * FROM notifications WHERE user_id=? ${query.unread ? 'AND read_at IS NULL' : ''} ORDER BY id DESC LIMIT ${limit}`, user.id);
  const unread = db.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL', user.id).n;
  return { notifications: rows.map((n) => ({ ...n, read: !!n.read_at })), unread };
}
function markRead({ user, params }) {
  const r = db.run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?', L.nowIso(), Number(params.id), user.id);
  if (!r.changes) throw L.notFound('Notification not found');
  return { ok: true };
}
function markAllRead({ user }) {
  db.run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', L.nowIso(), user.id);
  return { ok: true };
}

// ---------------------------------------------------------------- audit log (HR)
function auditWhere(query) {
  const where = [];
  const params = [];
  if (query.q) {
    where.push('(summary LIKE ? OR actor_name LIKE ?)');
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.action) { where.push('action LIKE ?'); params.push(`${query.action}%`); }
  if (query.actor_id) { where.push('actor_id = ?'); params.push(Number(query.actor_id)); }
  if (query.entity_type) { where.push('entity_type = ?'); params.push(query.entity_type); }
  if (query.entity_id) { where.push('entity_id = ?'); params.push(Number(query.entity_id)); }
  if (query.from) { L.date(query.from, 'from'); where.push('ts >= ?'); params.push(query.from); }
  if (query.to) { L.date(query.to, 'to'); where.push('ts < ?'); params.push(L.addDays(query.to, 1)); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}
function listAudit({ user, query }) {
  core.requireHr(user);
  const { sql, params } = auditWhere(query);
  const limit = Math.min(Number(query.limit) || 50, 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const rows = db.all(`SELECT * FROM audit_log ${sql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, ...params);
  const total = db.get(`SELECT COUNT(*) n FROM audit_log ${sql}`, ...params).n;
  return {
    total, limit, offset,
    entries: rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null })),
    actions: db.all('SELECT DISTINCT action FROM audit_log ORDER BY action').map((r) => r.action),
    actors: db.all('SELECT DISTINCT actor_id id, actor_name name FROM audit_log WHERE actor_id IS NOT NULL ORDER BY actor_name'),
  };
}
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function auditCsv({ user, query }) {
  core.requireHr(user);
  const { sql, params } = auditWhere(query);
  const rows = db.all(`SELECT * FROM audit_log ${sql} ORDER BY id DESC LIMIT 50000`, ...params);
  const head = ['id', 'timestamp', 'actor', 'role', 'action', 'entity_type', 'entity_id', 'summary', 'details', 'ip'];
  const lines = [head.join(',')];
  for (const r of rows) lines.push([r.id, r.ts, r.actor_name, r.actor_role, r.action, r.entity_type, r.entity_id, r.summary, r.details, r.ip].map(csvCell).join(','));
  return { __raw: { type: 'text/csv; charset=utf-8', body: lines.join('\n') + '\n', headers: { 'Content-Disposition': 'attachment; filename="audit-log.csv"' } } };
}

// ---------------------------------------------------------------- team calendar
function calendar({ user, query }) {
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : L.today().slice(0, 7);
  const first = `${month}-01`;
  if (!L.parseDate(first)) throw L.bad('Invalid month', 'month');
  const lastDay = L.addDays(`${L.fmtDate(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)))}`, -1);
  const gridStart = L.mondayOf(first);
  const gridEnd = L.addDays(L.mondayOf(lastDay), 6);
  const dept = user.role === 'employee' ? null : query.department || null;
  const users = core.visibleUsers(user, dept);
  const ids = users.map((u) => u.id);
  const manageSet = new Set(users.filter((u) => core.canManage(user, u)).map((u) => u.id));
  let entries = [];
  if (ids.length) {
    entries = db.all(
      `SELECT d.date, d.amount, r.id AS request_id, r.user_id, r.status, t.name type_name, t.color FROM leave_request_days d
       JOIN leave_requests r ON r.id=d.request_id JOIN leave_types t ON t.id=r.leave_type_id
       WHERE r.status IN ('approved','pending') AND d.date BETWEEN ? AND ? AND r.user_id IN (${inList(ids)}) ORDER BY d.date`,
      gridStart, gridEnd, ...ids,
    );
  }
  entries = entries
    .filter((e) => e.status === 'approved' || e.user_id === user.id || manageSet.has(e.user_id))
    .map((e) => (e.user_id === user.id || manageSet.has(e.user_id) ? e : { ...e, type_name: 'Away', color: '#94a3b8' }));
  return {
    month, first, last: lastDay, grid_start: gridStart, grid_end: gridEnd, today: L.today(),
    holidays: db.all('SELECT * FROM holidays WHERE date BETWEEN ? AND ?', gridStart, gridEnd),
    users: users.map(core.slim), entries,
    departments: user.role === 'hr_admin' ? db.all('SELECT DISTINCT department d FROM users WHERE active=1 ORDER BY d').map((r) => r.d) : [],
    department: dept,
  };
}

// ---------------------------------------------------------------- dashboards
function dashboard({ user }) {
  shifts.sweepSwaps();
  const today = L.today();
  const year = Number(today.slice(0, 4));
  const out = {
    today,
    me: {
      balances: leave.balancesFor(user.id, year).filter((b) => b.active),
      next_shifts: db.all(`${shifts.SHIFT_SELECT} WHERE s.user_id=? AND s.status='scheduled' AND s.date>=? ORDER BY s.date,s.start_time LIMIT 5`, user.id, today),
      upcoming_leave: db.all(`${leave.SELECT_REQ} WHERE r.user_id=? AND r.status IN ('approved','pending') AND r.end_date>=? ORDER BY r.start_date LIMIT 5`, user.id, today),
      incoming_swaps: db.get("SELECT COUNT(*) n FROM shift_swaps WHERE target_id=? AND status='pending_peer'", user.id).n,
      open_swaps: db.get("SELECT COUNT(*) n FROM shift_swaps WHERE requester_id=? AND status IN ('pending_peer','pending_manager')", user.id).n,
    },
  };
  if (core.isApprover(user)) {
    const team = core.teamOf(user);
    const ids = team.map((t) => t.id);
    const pendingLeave = leave.listRequests({ user, query: { scope: 'approvals', status: 'pending' } });
    const pendingSwaps = shifts.listSwaps({ user, query: { scope: 'approvals' } }).swaps.filter((s) => s.can_decide);
    let outToday = [];
    let outSoon = [];
    const coverage = [];
    if (ids.length) {
      outToday = db.all(
        `SELECT r.id, u.id AS user_id, u.name, t.name AS type_name, t.color, r.start_date, r.end_date, d.amount FROM leave_request_days d
         JOIN leave_requests r ON r.id=d.request_id JOIN users u ON u.id=r.user_id JOIN leave_types t ON t.id=r.leave_type_id
         WHERE r.status='approved' AND d.date=? AND r.user_id IN (${inList(ids)}) ORDER BY u.name`, today, ...ids);
      outSoon = db.all(
        `SELECT r.id, u.id AS user_id, u.name, t.name AS type_name, t.color, r.start_date, r.end_date, r.days, r.status FROM leave_requests r
         JOIN users u ON u.id=r.user_id JOIN leave_types t ON t.id=r.leave_type_id
         WHERE r.status IN ('approved') AND r.end_date>=? AND r.start_date<=? AND r.user_id IN (${inList(ids)}) ORDER BY r.start_date, u.name`,
        today, L.addDays(today, 13), ...ids);
      const dates = L.eachDay(today, L.addDays(today, 13));
      const awayRows = db.all(
        `SELECT d.date, SUM(d.amount) a FROM leave_request_days d JOIN leave_requests r ON r.id=d.request_id
         WHERE r.status='approved' AND d.date BETWEEN ? AND ? AND r.user_id IN (${inList(ids)}) GROUP BY d.date`, today, dates[dates.length - 1], ...ids);
      const shiftRows = db.all(
        `SELECT date, COUNT(*) c FROM shifts WHERE status='scheduled' AND date BETWEEN ? AND ? AND user_id IN (${inList(ids)}) GROUP BY date`, today, dates[dates.length - 1], ...ids);
      const hols = db.all('SELECT * FROM holidays WHERE date BETWEEN ? AND ?', today, dates[dates.length - 1]);
      for (const d of dates) {
        coverage.push({
          date: d, weekend: L.isWeekend(d), holiday: (hols.find((h) => h.date === d) || {}).name || null,
          away: (awayRows.find((r) => r.date === d) || { a: 0 }).a, scheduled: (shiftRows.find((r) => r.date === d) || { c: 0 }).c, team_size: ids.length,
        });
      }
    }
    const low = [];
    for (const m of team) {
      for (const b of leave.balancesFor(m.id, year)) {
        if (b.active && b.total >= 5 && b.available <= 2) low.push({ user: core.slim(m), ...b });
      }
    }
    const actorIds = [user.id, ...ids];
    const activity = user.role === 'hr_admin'
      ? db.all("SELECT * FROM audit_log WHERE action NOT LIKE 'auth.%' ORDER BY id DESC LIMIT 10")
      : db.all(`SELECT * FROM audit_log WHERE action NOT LIKE 'auth.%' AND actor_id IN (${inList(actorIds)}) ORDER BY id DESC LIMIT 10`, ...actorIds);
    out.manager = {
      scope: user.role === 'hr_admin' ? 'organisation' : 'team', team_size: team.length,
      pending_leave: pendingLeave.filter((r) => r.status === 'pending'), pending_swaps: pendingSwaps,
      out_today: outToday, out_soon: outSoon, coverage, low_balances: low.slice(0, 8),
      activity: activity.map((a) => ({ id: a.id, ts: a.ts, actor_name: a.actor_name, action: a.action, summary: a.summary })),
    };
  }
  return out;
}

function teamList({ user }) {
  core.requireApprover(user);
  const year = Number(L.today().slice(0, 4));
  const today = L.today();
  const team = core.teamOf(user);
  return {
    team: team.map((m) => {
      const awayNow = db.get(`SELECT 1 x FROM leave_request_days d JOIN leave_requests r ON r.id=d.request_id WHERE r.user_id=? AND r.status='approved' AND d.date=? AND d.amount>=1`, m.id, today);
      const next = db.get(`SELECT * FROM shifts WHERE user_id=? AND status='scheduled' AND date>=? ORDER BY date,start_time LIMIT 1`, m.id, today);
      return { ...core.slim(m), email: m.email, away_today: !!awayNow, next_shift: next || null, balances: leave.balancesFor(m.id, year).filter((b) => b.active) };
    }),
  };
}

const routes = [
  { m: 'GET', p: '/api/me', h: me },
  { m: 'POST', p: '/api/me/password', h: changePassword },
  { m: 'GET', p: '/api/users', h: listUsers },
  { m: 'POST', p: '/api/users', h: createUser },
  { m: 'PUT', p: '/api/users/:id', h: updateUser },
  { m: 'POST', p: '/api/users/:id/reset-password', h: resetPassword },
  { m: 'GET', p: '/api/holidays', h: listHolidays },
  { m: 'POST', p: '/api/holidays', h: addHoliday },
  { m: 'DELETE', p: '/api/holidays/:date', h: deleteHoliday },
  { m: 'GET', p: '/api/notifications', h: listNotifications },
  { m: 'POST', p: '/api/notifications/read-all', h: markAllRead },
  { m: 'POST', p: '/api/notifications/:id/read', h: markRead },
  { m: 'GET', p: '/api/audit', h: listAudit },
  { m: 'GET', p: '/api/audit.csv', h: auditCsv },
  { m: 'GET', p: '/api/calendar', h: calendar },
  { m: 'GET', p: '/api/dashboard', h: dashboard },
  { m: 'GET', p: '/api/team', h: teamList },
];

module.exports = { routes };
