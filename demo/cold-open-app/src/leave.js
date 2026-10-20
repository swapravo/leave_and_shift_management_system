'use strict';
const db = require('./db');
const L = require('./lib');
const core = require('./core');
const shifts = require('./shifts');

const MAX_BACKDATE_DAYS = 14;
const MAX_SPAN_DAYS = 120;

// ---------------------------------------------------------------- balances
function getType(id) {
  return db.get('SELECT * FROM leave_types WHERE id = ?', id);
}
function usage(userId, typeId, year, status) {
  return L.round2(db.get(
    `SELECT COALESCE(SUM(d.amount),0) s FROM leave_request_days d JOIN leave_requests r ON r.id = d.request_id
     WHERE r.user_id=? AND r.leave_type_id=? AND r.status=? AND d.date BETWEEN ? AND ?`,
    userId, typeId, status, `${year}-01-01`, `${year}-12-31`,
  ).s);
}
function balanceFor(userId, type, year) {
  const row = db.get('SELECT * FROM leave_balances WHERE user_id=? AND leave_type_id=? AND year=?', userId, type.id, year);
  const allocated = row && row.allocated != null ? row.allocated : type.annual_allowance;
  const carried = row ? row.carried_over : 0;
  const adjustment = row ? row.adjustment : 0;
  const used = usage(userId, type.id, year, 'approved');
  const pending = usage(userId, type.id, year, 'pending');
  const total = allocated + carried + adjustment;
  return {
    leave_type_id: type.id, name: type.name, code: type.code, color: type.color, paid: !!type.paid,
    allow_negative: !!type.allow_negative, active: !!type.active, custom_allocation: !!(row && row.allocated != null),
    allocated, carried_over: carried, adjustment, total: L.round2(total), used, pending,
    available: L.round2(total - used - pending),
  };
}
function balancesFor(userId, year) {
  const types = db.all('SELECT * FROM leave_types ORDER BY active DESC, name');
  const out = [];
  for (const t of types) {
    const b = balanceFor(userId, t, year);
    if (t.active || b.used || b.pending || b.custom_allocation || b.carried_over || b.adjustment) out.push(b);
  }
  return out;
}

// ---------------------------------------------------------------- validation / preview
function workingDays(start, end, half) {
  const hol = new Set(db.all('SELECT date FROM holidays WHERE date BETWEEN ? AND ?', start, end).map((r) => r.date));
  return L.eachDay(start, end)
    .filter((d) => !L.isWeekend(d) && !hol.has(d))
    .map((d) => ({ date: d, amount: half ? 0.5 : 1 }));
}

