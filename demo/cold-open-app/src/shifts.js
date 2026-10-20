'use strict';
const db = require('./db');
const L = require('./lib');
const core = require('./core');

const MIN_REST_MIN = 8 * 60; // minimum rest between two shifts
const MAX_SHIFT_MIN = 16 * 60;
const OPEN = ['pending_peer', 'pending_manager'];

// ---------------------------------------------------------------- helpers
function interval(date, start, end) {
  const base = L.diffDays('1970-01-01', date) * 1440;
  const s = base + L.toMinutes(start);
  let e = base + L.toMinutes(end);
  if (L.toMinutes(end) <= L.toMinutes(start)) e += 1440; // overnight
  return [s, e];
}
const inList = (arr) => arr.map(() => '?').join(',');
const getShift = (id) => db.get('SELECT * FROM shifts WHERE id = ?', id);
const fmtShift = (s) => `${s.date} ${s.start_time}-${s.end_time}${s.label ? ` (${s.label})` : ''}`;

function scheduledOn(userId, dates) {
  if (!dates.length) return [];
  return db.all(
    `SELECT id,date,start_time,end_time,label FROM shifts WHERE user_id=? AND status='scheduled' AND date IN (${inList(dates)}) ORDER BY date`,
    userId, ...dates,
  );
}

// Throws a 409 if `userId` cannot work date/start/end (leave, overlap, insufficient rest).
function checkAssignable(userId, date, start, end, ignoreIds = []) {
  const u = core.getUser(userId);
  if (!u || !u.active) throw L.bad('That person is not an active employee');
  const [s, e] = interval(date, start, end);
  if (e - s > MAX_SHIFT_MIN) throw L.bad('A shift cannot be longer than 16 hours', 'end_time');
  if (e - s < 30) throw L.bad('A shift must be at least 30 minutes', 'end_time');
  const leave = db.get(
    `SELECT 1 x FROM leave_request_days d JOIN leave_requests r ON r.id=d.request_id
     WHERE r.user_id=? AND r.status='approved' AND d.date=? AND d.amount>=1`, userId, date);
  if (leave) throw L.conflict(`${u.name} is on approved leave on ${date}`);
  const others = db.all(
    `SELECT * FROM shifts WHERE user_id=? AND status='scheduled' AND date BETWEEN ? AND ?`,
    userId, L.addDays(date, -1), L.addDays(date, 1),
  );
  for (const o of others) {
    if (ignoreIds.includes(o.id)) continue;
    const [os, oe] = interval(o.date, o.start_time, o.end_time);
    if (s < oe + MIN_REST_MIN && os < e + MIN_REST_MIN) {
      const overlaps = s < oe && os < e;
      throw L.conflict(overlaps
        ? `${u.name} already has an overlapping shift on ${o.date} (${o.start_time}-${o.end_time})`
        : `${u.name} would have less than 8 hours of rest next to the shift on ${o.date} (${o.start_time}-${o.end_time})`);
    }
  }
}

function cancelOpenSwapsFor(shiftId, reason, actor) {
  const open = db.all(`SELECT * FROM shift_swaps WHERE status IN ('pending_peer','pending_manager') AND (requester_shift_id=? OR target_shift_id=?)`, shiftId, shiftId);
  for (const sw of open) {
    db.run("UPDATE shift_swaps SET status='cancelled', decision_note=?, updated_at=? WHERE id=?", reason, L.nowIso(), sw.id);
    core.audit(actor, 'swap.cancel', 'shift_swap', sw.id, `Swap #${sw.id} cancelled automatically: ${reason}`, { automatic: true });
    core.notify([sw.requester_id, sw.target_id], { type: 'swap.cancelled', title: 'Shift swap cancelled', body: reason, link: '#/swaps' });
  }
}

