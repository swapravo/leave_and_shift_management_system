'use strict';
// Demo data. Run `npm run seed` to wipe and rebuild the database, or let `npm start` seed an empty one.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const L = require('./lib');
const auth = require('./auth');
const core = require('./core');
const leave = require('./leave');
const shifts = require('./shifts');
const { match } = require('./routes');

const PASSWORD = 'password123';

function call(user, method, p, body = {}, query = {}) {
  const m = match(method, p);
  if (!m || !m.route) throw new Error(`no route ${method} ${p}`);
  return m.route.h({ user: { ...user, ip: '127.0.0.1' }, body, query, params: m.params });
}

function nthWeekday(year, month, weekday, n) { // month 1-12, weekday 0=Sun
  let d = `${year}-${String(month).padStart(2, '0')}-01`;
  while (L.dow(d) !== weekday) d = L.addDays(d, 1);
  return L.addDays(d, 7 * (n - 1));
}

function seed() {
  const T = L.today();
  const Y = Number(T.slice(0, 4));
  const now = L.nowIso();

  // ---- people
  const pw = auth.hashPassword(PASSWORD);
  const mk = (name, role, dept, title, mgr, hire) => {
    const email = `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.')}@example.com`;
    return db.run('INSERT INTO users(name,email,password_hash,role,manager_id,department,title,hire_date,active,created_at) VALUES(?,?,?,?,?,?,?,?,1,?)',
      name, email, pw, role, mgr, dept, title, hire, now).id;
  };
  const helen = mk('Helen Park', 'hr_admin', 'People & HR', 'Head of People', null, '2019-02-04');
  const hugo = mk('Hugo Alvarez', 'hr_admin', 'People & HR', 'HR Operations Lead', helen, '2021-06-14');
  const maria = mk('Maria Santos', 'manager', 'Customer Support', 'Support Manager', helen, '2020-03-02');
  const daniel = mk('Daniel Okafor', 'manager', 'Operations', 'Operations Manager', helen, '2020-09-14');
  const support = ['Aisha Khan', 'Ben Carter', 'Chloe Nguyen', 'Diego Ramos', 'Emma Fischer']
    .map((n, i) => mk(n, 'employee', 'Customer Support', i === 0 ? 'Senior Support Agent' : 'Support Agent', maria, `202${i % 4}-0${(i % 9) + 1}-10`));
  const ops = ['Farid Hassan', 'Grace Liu', 'Henry Adams', 'Isla Murphy']
    .map((n, i) => mk(n, 'employee', 'Operations', i === 0 ? 'Shift Lead' : 'Operations Associate', daniel, `202${i % 4}-1${i % 3}-05`));
  const U = {};
  for (const u of db.all('SELECT * FROM users')) U[u.name] = u;
  const byId = (id) => db.get('SELECT * FROM users WHERE id=?', id);

  // ---- leave types
  const lt = (name, code, color, allow, carry, paid, approval, neg) =>
    db.run('INSERT INTO leave_types(name,code,color,annual_allowance,carry_over_max,paid,requires_approval,allow_negative,active,created_at) VALUES(?,?,?,?,?,?,?,?,1,?)',
      name, code, color, allow, carry, paid, approval, neg, now).id;
  const annual = lt('Annual Leave', 'ANNUAL', '#2563eb', 25, 5, 1, 1, 0);
  const sick = lt('Sick Leave', 'SICK', '#dc2626', 10, 0, 1, 1, 0);
  const personal = lt('Personal Day', 'PERSONAL', '#9333ea', 3, 0, 1, 1, 0);
  const volunteer = lt('Volunteer Day', 'VOLUNTEER', '#059669', 2, 0, 1, 0, 0);
  const unpaid = lt('Unpaid Leave', 'UNPAID', '#64748b', 0, 0, 0, 1, 1);

  // ---- shift types
  const st = (name, a, b, color) => db.run('INSERT INTO shift_types(name,start_time,end_time,color,active) VALUES(?,?,?,?,1)', name, a, b, color).id;
  const morning = st('Morning', '07:00', '15:00', '#f59e0b');
  const day = st('Day', '09:00', '17:00', '#10b981');
  const evening = st('Evening', '15:00', '23:00', '#6366f1');
  const night = st('Night', '23:00', '07:00', '#475569');
  const typeRow = Object.fromEntries(db.all('SELECT * FROM shift_types').map((t) => [t.id, t]));

  // ---- holidays
  for (const y of [Y - 1, Y, Y + 1]) {
    const add = (d, n) => db.run('INSERT OR IGNORE INTO holidays(date,name) VALUES(?,?)', d, n);
    add(`${y}-01-01`, "New Year's Day");
    add(nthWeekday(y, 9, 1, 1), 'Labor Day');
    add(nthWeekday(y, 11, 4, 4), 'Thanksgiving');
    add(`${y}-12-25`, 'Christmas Day');
    add(`${y}-12-26`, 'Boxing Day');
  }

  // ---- history (direct inserts, with audit trail)
  const insertLeave = (u, typeId, start, end, status, { reason = null, by = null, note = null, half = false } = {}) => {
    const days = leave.workingDays(start, end, half);
    if (!days.length) return null;
    const total = days.reduce((s, d) => s + d.amount, 0);
    const id = db.run(
      `INSERT INTO leave_requests(user_id,leave_type_id,start_date,end_date,half_day,days,reason,status,decided_by,decided_at,decision_note,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, u.id, typeId, start, end, half, total, reason, status, by ? by.id : null, by ? now : null, note, now, now).id;
    for (const d of days) db.run('INSERT INTO leave_request_days(request_id,date,amount) VALUES(?,?,?)', id, d.date, d.amount);
    const t = leave.getType(typeId);
    core.audit(by || u, status === 'approved' ? 'leave.approve' : 'leave.create', 'leave_request', id,
      `${(by || u).name} ${status === 'approved' ? `approved ${u.name}'s` : 'filed'} ${t.name} (${start} to ${end}) [historical]`, { historical: true });
    return id;
  };
  const past = [
    [U['Aisha Khan'], annual, -75, -71, 'Family trip'], [U['Aisha Khan'], sick, -30, -29, null],
    [U['Ben Carter'], annual, -120, -106, 'Summer holiday'], [U['Chloe Nguyen'], annual, -40, -36, null],
    [U['Chloe Nguyen'], personal, -12, -12, null], [U['Diego Ramos'], annual, -90, -80, 'Wedding'],
    [U['Diego Ramos'], sick, -20, -19, null], [U['Emma Fischer'], annual, -60, -50, 'Travel'],
    [U['Farid Hassan'], annual, -100, -96, null], [U['Grace Liu'], annual, -55, -41, 'Honeymoon'],
    [U['Henry Adams'], sick, -25, -23, null], [U['Henry Adams'], annual, -140, -136, null],
    [U['Isla Murphy'], annual, -33, -29, null], [U['Maria Santos'], annual, -80, -71, null],
    [U['Daniel Okafor'], annual, -65, -61, null],
  ];
  for (const [u, t, a, b, reason] of past) insertLeave(u, t, L.addDays(T, a), L.addDays(T, b), 'approved', { reason, by: byId(u.manager_id) });
  // carried-over days from last year
  for (const u of [...support, ...ops, maria, daniel]) {
    db.run('INSERT OR REPLACE INTO leave_balances(user_id,leave_type_id,year,allocated,carried_over,adjustment) VALUES(?,?,?,NULL,?,0)', u, annual, Y, [3, 2, 5, 0, 1, 4, 2, 0, 5, 1, 3][(u + 3) % 11] || 0);
  }
  core.audit(U['Hugo Alvarez'], 'balance.rollover', 'system', null, `Hugo Alvarez ran carry-over from ${Y - 1} to ${Y} [historical]`, { from: Y - 1, to: Y });

  // working-day-aligned [start,end] for offsets from today
  const isWork = (d) => !L.isWeekend(d) && !db.get('SELECT 1 x FROM holidays WHERE date=?', d);
  const span = (a, b) => {
    let s = L.addDays(T, a);
    while (!isWork(s)) s = L.addDays(s, 1);
    let e = L.addDays(T, b);
    while (!isWork(e) && e > s) e = L.addDays(e, -1);
    return [s, e < s ? s : e];
  };

  // ---- approved upcoming leave (through the real workflow)
  const asApprover = (u) => byId(u.manager_id);
  const upcoming = [
    [U['Ben Carter'], annual, 9, 11, 'Long weekend'], [U['Emma Fischer'], annual, 21, 32, 'Visiting family'],
    [U['Henry Adams'], annual, 16, 20, null], [U['Diego Ramos'], personal, 6, 6, 'Moving house'],
  ];
  for (const [u, t, a, b, reason] of upcoming) {
    const [sd, ed] = span(a, b);
    const r = call(byId(u.id), 'POST', '/api/leave-requests', { leave_type_id: t, start_date: sd, end_date: ed, reason });
    call(asApprover(u), 'POST', `/api/leave-requests/${r.request.id}/approve`, { note: 'Enjoy!', release_shifts: true });
  }
  // someone off right now so "out today" has content
  { const u = U['Chloe Nguyen'];
    const r = insertLeave(u, sick, T, L.addDays(T, 1), 'approved', { by: byId(u.manager_id), note: 'Get well soon' }); void r; }

  // ---- rosters (direct inserts; skips leave days and anything that breaks the rest rules)
  const monday = L.mondayOf(T);
  const rotation = [morning, day, evening];
  const teams = [{ mgr: maria, people: support }, { mgr: daniel, people: ops }];
  let created = 0;
  const addShift = (uid, date, typeId, by) => {
    const t = typeRow[typeId];
    try { shifts.checkAssignable(uid, date, t.start_time, t.end_time); } catch { return; }
    db.run(`INSERT INTO shifts(user_id,date,start_time,end_time,shift_type_id,label,notes,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,NULL,NULL,'scheduled',?,?,?)`,
      uid, date, t.start_time, t.end_time, typeId, by, now, now);
    created++;
  };
  for (const { mgr, people } of teams) {
    const before = created;
    people.forEach((uid, i) => {
      for (let w = -2; w <= 4; w++) {
        const typeId = U['Isla Murphy'].id === uid ? night : rotation[(((i + w) % 3) + 3) % 3];
        for (let d = 0; d < 5; d++) addShift(uid, L.addDays(monday, w * 7 + d), typeId, mgr);
        if (mgr === daniel && ((w + 2) % ops.length === i) && uid !== U['Isla Murphy'].id) addShift(uid, L.addDays(monday, w * 7 + 5), morning, mgr);
      }
    });
    core.audit(byId(mgr), 'shift.copy_week', 'system', null, `${byId(mgr).name} published the rota: ${created - before} shift(s) [initial roster]`, { seeded: true });
  }

  // ---- pending leave (these produce notifications for approvers)
  const pend = [
    [U['Aisha Khan'], annual, 14, 18, 'Skiing trip'],
    [U['Grace Liu'], annual, 4, 5, 'Family event'], // overlaps shifts: shows the conflict warning
    [U['Farid Hassan'], annual, 30, 37, null],
    [U['Ben Carter'], sick, 1, 1, 'Dentist'],
    [U['Maria Santos'], annual, 40, 44, 'Holiday'],
  ];
  const pendIds = {};
  for (const [u, t, a, b, reason] of pend) {
    const [sd, ed] = span(a, b);
    const r = call(byId(u.id), 'POST', '/api/leave-requests', { leave_type_id: t, start_date: sd, end_date: ed, reason });
    pendIds[u.name] = r.request.id;
  }
  // a rejected one and a cancelled one for variety
  { const u = U['Diego Ramos'];
    const r = call(byId(u.id), 'POST', '/api/leave-requests', { leave_type_id: annual, start_date: span(21, 25)[0], end_date: span(21, 25)[1], reason: 'Concert tour' });
    call(asApprover(u), 'POST', `/api/leave-requests/${r.request.id}/reject`, { note: 'Emma is already off that fortnight; can we move this a week later?' }); }
  { const u = U['Isla Murphy'];
    const r = call(byId(u.id), 'POST', '/api/leave-requests', { leave_type_id: personal, start_date: span(10, 10)[0], end_date: span(10, 10)[1] });
    call(byId(u.id), 'POST', `/api/leave-requests/${r.request.id}/cancel`, {}); }
  { const u = U['Maria Santos'];
    call(byId(u.id), 'POST', '/api/leave-requests', { leave_type_id: volunteer, start_date: span(12, 12)[0], end_date: span(12, 12)[1], reason: 'Food bank' }); }

  // ---- shift swaps
  const futureShift = (uid, afterDays) => db.get(
    "SELECT * FROM shifts WHERE user_id=? AND status='scheduled' AND date>=? ORDER BY date LIMIT 1", uid, L.addDays(T, afterDays));
  const trySwap = (reqU, tgtU, ra, ta, cover, accept, message) => {
    for (let k = 0; k < 6; k++) {
      const rs = futureShift(reqU.id, ra + k);
      const ts = cover ? null : futureShift(tgtU.id, ta + k);
      try {
        const r = call(byId(reqU.id), 'POST', '/api/swaps', { my_shift_id: rs.id, target_id: tgtU.id, target_shift_id: ts && ts.id, message });
        if (accept === true) call(byId(tgtU.id), 'POST', `/api/swaps/${r.swap.id}/accept`, {});
        if (accept === false) call(byId(tgtU.id), 'POST', `/api/swaps/${r.swap.id}/decline`, { note: "Sorry, I can't make that day" });
        return;
      } catch { /* try the next pair of shifts */ }
    }
  };
  trySwap(U['Aisha Khan'], U['Ben Carter'], 8, 8, false, null, 'Dentist appointment that morning - could we swap?');
  trySwap(U['Farid Hassan'], U['Henry Adams'], 3, 3, false, true, 'Family dinner; happy to take yours');
  trySwap(U['Chloe Nguyen'], U['Diego Ramos'], 12, 12, true, false, 'Could you cover this one?');
  trySwap(U['Emma Fischer'], U['Aisha Khan'], 5, 5, false, true, 'Swap so I can attend a training?');
  // one swap is approved so the roster reflects it and the audit log shows it
  { const w = db.get("SELECT * FROM shift_swaps WHERE status='pending_manager' AND requester_id=?", U['Emma Fischer'].id);
    if (w) call(byId(maria), 'POST', `/api/swaps/${w.id}/approve`, { note: 'Approved - thanks for arranging it' }); }

  // ---- adjustments / misc audit entries
  call(byId(helen), 'POST', '/api/balances/adjust', { user_id: U['Grace Liu'].id, leave_type_id: annual, year: Y, adjustment: 2, reason: 'Granted two extra days for covering the Q3 peak' });

  return { users: db.get('SELECT COUNT(*) n FROM users').n, shifts: created, password: PASSWORD };
}

module.exports = { seed, PASSWORD };

if (require.main === module) {
  const file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');
  if (process.argv.includes('--reset')) for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
  db.open(file);
  if (db.get('SELECT COUNT(*) n FROM users').n) {
    console.log('Database already has data. Use --reset to wipe and reseed.');
    process.exit(1);
  }
  const r = db.tx(() => seed());
  console.log(`Seeded ${r.users} users and ${r.shifts} shifts into ${file}. All demo passwords: ${r.password}`);
}