// Validates a leave request and returns details. Never throws for business-rule problems;
// those are collected in `errors` so the form can preview them live.
function evaluate(userId, input, excludeId) {
  const errors = [];
  const warnings = [];
  const type = getType(L.int(input.leave_type_id, 'leave_type_id'));
  if (!type) throw L.bad('Unknown leave type', 'leave_type_id');
  const start = L.date(input.start_date, 'start_date');
  const end = L.date(input.end_date || input.start_date, 'end_date');
  const half = L.bool(input.half_day);
  if (!type.active) errors.push(`${type.name} is not currently available`);
  if (end < start) errors.push('End date cannot be before the start date');
  if (!errors.length && L.diffDays(start, end) > MAX_SPAN_DAYS) errors.push(`Requests can span at most ${MAX_SPAN_DAYS} days; split longer absences`);
  if (half && start !== end) errors.push('Half-day leave must be a single day');
  if (start < L.addDays(L.today(), -MAX_BACKDATE_DAYS)) errors.push(`Leave cannot start more than ${MAX_BACKDATE_DAYS} days in the past`);
  let days = [];
  if (!errors.length) {
    days = workingDays(start, end, half);
    if (!days.length) errors.push('The selected dates have no working days (weekends and public holidays are not counted)');
  }
  const total = L.round2(days.reduce((s, d) => s + d.amount, 0));
  let overlap = null;
  if (!errors.length) {
    overlap = db.get(
      `SELECT id,start_date,end_date,status FROM leave_requests
       WHERE user_id=? AND status IN ('pending','approved') AND start_date<=? AND end_date>=? AND id<>?`,
      userId, end, start, excludeId || 0,
    );
    if (overlap) errors.push(`This overlaps your ${overlap.status} leave (${overlap.start_date} to ${overlap.end_date})`);
  }
  // balance, per calendar year touched
  let balance = null;
  if (!errors.length) {
    const byYear = {};
    for (const d of days) byYear[d.date.slice(0, 4)] = (byYear[d.date.slice(0, 4)] || 0) + d.amount;
    const parts = [];
    for (const [year, need] of Object.entries(byYear)) {
      const b = balanceFor(userId, type, Number(year));
      parts.push({ year: Number(year), available: b.available, requested: need, after: L.round2(b.available - need) });
      if (b.available - need < -1e-9) {
        if (type.allow_negative) warnings.push(`This takes your ${type.name} balance for ${year} below zero (${L.round2(b.available - need)} days)`);
        else errors.push(`Not enough ${type.name} balance for ${year}: ${b.available} day(s) available, ${need} requested`);
      }
    }
    balance = parts;
  }
  let shiftConflicts = [];
  let teammatesAway = [];
  if (!errors.length) {
    const fullDays = days.filter((d) => d.amount >= 1).map((d) => d.date);
    shiftConflicts = fullDays.length ? shifts.scheduledOn(userId, fullDays) : [];
    if (shiftConflicts.length) warnings.push(`You have ${shiftConflicts.length} scheduled shift(s) on these days; your manager will need to release them`);
    const u = core.getUser(userId);
    teammatesAway = db.all(
      `SELECT DISTINCT u.name FROM leave_request_days d JOIN leave_requests r ON r.id=d.request_id JOIN users u ON u.id=r.user_id
       WHERE r.status IN ('approved','pending') AND u.department=? AND u.id<>? AND d.date BETWEEN ? AND ? ORDER BY u.name`,
      u.department, userId, start, end,
    ).map((r) => r.name);
    if (teammatesAway.length) warnings.push(`Teammates also away in this period: ${teammatesAway.join(', ')}`);
  }
  return { type, start, end, half, days, total, errors, warnings, balance, shiftConflicts, teammatesAway };
}

// ---------------------------------------------------------------- queries
const SELECT_REQ = `
  SELECT r.*, u.name AS user_name, u.department, u.manager_id, t.name AS type_name, t.code AS type_code, t.color AS type_color,
         d.name AS decided_by_name
  FROM leave_requests r JOIN users u ON u.id=r.user_id JOIN leave_types t ON t.id=r.leave_type_id
  LEFT JOIN users d ON d.id=r.decided_by`;

function shape(r, actor) {
  const owner = { id: r.user_id, manager_id: r.manager_id };
  const out = { ...r };
  out.can_decide = r.status === 'pending' && core.canDecide(actor, owner);
  out.can_cancel = (r.user_id === actor.id && (r.status === 'pending' || (r.status === 'approved' && r.start_date >= L.today())))
    || (r.status === 'approved' && r.end_date >= L.today() && core.canDecide(actor, owner));
  delete out.manager_id;
  return out;
}