function cancelShift(id, actor, reason) {
  const s = getShift(id);
  if (!s || s.status !== 'scheduled') return;
  const u = core.getUser(s.user_id);
  db.run("UPDATE shifts SET status='cancelled', updated_at=? WHERE id=?", L.nowIso(), id);
  core.audit(actor, 'shift.cancel', 'shift', id, `${actor.name} cancelled ${u.name}'s shift ${fmtShift(s)}`, { reason });
  cancelOpenSwapsFor(id, `A shift in this swap was cancelled (${reason})`, actor);
  if (u.id !== actor.id) core.notify(u.id, { type: 'shift.cancelled', title: 'Shift cancelled', body: `${fmtShift(s)} - ${reason}`, link: '#/roster' });
}

// ---------------------------------------------------------------- shift types
function typeInput(b) {
  return {
    name: L.str(b.name, 'name', { min: 2, max: 40 }),
    start_time: L.time(b.start_time, 'start_time'),
    end_time: L.time(b.end_time, 'end_time'),
    color: L.color(b.color ?? '#6366f1'),
    active: b.active === undefined ? true : L.bool(b.active),
  };
}
const stOut = (t) => t && { ...t, active: !!t.active };
function listShiftTypes({ user, query }) {
  const all = user.role === 'hr_admin' && query.all;
  return { shift_types: db.all(`SELECT * FROM shift_types ${all ? '' : 'WHERE active=1'} ORDER BY start_time, name`).map(stOut) };
}
function createShiftType({ user, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const t = typeInput(body);
    if (db.get('SELECT id FROM shift_types WHERE name=?', t.name)) throw L.conflict(`A shift type named "${t.name}" already exists`);
    const id = db.run('INSERT INTO shift_types(name,start_time,end_time,color,active) VALUES(?,?,?,?,?)', t.name, t.start_time, t.end_time, t.color, t.active).id;
    core.audit(user, 'shift_type.create', 'shift_type', id, `${user.name} created shift type "${t.name}" (${t.start_time}-${t.end_time})`, t);
    return { shift_type: stOut(db.get('SELECT * FROM shift_types WHERE id=?', id)) };
  });
}
function updateShiftType({ user, params, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const id = Number(params.id);
    const before = db.get('SELECT * FROM shift_types WHERE id=?', id);
    if (!before) throw L.notFound('Shift type not found');
    const t = typeInput({ ...stOut(before), ...body });
    if (db.get('SELECT id FROM shift_types WHERE name=? AND id<>?', t.name, id)) throw L.conflict(`A shift type named "${t.name}" already exists`);
    db.run('UPDATE shift_types SET name=?,start_time=?,end_time=?,color=?,active=? WHERE id=?', t.name, t.start_time, t.end_time, t.color, t.active, id);
    core.audit(user, 'shift_type.update', 'shift_type', id, `${user.name} updated shift type "${t.name}"`, { before: stOut(before), after: t });
    return { shift_type: stOut(db.get('SELECT * FROM shift_types WHERE id=?', id)) };
  });
}
function deleteShiftType({ user, params }) {
  core.requireHr(user);
  return db.tx(() => {
    const id = Number(params.id);
    const t = db.get('SELECT * FROM shift_types WHERE id=?', id);
    if (!t) throw L.notFound('Shift type not found');
    if (db.get('SELECT 1 x FROM shifts WHERE shift_type_id=? LIMIT 1', id)) throw L.conflict(`"${t.name}" is used by existing shifts. Deactivate it instead.`);
    db.run('DELETE FROM shift_types WHERE id=?', id);
    core.audit(user, 'shift_type.delete', 'shift_type', id, `${user.name} deleted shift type "${t.name}"`, t);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- shifts
const SHIFT_SELECT = `SELECT s.*, u.name AS user_name, st.name AS type_name, st.color AS color
  FROM shifts s JOIN users u ON u.id=s.user_id LEFT JOIN shift_types st ON st.id=s.shift_type_id`;

function shiftInput(b, existing) {
  const typeId = b.shift_type_id === undefined ? existing?.shift_type_id : b.shift_type_id;
  let type = null;
  if (typeId !== null && typeId !== undefined && typeId !== '') {
    type = db.get('SELECT * FROM shift_types WHERE id=?', L.int(typeId, 'shift_type_id'));
    if (!type) throw L.bad('Unknown shift type', 'shift_type_id');
  }
  const start = b.start_time ?? (b.shift_type_id !== undefined && type ? type.start_time : existing?.start_time) ?? type?.start_time;
  const end = b.end_time ?? (b.shift_type_id !== undefined && type ? type.end_time : existing?.end_time) ?? type?.end_time;
  return {
    user_id: L.int(b.user_id ?? existing?.user_id, 'user_id'),
    date: L.date(b.date ?? existing?.date, 'date'),
    start_time: L.time(start, 'start_time'),
    end_time: L.time(end, 'end_time'),
    shift_type_id: type ? type.id : null,
    label: L.str(b.label === undefined ? existing?.label : b.label, 'label', { required: false, max: 60 }),
    notes: L.str(b.notes === undefined ? existing?.notes : b.notes, 'notes', { required: false, max: 300 }),
  };
}
function createShift({ user, body }) {
  core.requireApprover(user);
  return db.tx(() => {
    const s = shiftInput(body);
    const target = core.requireUser(s.user_id);
    core.requireManage(user, target);
    if (s.date < L.today()) throw L.bad('Shifts cannot be created in the past', 'date');
    checkAssignable(s.user_id, s.date, s.start_time, s.end_time);
    const now = L.nowIso();
    const id = db.run(
      `INSERT INTO shifts(user_id,date,start_time,end_time,shift_type_id,label,notes,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'scheduled',?,?,?)`,
      s.user_id, s.date, s.start_time, s.end_time, s.shift_type_id, s.label, s.notes, user.id, now, now,
    ).id;
    core.audit(user, 'shift.create', 'shift', id, `${user.name} scheduled ${target.name} for ${fmtShift(s)}`, s);
    if (target.id !== user.id) core.notify(target.id, { type: 'shift.assigned', title: 'New shift assigned', body: fmtShift(s), link: '#/roster' });
    return { shift: db.get(`${SHIFT_SELECT} WHERE s.id=?`, id) };
  });
}
function updateShift({ user, params, body }) {
  core.requireApprover(user);
  return db.tx(() => {
    const id = Number(params.id);
    const before = getShift(id);
    if (!before || before.status !== 'scheduled') throw L.notFound('Shift not found');
    const prevUser = core.requireUser(before.user_id);
    core.requireManage(user, prevUser);
    if (before.date < L.today()) throw L.conflict('Past shifts cannot be changed');
    const s = shiftInput(body, before);
    const target = core.requireUser(s.user_id);
    core.requireManage(user, target);
    if (s.date < L.today()) throw L.bad('Shifts cannot be moved into the past', 'date');
    checkAssignable(s.user_id, s.date, s.start_time, s.end_time, [id]);
    db.run('UPDATE shifts SET user_id=?,date=?,start_time=?,end_time=?,shift_type_id=?,label=?,notes=?,updated_at=? WHERE id=?',
      s.user_id, s.date, s.start_time, s.end_time, s.shift_type_id, s.label, s.notes, L.nowIso(), id);
    cancelOpenSwapsFor(id, 'The shift was edited by a manager', user);
    core.audit(user, 'shift.update', 'shift', id, `${user.name} changed ${prevUser.name}'s shift ${fmtShift(before)} -> ${target.name} ${fmtShift(s)}`, { before, after: s });
    core.notify([...new Set([prevUser.id, target.id])].filter((x) => x !== user.id), { type: 'shift.updated', title: 'Shift changed', body: `${fmtShift(s)}`, link: '#/roster' });
    return { shift: db.get(`${SHIFT_SELECT} WHERE s.id=?`, id) };
  });
}
function deleteShift({ user, params, body }) {
  core.requireApprover(user);
  return db.tx(() => {
    const s = getShift(Number(params.id));
    if (!s || s.status !== 'scheduled') throw L.notFound('Shift not found');
    core.requireManage(user, core.requireUser(s.user_id));
    if (s.date < L.today()) throw L.conflict('Past shifts cannot be cancelled');
    cancelShift(s.id, user, L.str(body.reason, 'reason', { required: false, max: 200 }) || 'Cancelled by manager');
    return { ok: true };
  });
}
function copyWeek({ user, body }) {
  core.requireApprover(user);
  return db.tx(() => {
    const from = L.mondayOf(L.date(body.from_start, 'from_start'));
    const to = L.mondayOf(L.date(body.to_start, 'to_start'));
    if (from === to) throw L.bad('Choose a different target week', 'to_start');
    const offset = L.diffDays(from, to);
    const people = core.visibleUsers(user).filter((u) => core.canManage(user, u));
    if (!people.length) return { created: 0, skipped: [] };
    const src = db.all(
      `SELECT * FROM shifts WHERE status='scheduled' AND date BETWEEN ? AND ? AND user_id IN (${inList(people)}) ORDER BY date,start_time`,
      from, L.addDays(from, 6), ...people.map((p) => p.id),
    );
    let created = 0;
    const skipped = [];
    const now = L.nowIso();
    for (const s of src) {
      const date = L.addDays(s.date, offset);
      const who = people.find((p) => p.id === s.user_id).name;
      if (date < L.today()) { skipped.push(`${who} ${date}: in the past`); continue; }
      try {
        checkAssignable(s.user_id, date, s.start_time, s.end_time);
      } catch (e) {
        skipped.push(`${who} ${date}: ${e.message}`);
        continue;
      }
      const dup = db.get("SELECT 1 x FROM shifts WHERE user_id=? AND date=? AND start_time=? AND end_time=? AND status='scheduled'", s.user_id, date, s.start_time, s.end_time);
      if (dup) { skipped.push(`${who} ${date}: already scheduled`); continue; }
      db.run(`INSERT INTO shifts(user_id,date,start_time,end_time,shift_type_id,label,notes,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'scheduled',?,?,?)`,
        s.user_id, date, s.start_time, s.end_time, s.shift_type_id, s.label, s.notes, user.id, now, now);
      created++;
    }
    core.audit(user, 'shift.copy_week', 'system', null, `${user.name} copied the week of ${from} to ${to}: ${created} shift(s) created, ${skipped.length} skipped`, { from, to, created, skipped });
    const affected = new Set(src.map((s) => s.user_id));
    if (created) core.notify([...affected].filter((i) => i !== user.id), { type: 'shift.assigned', title: 'Roster published', body: `New shifts were added for the week of ${to}`, link: '#/roster' });
    return { created, skipped };
  });
}

function listShifts({ user, query }) {
  const from = L.date(query.from || L.today(), 'from');
  const to = L.date(query.to || L.addDays(from, 30), 'to');
  const target = query.user_id ? core.requireUser(Number(query.user_id)) : user;
  if (target.id !== user.id && !core.visibleUsers(user).some((u) => u.id === target.id)) throw L.forbidden();
  return { shifts: db.all(`${SHIFT_SELECT} WHERE s.user_id=? AND s.status='scheduled' AND s.date BETWEEN ? AND ? ORDER BY s.date, s.start_time`, target.id, from, to) };
}

function roster({ user, query }) {
  const start = L.mondayOf(L.date(query.start || L.today(), 'start'));
  const n = query.days ? L.int(Number(query.days), 'days', { min: 7, max: 14 }) : 7;
  const end = L.addDays(start, n - 1);
  const dept = user.role === 'hr_admin' || user.role === 'manager' ? query.department || null : null;
  const users = core.visibleUsers(user, dept);
  const ids = users.map((u) => u.id);
  const dates = L.eachDay(start, end);
  const holidays = db.all('SELECT * FROM holidays WHERE date BETWEEN ? AND ?', start, end);
  let shifts = [];
  let leave = [];
  if (ids.length) {
    shifts = db.all(`${SHIFT_SELECT} WHERE s.status='scheduled' AND s.date BETWEEN ? AND ? AND s.user_id IN (${inList(ids)}) ORDER BY s.date, s.start_time`, start, end, ...ids);
    leave = db.all(
      `SELECT d.date, d.amount, r.user_id, r.status, t.name type_name, t.color FROM leave_request_days d
       JOIN leave_requests r ON r.id=d.request_id JOIN leave_types t ON t.id=r.leave_type_id
       WHERE r.status IN ('approved','pending') AND d.date BETWEEN ? AND ? AND r.user_id IN (${inList(ids)})`, start, end, ...ids);
  }
  const manageSet = new Set(users.filter((u) => core.canManage(user, u)).map((u) => u.id));
  leave = leave
    .filter((l) => l.status === 'approved' || l.user_id === user.id || manageSet.has(l.user_id))
    .map((l) => (l.user_id === user.id || manageSet.has(l.user_id) ? l : { ...l, type_name: 'Away', color: '#94a3b8' }));
  shifts = shifts.map((s) => (s.user_id === user.id || manageSet.has(s.user_id) ? s : { ...s, notes: null }));
  const departments = user.role === 'hr_admin' ? db.all('SELECT DISTINCT department d FROM users WHERE active=1 ORDER BY d').map((r) => r.d) : [];
  return {
    start, end, dates, holidays, today: L.today(), departments, department: dept,
    users: users.map((u) => ({ ...core.slim(u), can_manage: manageSet.has(u.id) })), shifts, leave,
  };
}

// ---------------------------------------------------------------- swaps
const SWAP_SELECT = `
  SELECT w.*, ru.name AS requester_name, tu.name AS target_name, ru.manager_id AS requester_manager_id, tu.manager_id AS target_manager_id,
         rs.date AS r_date, rs.start_time AS r_start, rs.end_time AS r_end, rs.label AS r_label, rs.status AS r_shift_status,
         ts.date AS t_date, ts.start_time AS t_start, ts.end_time AS t_end, ts.label AS t_label,
         du.name AS decided_by_name
  FROM shift_swaps w JOIN users ru ON ru.id=w.requester_id JOIN users tu ON tu.id=w.target_id
  JOIN shifts rs ON rs.id=w.requester_shift_id LEFT JOIN shifts ts ON ts.id=w.target_shift_id LEFT JOIN users du ON du.id=w.decided_by`;

function sweepSwaps() {
  db.run(
    `UPDATE shift_swaps SET status='expired', updated_at=? WHERE status IN ('pending_peer','pending_manager') AND
     (requester_shift_id IN (SELECT id FROM shifts WHERE date<=?) OR target_shift_id IN (SELECT id FROM shifts WHERE date<=?))`,
    L.nowIso(), L.today(), L.today(),
  );
}
function canDecideSwap(actor, w) {
  if (actor.id === w.requester_id || actor.id === w.target_id) return false;
  if (actor.role === 'hr_admin') return true;
  return actor.role === 'manager' && (w.requester_manager_id === actor.id || w.target_manager_id === actor.id);
}
function shapeSwap(w, actor) {
  const out = { ...w };
  out.can_accept = w.status === 'pending_peer' && w.target_id === actor.id;
  out.can_decline = out.can_accept;
  out.can_decide = w.status === 'pending_manager' && canDecideSwap(actor, w);
  out.can_cancel = OPEN.includes(w.status) && w.requester_id === actor.id;
  delete out.requester_manager_id;
  delete out.target_manager_id;
  return out;
}
function listSwaps({ user, query }) {
  sweepSwaps();
  const scope = query.scope || 'mine';
  let rows;
  if (scope === 'mine') {
    rows = db.all(`${SWAP_SELECT} WHERE w.requester_id=? OR w.target_id=? ORDER BY (w.status IN ('pending_peer','pending_manager')) DESC, w.id DESC LIMIT 200`, user.id, user.id);
  } else if (scope === 'approvals') {
    core.requireApprover(user);
    rows = db.all(`${SWAP_SELECT} WHERE w.status<>'pending_peer' AND w.status<>'cancelled' ORDER BY (w.status='pending_manager') DESC, w.id DESC LIMIT 300`)
      .filter((w) => w.requester_id !== user.id && w.target_id !== user.id && (user.role === 'hr_admin' || w.requester_manager_id === user.id || w.target_manager_id === user.id));
  } else throw L.bad('scope must be mine or approvals', 'scope');
  return { swaps: rows.map((w) => shapeSwap(w, user)) };
}
function getSwap(id) {
  const w = db.get(`${SWAP_SELECT} WHERE w.id=?`, id);
  if (!w) throw L.notFound('Swap not found');
  return w;
}
// Throws if the proposed exchange is not valid right now.
function validateSwap(rs, target, ts, ignoreSwapId = 0) {
  const requester = core.requireUser(rs.user_id);
  if (rs.status !== 'scheduled') throw L.conflict('That shift is no longer scheduled');
  if (rs.date <= L.today()) throw L.conflict('Only shifts from tomorrow onwards can be swapped');
  if (!target.active) throw L.bad('That person is not active');
  if (target.id === requester.id) throw L.bad('You cannot swap with yourself', 'target_id');
  if (target.department !== requester.department) throw L.bad('You can only swap with teammates in your department', 'target_id');
  if (ts) {
    if (ts.user_id !== target.id) throw L.bad('That shift does not belong to the selected teammate', 'target_shift_id');
    if (ts.status !== 'scheduled') throw L.conflict("The teammate's shift is no longer scheduled");
    if (ts.date <= L.today()) throw L.conflict("The teammate's shift is too soon to swap");
  }
  const ids = [rs.id, ts && ts.id].filter(Boolean);
  const open = db.get(`SELECT id FROM shift_swaps WHERE status IN ('pending_peer','pending_manager') AND id<>? AND (requester_shift_id IN (${inList(ids)}) OR target_shift_id IN (${inList(ids)}))`, ignoreSwapId, ...ids, ...ids);
  if (open) throw L.conflict(`One of these shifts is already part of an open swap request (#${open.id})`);
  checkAssignable(target.id, rs.date, rs.start_time, rs.end_time, ts ? [ts.id] : []);
  if (ts) checkAssignable(requester.id, ts.date, ts.start_time, ts.end_time, [rs.id]);
}

function swapOptions({ user, query }) {
  const rs = getShift(Number(query.shift_id));
  if (!rs || rs.user_id !== user.id) throw L.notFound('Shift not found');
  const mates = db.all('SELECT * FROM users WHERE active=1 AND department=? AND id<>? ORDER BY name', user.department, user.id);
  const out = [];
  for (const m of mates) {
    const theirs = db.all("SELECT * FROM shifts WHERE user_id=? AND status='scheduled' AND date>? AND date<=? ORDER BY date,start_time", m.id, L.today(), L.addDays(L.today(), 45));
    let cover = true;
    let coverReason = null;
    try { validateSwap(rs, m, null); } catch (e) { cover = false; coverReason = e.message; }
    out.push({
      user: core.slim(m), can_cover: cover, cover_reason: coverReason,
      shifts: theirs.map((t) => {
        try { validateSwap(rs, m, t); return { ...t, feasible: true }; } catch (e) { return { ...t, feasible: false, reason: e.message }; }
      }),
    });
  }
  return { shift: rs, colleagues: out };
}

function createSwap({ user, body }) {
  return db.tx(() => {
    const rs = getShift(L.int(body.my_shift_id, 'my_shift_id'));
    if (!rs || rs.user_id !== user.id) throw L.notFound('Choose one of your own shifts');
    const target = core.requireUser(L.int(body.target_id, 'target_id'));
    let ts = null;
    if (body.target_shift_id !== undefined && body.target_shift_id !== null && body.target_shift_id !== '') {
      ts = getShift(L.int(body.target_shift_id, 'target_shift_id'));
      if (!ts) throw L.bad('Unknown shift', 'target_shift_id');
    }
    validateSwap(rs, target, ts);
    const message = L.str(body.message, 'message', { required: false, max: 300 });
    const now = L.nowIso();
    const id = db.run(
      `INSERT INTO shift_swaps(requester_id,requester_shift_id,target_id,target_shift_id,message,status,created_at,updated_at) VALUES(?,?,?,?,?,'pending_peer',?,?)`,
      user.id, rs.id, target.id, ts ? ts.id : null, message, now, now,
    ).id;
    core.audit(user, 'swap.create', 'shift_swap', id,
      `${user.name} asked ${target.name} to ${ts ? `swap ${fmtShift(rs)} for ${fmtShift(ts)}` : `cover ${fmtShift(rs)}`}`, { message });
    core.notify(target.id, {
      type: 'swap.requested', title: `${user.name} wants to ${ts ? 'swap shifts' : 'hand over a shift'}`,
      body: ts ? `Their ${fmtShift(rs)} for your ${fmtShift(ts)}` : `Can you cover ${fmtShift(rs)}?`, link: '#/swaps',
    });
    return { swap: shapeSwap(getSwap(id), user) };
  });
}

function executeSwap(w, actor, note, auto) {
  const rs = getShift(w.requester_shift_id);
  const ts = w.target_shift_id ? getShift(w.target_shift_id) : null;
  const now = L.nowIso();
  db.run('UPDATE shifts SET user_id=?, updated_at=? WHERE id=?', w.target_id, now, rs.id);
  if (ts) db.run('UPDATE shifts SET user_id=?, updated_at=? WHERE id=?', w.requester_id, now, ts.id);
  db.run("UPDATE shift_swaps SET status='approved', decided_by=?, decided_at=?, decision_note=?, updated_at=? WHERE id=?", actor ? actor.id : null, now, note, now, w.id);
  const desc = ts ? `${w.requester_name} <-> ${w.target_name}: ${fmtShift(rs)} / ${fmtShift(ts)}` : `${w.target_name} covers ${w.requester_name}: ${fmtShift(rs)}`;
  core.audit(actor, auto ? 'swap.auto_approve' : 'swap.approve', 'shift_swap', w.id, `${actor ? actor.name : 'System'} approved swap #${w.id} (${desc})`, { note });
  core.notify([w.requester_id, w.target_id], { type: 'swap.approved', title: 'Shift swap approved', body: desc, link: '#/roster' });
}

function respond(accept) {
  return ({ user, params, body }) => db.tx(() => {
    const w = getSwap(Number(params.id));
    if (w.target_id !== user.id) throw L.forbidden('Only the teammate who was asked can respond');
    if (w.status !== 'pending_peer') throw L.conflict(`This swap is already ${w.status.replace('_', ' ')}`);
    if (!accept) {
      const note = L.str(body.note, 'note', { required: false, max: 300 });
      db.run("UPDATE shift_swaps SET status='declined', peer_responded_at=?, decision_note=?, updated_at=? WHERE id=?", L.nowIso(), note, L.nowIso(), w.id);
      core.audit(user, 'swap.decline', 'shift_swap', w.id, `${user.name} declined swap #${w.id} from ${w.requester_name}`, { note });
      core.notify(w.requester_id, { type: 'swap.declined', title: 'Swap declined', body: `${user.name} declined your swap request${note ? ` - "${note}"` : ''}`, link: '#/swaps' });
      return { swap: shapeSwap(getSwap(w.id), user) };
    }
    const rs = getShift(w.requester_shift_id);
    validateSwap(rs, core.requireUser(w.target_id), w.target_shift_id ? getShift(w.target_shift_id) : null, w.id);
    const now = L.nowIso();
    db.run("UPDATE shift_swaps SET status='pending_manager', peer_responded_at=?, updated_at=? WHERE id=?", now, now, w.id);
    core.audit(user, 'swap.accept', 'shift_swap', w.id, `${user.name} accepted swap #${w.id} from ${w.requester_name}`, null);
    const requester = core.requireUser(w.requester_id);
    const approvers = core.approversFor(requester).filter((a) => a.id !== w.target_id);
    if (!approvers.length) {
      executeSwap(getSwap(w.id), null, 'Auto-approved: no approver available', true);
    } else {
      core.notify(w.requester_id, { type: 'swap.accepted', title: 'Swap accepted by teammate', body: `${user.name} accepted. Waiting for manager approval.`, link: '#/swaps' });
      core.notify(approvers.map((a) => a.id), { type: 'swap.needs_approval', title: 'Shift swap needs approval', body: `${w.requester_name} and ${w.target_name} agreed to a swap`, link: '#/approvals' });
    }
    return { swap: shapeSwap(getSwap(w.id), user) };
  });
}

function approveSwap({ user, params, body }) {
  return db.tx(() => {
    const w = getSwap(Number(params.id));
    if (!canDecideSwap(user, w)) throw L.forbidden('You cannot approve this swap');
    if (w.status !== 'pending_manager') throw L.conflict(`This swap is ${w.status.replace('_', ' ')}`);
    const rs = getShift(w.requester_shift_id);
    validateSwap(rs, core.requireUser(w.target_id), w.target_shift_id ? getShift(w.target_shift_id) : null, w.id);
    executeSwap(w, user, L.str(body.note, 'note', { required: false, max: 300 }), false);
    return { swap: shapeSwap(getSwap(w.id), user) };
  });
}
function rejectSwap({ user, params, body }) {
  return db.tx(() => {
    const w = getSwap(Number(params.id));
    if (!canDecideSwap(user, w)) throw L.forbidden('You cannot reject this swap');
    if (w.status !== 'pending_manager') throw L.conflict(`This swap is ${w.status.replace('_', ' ')}`);
    const note = L.str(body.note, 'note', { required: true, max: 300 });
    const now = L.nowIso();
    db.run("UPDATE shift_swaps SET status='rejected', decided_by=?, decided_at=?, decision_note=?, updated_at=? WHERE id=?", user.id, now, note, now, w.id);
    core.audit(user, 'swap.reject', 'shift_swap', w.id, `${user.name} rejected swap #${w.id} (${w.requester_name} / ${w.target_name})`, { note });
    core.notify([w.requester_id, w.target_id], { type: 'swap.rejected', title: 'Shift swap rejected', body: `${user.name}: "${note}"`, link: '#/swaps' });
    return { swap: shapeSwap(getSwap(w.id), user) };
  });
}
function cancelSwap({ user, params }) {
  return db.tx(() => {
    const w = getSwap(Number(params.id));
    if (w.requester_id !== user.id) throw L.forbidden('Only the requester can withdraw a swap');
    if (!OPEN.includes(w.status)) throw L.conflict(`This swap is already ${w.status.replace('_', ' ')}`);
    db.run("UPDATE shift_swaps SET status='cancelled', updated_at=? WHERE id=?", L.nowIso(), w.id);
    core.audit(user, 'swap.cancel', 'shift_swap', w.id, `${user.name} withdrew swap #${w.id}`, null);
    core.notify(w.target_id, { type: 'swap.cancelled', title: 'Swap withdrawn', body: `${user.name} withdrew the swap request`, link: '#/swaps' });
    return { swap: shapeSwap(getSwap(w.id), user) };
  });
}

const routes = [
  { m: 'GET', p: '/api/shift-types', h: listShiftTypes },
  { m: 'POST', p: '/api/shift-types', h: createShiftType },
  { m: 'PUT', p: '/api/shift-types/:id', h: updateShiftType },
  { m: 'DELETE', p: '/api/shift-types/:id', h: deleteShiftType },
  { m: 'GET', p: '/api/shifts', h: listShifts },
  { m: 'POST', p: '/api/shifts', h: createShift },
  { m: 'POST', p: '/api/shifts/copy-week', h: copyWeek },
  { m: 'PUT', p: '/api/shifts/:id', h: updateShift },
  { m: 'DELETE', p: '/api/shifts/:id', h: deleteShift },
  { m: 'GET', p: '/api/roster', h: roster },
  { m: 'GET', p: '/api/swaps', h: listSwaps },
  { m: 'GET', p: '/api/swap-options', h: swapOptions },
  { m: 'POST', p: '/api/swaps', h: createSwap },
  { m: 'POST', p: '/api/swaps/:id/accept', h: respond(true) },
  { m: 'POST', p: '/api/swaps/:id/decline', h: respond(false) },
  { m: 'POST', p: '/api/swaps/:id/approve', h: approveSwap },
  { m: 'POST', p: '/api/swaps/:id/reject', h: rejectSwap },
  { m: 'POST', p: '/api/swaps/:id/cancel', h: cancelSwap },
];

module.exports = { routes, scheduledOn, cancelShift, checkAssignable, sweepSwaps, listSwaps, SHIFT_SELECT };