function listRequests({ user, query }) {
  const scope = query.scope || 'mine';
  const where = [];
  const params = [];
  if (scope === 'mine') {
    where.push('r.user_id = ?');
    params.push(user.id);
  } else if (scope === 'approvals') {
    core.requireApprover(user);
    where.push('r.user_id <> ?');
    params.push(user.id);
    if (user.role === 'manager') {
      where.push('u.manager_id = ?');
      params.push(user.id);
    }
  } else throw L.bad('scope must be mine or approvals', 'scope');
  if (query.status) {
    const sts = String(query.status).split(',');
    where.push(`r.status IN (${sts.map(() => '?').join(',')})`);
    params.push(...sts);
  }
  if (query.user_id) {
    where.push('r.user_id = ?');
    params.push(Number(query.user_id));
  }
  const limit = Math.min(Number(query.limit) || 200, 500);
  const rows = db.all(`${SELECT_REQ} WHERE ${where.join(' AND ')} ORDER BY (r.status='pending') DESC, r.start_date DESC, r.id DESC LIMIT ${limit}`, ...params);
  const out = rows.map((r) => shape(r, user));
  if (scope === 'approvals') {
    for (const r of out) {
      if (r.status !== 'pending') continue;
      const days = db.all('SELECT date,amount FROM leave_request_days WHERE request_id=?', r.id);
      r.shift_conflicts = shifts.scheduledOn(r.user_id, days.filter((d) => d.amount >= 1).map((d) => d.date)).length;
      const t = getType(r.leave_type_id);
      r.balance_available = balanceFor(r.user_id, t, Number(r.start_date.slice(0, 4))).available;
    }
  }
  return out;
}

function getRequest(id) {
  const r = db.get(`${SELECT_REQ} WHERE r.id = ?`, id);
  if (!r) throw L.notFound('Leave request not found');
  return r;
}

// ---------------------------------------------------------------- mutations
function createRequest({ user, body }) {
  return db.tx(() => {
    const ev = evaluate(user.id, body);
    if (ev.errors.length) throw L.bad(ev.errors[0]);
    const reason = L.str(body.reason, 'reason', { required: false, max: 500 });
    const approvers = core.approversFor(user);
    // Types that need no approval are recorded straight away, unless the person is rostered on those days.
    const auto = approvers.length === 0 || (!ev.type.requires_approval && ev.shiftConflicts.length === 0);
    if (auto && ev.shiftConflicts.length) {
      throw L.conflict(`You have ${ev.shiftConflicts.length} scheduled shift(s) on these days. Ask your manager to reassign them first.`);
    }
    const now = L.nowIso();
    const id = db.run(
      `INSERT INTO leave_requests(user_id,leave_type_id,start_date,end_date,half_day,days,reason,status,decided_at,decision_note,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      user.id, ev.type.id, ev.start, ev.end, ev.half, ev.total, reason, auto ? 'approved' : 'pending',
      auto ? now : null, auto ? (ev.type.requires_approval ? 'Auto-approved: no approver available' : 'Auto-approved: this leave type needs no approval') : null, now, now,
    ).id;
    for (const d of ev.days) db.run('INSERT INTO leave_request_days(request_id,date,amount) VALUES(?,?,?)', id, d.date, d.amount);
    core.audit(user, auto ? 'leave.auto_approve' : 'leave.create', 'leave_request', id,
      `${user.name} requested ${ev.total} day(s) of ${ev.type.name}, ${ev.start} to ${ev.end}${auto ? ' (auto-approved)' : ''}`,
      { leave_type: ev.type.name, start: ev.start, end: ev.end, days: ev.total, half_day: ev.half, reason });
    if (!auto) {
      core.notify(approvers.map((a) => a.id), {
        type: 'leave.requested', title: `${user.name} requested leave`,
        body: `${ev.type.name}: ${ev.start} to ${ev.end} (${ev.total} day${ev.total === 1 ? '' : 's'})`, link: '#/approvals',
      });
    } else {
      core.notify(user.id, { type: 'leave.approved', title: 'Leave recorded', body: `${ev.type.name}: ${ev.start} to ${ev.end}`, link: '#/leave' });
    }
    return { request: shape(getRequest(id), user), warnings: ev.warnings };
  });
}

function approve({ user, params, body }) {
  return db.tx(() => {
    const r = getRequest(Number(params.id));
    const owner = core.requireUser(r.user_id);
    if (!core.canDecide(user, owner)) throw L.forbidden('You cannot approve this request');
    if (r.status !== 'pending') throw L.conflict(`This request is already ${r.status}`);
    const type = getType(r.leave_type_id);
    if (!type.allow_negative) {
      const years = new Set(db.all('SELECT DISTINCT substr(date,1,4) y FROM leave_request_days WHERE request_id=?', r.id).map((x) => Number(x.y)));
      for (const y of years) {
        const b = balanceFor(r.user_id, type, y);
        if (b.available < -1e-9) throw L.conflict(`${owner.name} no longer has enough ${type.name} balance for ${y} (${b.available} days)`);
      }
    }
    const fullDays = db.all('SELECT date FROM leave_request_days WHERE request_id=? AND amount>=1', r.id).map((d) => d.date);
    const conflicts = shifts.scheduledOn(r.user_id, fullDays);
    if (conflicts.length && !L.bool(body.release_shifts)) {
      throw L.conflict(`${owner.name} has ${conflicts.length} scheduled shift(s) during this leave. Approve and release them?`, { code: 'shift_conflicts', shifts: conflicts });
    }
    const note = L.str(body.note, 'note', { required: false, max: 500 });
    for (const s of conflicts) shifts.cancelShift(s.id, user, `Released: ${owner.name} is on approved ${type.name}`);
    const now = L.nowIso();
    db.run("UPDATE leave_requests SET status='approved', decided_by=?, decided_at=?, decision_note=?, updated_at=? WHERE id=?", user.id, now, note, now, r.id);
    core.audit(user, 'leave.approve', 'leave_request', r.id,
      `${user.name} approved ${owner.name}'s ${type.name} (${r.start_date} to ${r.end_date})${conflicts.length ? `, releasing ${conflicts.length} shift(s)` : ''}`,
      { note, released_shifts: conflicts.map((s) => s.id) });
    core.notify(owner.id, {
      type: 'leave.approved', title: 'Leave approved', body: `${type.name}: ${r.start_date} to ${r.end_date} was approved by ${user.name}${note ? ` - "${note}"` : ''}`, link: '#/leave',
    });
    return { request: shape(getRequest(r.id), user), released_shifts: conflicts.length };
  });
}

function reject({ user, params, body }) {
  return db.tx(() => {
    const r = getRequest(Number(params.id));
    const owner = core.requireUser(r.user_id);
    if (!core.canDecide(user, owner)) throw L.forbidden('You cannot reject this request');
    if (r.status !== 'pending') throw L.conflict(`This request is already ${r.status}`);
    const note = L.str(body.note, 'note', { required: true, max: 500 });
    const now = L.nowIso();
    db.run("UPDATE leave_requests SET status='rejected', decided_by=?, decided_at=?, decision_note=?, updated_at=? WHERE id=?", user.id, now, note, now, r.id);
    core.audit(user, 'leave.reject', 'leave_request', r.id, `${user.name} rejected ${owner.name}'s ${r.type_name} (${r.start_date} to ${r.end_date})`, { note });
    core.notify(owner.id, { type: 'leave.rejected', title: 'Leave declined', body: `${r.type_name}: ${r.start_date} to ${r.end_date} was declined - "${note}"`, link: '#/leave' });
    return { request: shape(getRequest(r.id), user) };
  });
}

function cancel({ user, params, body }) {
  return db.tx(() => {
    const r = getRequest(Number(params.id));
    const owner = core.requireUser(r.user_id);
    const isOwner = owner.id === user.id;
    if (!isOwner && !core.canDecide(user, owner)) throw L.forbidden('You cannot cancel this request');
    if (!['pending', 'approved'].includes(r.status)) throw L.conflict(`This request is already ${r.status}`);
    let note = L.str(body.note, 'note', { required: false, max: 500 });
    if (isOwner) {
      if (r.status === 'approved' && r.start_date < L.today()) throw L.conflict('This leave has already started. Ask your manager or HR to revoke it.');
    } else {
      if (r.status !== 'approved') throw L.conflict('Use reject for pending requests');
      if (r.end_date < L.today()) throw L.conflict('This leave is already over and cannot be revoked');
      note = L.str(body.note, 'note', { required: true, max: 500 });
    }
    const now = L.nowIso();
    db.run("UPDATE leave_requests SET status='cancelled', decided_by=?, decided_at=?, decision_note=?, updated_at=? WHERE id=?", user.id, now, note, now, r.id);
    core.audit(user, isOwner ? 'leave.cancel' : 'leave.revoke', 'leave_request', r.id,
      `${user.name} ${isOwner ? 'cancelled' : 'revoked'} ${owner.name}'s ${r.type_name} (${r.start_date} to ${r.end_date})`, { note, was: r.status });
    if (isOwner) {
      if (r.status === 'approved') {
        core.notify(core.approversFor(owner).map((a) => a.id), { type: 'leave.cancelled', title: `${owner.name} cancelled approved leave`, body: `${r.type_name}: ${r.start_date} to ${r.end_date}`, link: '#/approvals' });
      } else {
        core.notify(core.approversFor(owner).map((a) => a.id), { type: 'leave.cancelled', title: `${owner.name} withdrew a leave request`, body: `${r.type_name}: ${r.start_date} to ${r.end_date}`, link: '#/approvals' });
      }
    } else {
      core.notify(owner.id, { type: 'leave.revoked', title: 'Approved leave revoked', body: `${r.type_name}: ${r.start_date} to ${r.end_date} - "${note}"`, link: '#/leave' });
    }
    return { request: shape(getRequest(r.id), user) };
  });
}

// ---------------------------------------------------------------- leave types (HR)
function typeInput(b, existing) {
  const out = {
    name: L.str(b.name, 'name', { min: 2, max: 60 }),
    code: L.str(b.code, 'code', { min: 2, max: 10 }).toUpperCase(),
    color: L.color(b.color ?? existing?.color ?? '#3b82f6'),
    annual_allowance: L.num(b.annual_allowance, 'annual_allowance', { min: 0, max: 365, step: 0.5 }),
    carry_over_max: L.num(b.carry_over_max ?? 0, 'carry_over_max', { min: 0, max: 365, step: 0.5 }),
    paid: L.bool(b.paid),
    requires_approval: b.requires_approval === undefined ? true : L.bool(b.requires_approval),
    allow_negative: L.bool(b.allow_negative),
    active: b.active === undefined ? true : L.bool(b.active),
  };
  if (!/^[A-Z0-9_]+$/.test(out.code)) throw L.bad('code may only contain letters, digits and underscores', 'code');
  return out;
}
function typeDupCheck(t, id) {
  if (db.get('SELECT id FROM leave_types WHERE name = ? AND id <> ?', t.name, id || 0)) throw L.conflict(`A leave type named "${t.name}" already exists`);
  if (db.get('SELECT id FROM leave_types WHERE code = ? AND id <> ?', t.code, id || 0)) throw L.conflict(`The code "${t.code}" is already used`);
}
const typeOut = (t) => t && { ...t, paid: !!t.paid, requires_approval: !!t.requires_approval, allow_negative: !!t.allow_negative, active: !!t.active };

function createType({ user, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const t = typeInput(body);
    typeDupCheck(t);
    const id = db.run(
      `INSERT INTO leave_types(name,code,color,annual_allowance,carry_over_max,paid,requires_approval,allow_negative,active,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      t.name, t.code, t.color, t.annual_allowance, t.carry_over_max, t.paid, t.requires_approval, t.allow_negative, t.active, L.nowIso(),
    ).id;
    core.audit(user, 'leave_type.create', 'leave_type', id, `${user.name} created leave type "${t.name}" (${t.annual_allowance} days/year)`, t);
    return { leave_type: typeOut(getType(id)) };
  });
}
function updateType({ user, params, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const id = Number(params.id);
    const before = getType(id);
    if (!before) throw L.notFound('Leave type not found');
    const t = typeInput({ ...typeOut(before), ...body }, before);
    typeDupCheck(t, id);
    db.run(
      `UPDATE leave_types SET name=?,code=?,color=?,annual_allowance=?,carry_over_max=?,paid=?,requires_approval=?,allow_negative=?,active=? WHERE id=?`,
      t.name, t.code, t.color, t.annual_allowance, t.carry_over_max, t.paid, t.requires_approval, t.allow_negative, t.active, id,
    );
    const changes = {};
    for (const k of Object.keys(t)) if (String(before[k]) !== String(typeof t[k] === 'boolean' ? +t[k] : t[k])) changes[k] = { from: before[k], to: t[k] };
    core.audit(user, 'leave_type.update', 'leave_type', id, `${user.name} updated leave type "${t.name}"`, changes);
    return { leave_type: typeOut(getType(id)) };
  });
}
function deleteType({ user, params }) {
  core.requireHr(user);
  return db.tx(() => {
    const id = Number(params.id);
    const t = getType(id);
    if (!t) throw L.notFound('Leave type not found');
    const used = db.get('SELECT (SELECT COUNT(*) FROM leave_requests WHERE leave_type_id=?) + (SELECT COUNT(*) FROM leave_balances WHERE leave_type_id=?) n', id, id).n;
    if (used) throw L.conflict(`"${t.name}" has history and cannot be deleted. Deactivate it instead.`);
    db.run('DELETE FROM leave_types WHERE id=?', id);
    core.audit(user, 'leave_type.delete', 'leave_type', id, `${user.name} deleted leave type "${t.name}"`, t);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- balances routes
function parseYear(q) {
  const y = q.year ? L.int(Number(q.year), 'year', { min: 2000, max: 2100 }) : Number(L.today().slice(0, 4));
  return y;
}
function getBalances({ user, query }) {
  const year = parseYear(query);
  const target = query.user_id ? core.requireUser(Number(query.user_id)) : user;
  if (target.id !== user.id && !core.canManage(user, target)) throw L.forbidden();
  return { year, user: core.slim(target), balances: balancesFor(target.id, year) };
}
function teamBalances({ user, query }) {
  core.requireApprover(user);
  const year = parseYear(query);
  return { year, people: core.teamOf(user).map((u) => ({ user: core.slim(u), balances: balancesFor(u.id, year) })) };
}
function adjust({ user, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const target = core.requireUser(L.int(body.user_id, 'user_id'));
    const type = getType(L.int(body.leave_type_id, 'leave_type_id'));
    if (!type) throw L.bad('Unknown leave type', 'leave_type_id');
    const year = L.int(body.year, 'year', { min: 2000, max: 2100 });
    const reason = L.str(body.reason, 'reason', { min: 3, max: 300 });
    const before = balanceFor(target.id, type, year);
    const row = db.get('SELECT * FROM leave_balances WHERE user_id=? AND leave_type_id=? AND year=?', target.id, type.id, year);
    let allocated = row ? row.allocated : null;
    let carried = row ? row.carried_over : 0;
    let adj = row ? row.adjustment : 0;
    if ('allocated' in body) allocated = body.allocated === null || body.allocated === '' ? null : L.num(body.allocated, 'allocated', { min: 0, max: 365, step: 0.5 });
    if ('carried_over' in body) carried = L.num(body.carried_over, 'carried_over', { min: 0, max: 365, step: 0.5 });
    if ('adjustment' in body) adj = L.num(body.adjustment, 'adjustment', { min: -365, max: 365, step: 0.5 });
    if (!('allocated' in body) && !('carried_over' in body) && !('adjustment' in body)) throw L.bad('Nothing to change');
    db.run(
      `INSERT INTO leave_balances(user_id,leave_type_id,year,allocated,carried_over,adjustment) VALUES(?,?,?,?,?,?)
       ON CONFLICT(user_id,leave_type_id,year) DO UPDATE SET allocated=excluded.allocated, carried_over=excluded.carried_over, adjustment=excluded.adjustment`,
      target.id, type.id, year, allocated, carried, adj,
    );
    const after = balanceFor(target.id, type, year);
    core.audit(user, 'balance.adjust', 'user', target.id,
      `${user.name} adjusted ${target.name}'s ${type.name} ${year} balance: ${before.available} -> ${after.available} days available`,
      { reason, year, leave_type: type.name, before: { allocated: before.allocated, carried_over: before.carried_over, adjustment: before.adjustment }, after: { allocated: after.allocated, carried_over: after.carried_over, adjustment: after.adjustment } });
    core.notify(target.id, { type: 'balance.adjusted', title: `${type.name} balance updated`, body: `${year}: now ${after.available} day(s) available. Reason: ${reason}`, link: '#/balances' });
    return { balance: after };
  });
}
function rollover({ user, body }) {
  core.requireHr(user);
  return db.tx(() => {
    const from = L.int(body.from_year, 'from_year', { min: 2000, max: 2099 });
    const types = db.all('SELECT * FROM leave_types WHERE active=1 AND carry_over_max>0');
    const users = db.all('SELECT * FROM users WHERE active=1');
    let n = 0;
    for (const u of users) {
      for (const t of types) {
        const b = balanceFor(u.id, t, from);
        const carry = L.round2(Math.max(0, Math.min(t.carry_over_max, b.available)));
        db.run(
          `INSERT INTO leave_balances(user_id,leave_type_id,year,allocated,carried_over,adjustment) VALUES(?,?,?,NULL,?,0)
           ON CONFLICT(user_id,leave_type_id,year) DO UPDATE SET carried_over=excluded.carried_over`,
          u.id, t.id, from + 1, carry,
        );
        n++;
      }
    }
    core.audit(user, 'balance.rollover', 'system', null, `${user.name} ran carry-over from ${from} to ${from + 1} (${n} balances)`, { from, to: from + 1, balances: n });
    return { ok: true, updated: n, to_year: from + 1 };
  });
}

const routes = [
  { m: 'GET', p: '/api/leave-types', h: ({ user, query }) => ({
    leave_types: db.all(`SELECT * FROM leave_types ${user.role === 'hr_admin' && query.all ? '' : 'WHERE active=1'} ORDER BY name`).map(typeOut),
  }) },
  { m: 'POST', p: '/api/leave-types', h: createType },
  { m: 'PUT', p: '/api/leave-types/:id', h: updateType },
  { m: 'DELETE', p: '/api/leave-types/:id', h: deleteType },
  { m: 'GET', p: '/api/balances', h: getBalances },
  { m: 'GET', p: '/api/team-balances', h: teamBalances },
  { m: 'POST', p: '/api/balances/adjust', h: adjust },
  { m: 'POST', p: '/api/balances/rollover', h: rollover },
  { m: 'GET', p: '/api/leave-requests', h: (c) => ({ requests: listRequests(c) }) },
  { m: 'POST', p: '/api/leave-requests/preview', h: ({ user, body }) => {
    const ev = evaluate(user.id, body);
    return { days: ev.total, errors: ev.errors, warnings: ev.warnings, balance: ev.balance, type: ev.type.name };
  } },
  { m: 'POST', p: '/api/leave-requests', h: createRequest },
  { m: 'POST', p: '/api/leave-requests/:id/approve', h: approve },
  { m: 'POST', p: '/api/leave-requests/:id/reject', h: reject },
  { m: 'POST', p: '/api/leave-requests/:id/cancel', h: cancel },
];

module.exports = { routes, balanceFor, balancesFor, getType, shape, SELECT_REQ, workingDays, listRequests };
