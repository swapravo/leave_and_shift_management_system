'use strict';
process.env.APP_TODAY = '2026-10-20';
process.env.NO_AUTO_SEED = '1';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { start } = require('../server');
const { seed } = require('../src/seed');

let server;
let base;
const ids = {};

class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'X-Requested-With': 'app', 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* csv etc */ }
    return { status: res.status, body: json, text };
  }
  get(p) { return this.req('GET', p); }
  post(p, b = {}) { return this.req('POST', p, b); }
  put(p, b = {}) { return this.req('PUT', p, b); }
  del(p, b = {}) { return this.req('DELETE', p, b); }
}
async function login(email, password = 'password123') {
  const c = new Client();
  const r = await c.post('/api/login', { email, password });
  assert.equal(r.status, 200, `login ${email}`);
  return c;
}

before(async () => {
  server = await start({ port: 0, dbPath: ':memory:' });
  base = `http://127.0.0.1:${server.address().port}`;
  db.tx(() => seed());
  for (const u of db.all('SELECT id,name FROM users')) ids[u.name] = u.id;
  for (const t of db.all('SELECT id,code FROM leave_types')) ids[t.code] = t.id;
});
after(() => { server.close(); db.close(); });

const ANNUAL = () => ids.ANNUAL;

test('authentication and CSRF guard', async () => {
  const anon = new Client();
  assert.equal((await anon.get('/api/me')).status, 401);
  assert.equal((await anon.post('/api/login', { email: 'aisha.khan@example.com', password: 'nope' })).status, 401);
  const noHeader = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(noHeader.status, 403);
  const c = await login('aisha.khan@example.com');
  const me = await c.get('/api/me');
  assert.equal(me.body.user.name, 'Aisha Khan');
  assert.equal(me.body.user.password_hash, undefined);
  await c.post('/api/logout');
  assert.equal((await c.get('/api/me')).status, 401);
});

test('leave request lifecycle: balance, overlap, approval, cancel', async () => {
  const aisha = await login('aisha.khan@example.com');
  const maria = await login('maria.santos@example.com');
  const before = (await aisha.get('/api/balances?year=2027')).body.balances.find((b) => b.code === 'ANNUAL');
  // Mon 1 Feb - Fri 5 Feb 2027 = 5 working days
  const r = await aisha.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2027-02-01', end_date: '2027-02-07', reason: 'Trip' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.request.days, 5, 'weekend not counted');
  assert.equal(r.body.request.status, 'pending');
  const mid = (await aisha.get('/api/balances?year=2027')).body.balances.find((b) => b.code === 'ANNUAL');
  assert.equal(mid.pending, 5);
  assert.equal(mid.available, before.available - 5);
  // overlap
  const dup = await aisha.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2027-02-03', end_date: '2027-02-03' });
  assert.equal(dup.status, 400);
  assert.match(dup.body.error.message, /overlaps/);
  // permissions
  assert.equal((await aisha.post(`/api/leave-requests/${r.body.request.id}/approve`)).status, 403);
  const daniel = await login('daniel.okafor@example.com');
  assert.equal((await daniel.post(`/api/leave-requests/${r.body.request.id}/approve`)).status, 403, 'other team manager');
  assert.equal((await maria.post(`/api/leave-requests/${r.body.request.id}/reject`)).status, 400, 'note required');
  // manager sees it, gets notified
  const notes = (await maria.get('/api/notifications')).body;
  assert.ok(notes.notifications.some((n) => /Aisha Khan requested leave/.test(n.title)));
  const ap = await maria.post(`/api/leave-requests/${r.body.request.id}/approve`, { note: 'ok' });
  assert.equal(ap.status, 200, ap.text);
  assert.equal((await maria.post(`/api/leave-requests/${r.body.request.id}/approve`)).status, 409, 'double approval');
  const after = (await aisha.get('/api/balances?year=2027')).body.balances.find((b) => b.code === 'ANNUAL');
  assert.equal(after.used, 5);
  assert.equal(after.pending, 0);
  const n2 = (await aisha.get('/api/notifications')).body.notifications;
  assert.ok(n2.some((n) => n.title === 'Leave approved'));
  // owner cancels approved future leave -> balance restored
  assert.equal((await aisha.post(`/api/leave-requests/${r.body.request.id}/cancel`)).status, 200);
  const restored = (await aisha.get('/api/balances?year=2027')).body.balances.find((b) => b.code === 'ANNUAL');
  assert.equal(restored.available, before.available);
});

test('validation: insufficient balance, bad dates, half days, no-working-days', async () => {
  const ben = await login('ben.carter@example.com');
  const tooMuch = await ben.post('/api/leave-requests', { leave_type_id: ids.PERSONAL, start_date: '2027-03-01', end_date: '2027-03-12' });
  assert.equal(tooMuch.status, 400);
  assert.match(tooMuch.body.error.message, /Not enough/);
  assert.equal((await ben.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: 'garbage', end_date: '2027-03-12' })).status, 400);
  assert.equal((await ben.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2027-03-05', end_date: '2027-03-01' })).status, 400);
  const weekend = await ben.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2027-03-06', end_date: '2027-03-07' });
  assert.match(weekend.body.error.message, /no working days/);
  assert.equal((await ben.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2020-01-01', end_date: '2020-01-02' })).status, 400, 'too far in past');
  const half = await ben.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2027-03-02', end_date: '2027-03-02', half_day: true });
  assert.equal(half.body.request.days, 0.5);
  const halfRange = await ben.post('/api/leave-requests/preview', { leave_type_id: ANNUAL(), start_date: '2027-03-09', end_date: '2027-03-10', half_day: true });
  assert.ok(halfRange.body.errors.length);
  // public holiday not counted (2027-01-01 is a Friday; Dec 31 Thu - Jan 4 Mon => Thu, Mon)
  const hol = await ben.post('/api/leave-requests/preview', { leave_type_id: ANNUAL(), start_date: '2026-12-31', end_date: '2027-01-04' });
  assert.equal(hol.body.days, 2);
});

test('approval with rostered shifts needs explicit release', async () => {
  const grace = await login('grace.liu@example.com');
  const daniel = await login('daniel.okafor@example.com');
  const sched = db.get("SELECT date FROM shifts WHERE user_id=? AND status='scheduled' AND date>'2026-10-22' ORDER BY date LIMIT 1", ids['Grace Liu']);
  assert.ok(sched);
  const r = await grace.post('/api/leave-requests', { leave_type_id: ids.PERSONAL, start_date: sched.date, end_date: sched.date });
  assert.equal(r.status, 200, r.text);
  const first = await daniel.post(`/api/leave-requests/${r.body.request.id}/approve`, {});
  assert.equal(first.status, 409);
  assert.equal(first.body.error.code, 'shift_conflicts');
  assert.ok(first.body.error.shifts.length >= 1);
  const second = await daniel.post(`/api/leave-requests/${r.body.request.id}/approve`, { release_shifts: true });
  assert.equal(second.status, 200, second.text);
  assert.equal(db.get("SELECT COUNT(*) n FROM shifts WHERE user_id=? AND date=? AND status='scheduled'", ids['Grace Liu'], sched.date).n, 0);
  // and shifts cannot be created on approved leave
  const bad = await daniel.post('/api/shifts', { user_id: ids['Grace Liu'], date: sched.date, start_time: '09:00', end_time: '17:00' });
  assert.equal(bad.status, 409);
  assert.match(bad.body.error.message, /approved leave/);
});

test('reject, revoke and manager self-service rules', async () => {
  const isla = await login('isla.murphy@example.com');
  const daniel = await login('daniel.okafor@example.com');
  const r = await isla.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2027-04-05', end_date: '2027-04-06' });
  const rej = await daniel.post(`/api/leave-requests/${r.body.request.id}/reject`, { note: 'Busy period' });
  assert.equal(rej.status, 200);
  assert.equal(rej.body.request.status, 'rejected');
  assert.equal((await isla.post(`/api/leave-requests/${r.body.request.id}/cancel`)).status, 409);
  const bal = (await isla.get('/api/balances?year=2027')).body.balances.find((b) => b.code === 'ANNUAL');
  assert.equal(bal.pending, 0);
  // manager's own request goes to HR and they cannot approve it themselves
  const mine = await daniel.post('/api/leave-requests', { leave_type_id: ANNUAL(), start_date: '2027-04-12', end_date: '2027-04-12' });
  assert.equal((await daniel.post(`/api/leave-requests/${mine.body.request.id}/approve`)).status, 403);
  const helen = await login('helen.park@example.com');
  assert.equal((await helen.post(`/api/leave-requests/${mine.body.request.id}/approve`)).status, 200);
  // revoke
  const rv = await helen.post(`/api/leave-requests/${mine.body.request.id}/cancel`, {});
  assert.equal(rv.status, 400, 'revoke needs a note');
  assert.equal((await helen.post(`/api/leave-requests/${mine.body.request.id}/cancel`, { note: 'Audit' })).status, 200);
});

test('roster: manager creates shifts, rules enforced', async () => {
  const maria = await login('maria.santos@example.com');
  const aisha = await login('aisha.khan@example.com');
  const diego = ids['Diego Ramos'];
  const ok = await maria.post('/api/shifts', { user_id: diego, date: '2027-05-03', start_time: '09:00', end_time: '17:00', label: 'Desk' });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await maria.post('/api/shifts', { user_id: diego, date: '2027-05-03', start_time: '12:00', end_time: '20:00' })).status, 409, 'overlap');
  const rest = await maria.post('/api/shifts', { user_id: diego, date: '2027-05-04', start_time: '00:30', end_time: '08:30' });
  assert.equal(rest.status, 409, 'less than 8h rest');
  assert.match(rest.body.error.message, /rest|overlapping/);
  assert.equal((await maria.post('/api/shifts', { user_id: diego, date: '2020-01-01', start_time: '09:00', end_time: '17:00' })).status, 400, 'past');
  assert.equal((await maria.post('/api/shifts', { user_id: ids['Farid Hassan'], date: '2027-05-03', start_time: '09:00', end_time: '17:00' })).status, 403, 'not her report');
  assert.equal((await aisha.post('/api/shifts', { user_id: diego, date: '2027-05-05', start_time: '09:00', end_time: '17:00' })).status, 403, 'employee');
  const night = await maria.post('/api/shifts', { user_id: diego, date: '2027-05-10', start_time: '23:00', end_time: '07:00' });
  assert.equal(night.status, 200, 'overnight shift allowed');
  const upd = await maria.put(`/api/shifts/${ok.body.shift.id}`, { end_time: '16:00' });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.shift.end_time, '16:00');
  const week = await maria.get('/api/roster?start=2027-05-03');
  assert.equal(week.body.start, '2027-05-03');
  assert.ok(week.body.shifts.some((s) => s.id === ok.body.shift.id));
  assert.ok(!week.body.users.some((u) => u.name === 'Farid Hassan'), 'other department hidden');
  // copy week
  const cp = await maria.post('/api/shifts/copy-week', { from_start: '2027-05-03', to_start: '2027-05-17' });
  assert.equal(cp.status, 200);
  assert.equal(cp.body.created, 1);
  const cp2 = await maria.post('/api/shifts/copy-week', { from_start: '2027-05-03', to_start: '2027-05-17' });
  assert.equal(cp2.body.created, 0, 'copying twice does not duplicate');
  const del = await maria.del(`/api/shifts/${ok.body.shift.id}`, {});
  assert.equal(del.status, 200);
});

test('shift swap: peer accepts, manager approves, shifts exchange', async () => {
  const maria = await login('maria.santos@example.com');
  const chloe = await login('chloe.nguyen@example.com');
  const emma = await login('emma.fischer@example.com');
  const a = (await maria.post('/api/shifts', { user_id: ids['Chloe Nguyen'], date: '2027-06-07', start_time: '09:00', end_time: '17:00' })).body.shift;
  const b = (await maria.post('/api/shifts', { user_id: ids['Emma Fischer'], date: '2027-06-08', start_time: '15:00', end_time: '23:00' })).body.shift;
  // cross-department swap refused
  const farid = (await (await login('daniel.okafor@example.com')).post('/api/shifts', { user_id: ids['Farid Hassan'], date: '2027-06-09', start_time: '09:00', end_time: '17:00' })).body.shift;
  const cross = await chloe.post('/api/swaps', { my_shift_id: a.id, target_id: ids['Farid Hassan'], target_shift_id: farid.id });
  assert.equal(cross.status, 400);
  // can't offer someone else's shift
  assert.equal((await chloe.post('/api/swaps', { my_shift_id: b.id, target_id: ids['Emma Fischer'], target_shift_id: a.id })).status, 404);
  const sw = await chloe.post('/api/swaps', { my_shift_id: a.id, target_id: ids['Emma Fischer'], target_shift_id: b.id, message: 'please' });
  assert.equal(sw.status, 200, sw.text);
  assert.equal(sw.body.swap.status, 'pending_peer');
  assert.ok((await emma.get('/api/notifications')).body.notifications.some((n) => /swap/i.test(n.title)));
  // duplicates blocked
  assert.equal((await chloe.post('/api/swaps', { my_shift_id: a.id, target_id: ids['Emma Fischer'], target_shift_id: b.id })).status, 409);
  // wrong people cannot respond / approve
  assert.equal((await chloe.post(`/api/swaps/${sw.body.swap.id}/accept`)).status, 403);
  assert.equal((await maria.post(`/api/swaps/${sw.body.swap.id}/approve`)).status, 409, 'peer must accept first');
  assert.equal((await emma.post(`/api/swaps/${sw.body.swap.id}/accept`)).status, 200);
  assert.equal((await emma.post(`/api/swaps/${sw.body.swap.id}/approve`)).status, 403);
  assert.equal((await chloe.post(`/api/swaps/${sw.body.swap.id}/approve`)).status, 403);
  const approvals = (await maria.get('/api/swaps?scope=approvals')).body.swaps;
  assert.ok(approvals.find((w) => w.id === sw.body.swap.id).can_decide);
  const ap = await maria.post(`/api/swaps/${sw.body.swap.id}/approve`, {});
  assert.equal(ap.status, 200, ap.text);
  assert.equal(db.get('SELECT user_id FROM shifts WHERE id=?', a.id).user_id, ids['Emma Fischer']);
  assert.equal(db.get('SELECT user_id FROM shifts WHERE id=?', b.id).user_id, ids['Chloe Nguyen']);
});

test('shift swap: decline, withdraw and cancel when shift removed', async () => {
  const maria = await login('maria.santos@example.com');
  const ben = await login('ben.carter@example.com');
  const diego = await login('diego.ramos@example.com');
  const s1 = (await maria.post('/api/shifts', { user_id: ids['Ben Carter'], date: '2027-07-05', start_time: '09:00', end_time: '17:00' })).body.shift;
  const s2 = (await maria.post('/api/shifts', { user_id: ids['Ben Carter'], date: '2027-07-06', start_time: '09:00', end_time: '17:00' })).body.shift;
  const cover = await ben.post('/api/swaps', { my_shift_id: s1.id, target_id: ids['Diego Ramos'] });
  assert.equal(cover.status, 200);
  assert.equal((await diego.post(`/api/swaps/${cover.body.swap.id}/decline`, { note: 'no' })).status, 200);
  assert.equal(db.get('SELECT status FROM shift_swaps WHERE id=?', cover.body.swap.id).status, 'declined');
  const again = await ben.post('/api/swaps', { my_shift_id: s2.id, target_id: ids['Diego Ramos'] });
  assert.equal((await ben.post(`/api/swaps/${again.body.swap.id}/cancel`)).status, 200);
  const third = await ben.post('/api/swaps', { my_shift_id: s2.id, target_id: ids['Diego Ramos'] });
  await maria.del(`/api/shifts/${s2.id}`, {});
  assert.equal(db.get('SELECT status FROM shift_swaps WHERE id=?', third.body.swap.id).status, 'cancelled');
});

test('HR admin: leave types, users, holidays, balances; employees are blocked', async () => {
  const helen = await login('helen.park@example.com');
  const aisha = await login('aisha.khan@example.com');
  const maria = await login('maria.santos@example.com');
  const payload = { name: 'Study Leave', code: 'study', annual_allowance: 5, carry_over_max: 0, paid: true, requires_approval: true, color: '#0ea5e9' };
  assert.equal((await aisha.post('/api/leave-types', payload)).status, 403);
  assert.equal((await maria.post('/api/leave-types', payload)).status, 403);
  const created = await helen.post('/api/leave-types', payload);
  assert.equal(created.status, 200, created.text);
  assert.equal(created.body.leave_type.code, 'STUDY');
  assert.equal((await helen.post('/api/leave-types', payload)).status, 409, 'duplicate');
  assert.equal((await helen.post('/api/leave-types', { ...payload, name: 'X', code: 'x', annual_allowance: -1 })).status, 400);
  const id = created.body.leave_type.id;
  // visible and usable by employees straight away, with the right allowance
  const mine = (await aisha.get('/api/balances')).body.balances.find((b) => b.code === 'STUDY');
  assert.equal(mine.available, 5);
  assert.equal((await helen.put(`/api/leave-types/${id}`, { annual_allowance: 7 })).body.leave_type.annual_allowance, 7);
  assert.equal((await aisha.get('/api/balances')).body.balances.find((b) => b.code === 'STUDY').available, 7);
  // deactivate hides it from the request form
  await helen.put(`/api/leave-types/${id}`, { active: false });
  assert.ok(!(await aisha.get('/api/leave-types')).body.leave_types.some((t) => t.id === id));
  const blocked = await aisha.post('/api/leave-requests', { leave_type_id: id, start_date: '2027-08-02', end_date: '2027-08-02' });
  assert.equal(blocked.status, 400);
  // used types cannot be deleted, unused can
  assert.equal((await helen.del(`/api/leave-types/${ANNUAL()}`)).status, 409);
  assert.equal((await helen.del(`/api/leave-types/${id}`)).status, 200);
  // balance adjustment
  const adj = await helen.post('/api/balances/adjust', { user_id: ids['Aisha Khan'], leave_type_id: ANNUAL(), year: 2027, adjustment: 3, reason: 'Long service' });
  assert.equal(adj.status, 200, adj.text);
  assert.equal(adj.body.balance.adjustment, 3);
  assert.equal((await helen.post('/api/balances/adjust', { user_id: ids['Aisha Khan'], leave_type_id: ANNUAL(), year: 2027, adjustment: 3 })).status, 400, 'reason required');
  assert.equal((await aisha.post('/api/balances/adjust', { user_id: ids['Aisha Khan'], leave_type_id: ANNUAL(), year: 2027, adjustment: 30, reason: 'self-service' })).status, 403);
  // rollover
  const ro = await helen.post('/api/balances/rollover', { from_year: 2026 });
  assert.equal(ro.status, 200);
  const carried = (await aisha.get('/api/balances?year=2027')).body.balances.find((b) => b.code === 'ANNUAL');
  assert.ok(carried.carried_over >= 0 && carried.carried_over <= 5);
  // users
  const nu = await helen.post('/api/users', { name: 'Zed New', email: 'zed@example.com', password: 'longenough1', role: 'employee', department: 'Customer Support', manager_id: ids['Maria Santos'] });
  assert.equal(nu.status, 200, nu.text);
  assert.equal((await helen.post('/api/users', { name: 'Zed Two', email: 'ZED@example.com', password: 'longenough1', role: 'employee', department: 'X' })).status, 409);
  assert.equal((await aisha.get('/api/users')).body.users[0].email, undefined, 'directory hides emails from employees');
  const zed = await login('zed@example.com', 'longenough1');
  assert.equal((await zed.get('/api/me')).status, 200);
  assert.equal((await helen.put(`/api/users/${nu.body.user.id}`, { active: false })).status, 200);
  assert.equal((await zed.get('/api/me')).status, 401, 'sessions revoked on deactivation');
  assert.equal((await helen.put(`/api/users/${ids['Helen Park']}`, { role: 'employee' })).status, 409, 'cannot demote self');
  assert.equal((await helen.put(`/api/users/${ids['Maria Santos']}`, { role: 'employee' })).status, 409, 'has reports');
  // holidays
  assert.equal((await helen.post('/api/holidays', { date: '2027-08-30', name: 'Summer Bank Holiday' })).status, 200);
  const pv = await aisha.post('/api/leave-requests/preview', { leave_type_id: ANNUAL(), start_date: '2027-08-30', end_date: '2027-08-31' });
  assert.equal(pv.body.days, 1);
  assert.equal((await aisha.del('/api/holidays/2027-08-30')).status, 403);
  assert.equal((await helen.del('/api/holidays/2027-08-30')).status, 200);
});

test('audit log: HR only, append-only, records actions', async () => {
  const helen = await login('helen.park@example.com');
  const maria = await login('maria.santos@example.com');
  assert.equal((await maria.get('/api/audit')).status, 403);
  const log = await helen.get('/api/audit?limit=200');
  assert.equal(log.status, 200);
  const actions = new Set(log.body.entries.map((e) => e.action));
  for (const a of ['leave.create', 'leave.approve', 'leave.reject', 'swap.approve', 'shift.create', 'leave_type.create', 'balance.adjust', 'auth.login']) assert.ok(actions.has(a), `missing ${a}`);
  const filtered = await helen.get('/api/audit?action=swap.&q=Emma');
  assert.ok(filtered.body.entries.length >= 1 && filtered.body.entries.every((e) => e.action.startsWith('swap.')));
  assert.throws(() => db.run("UPDATE audit_log SET summary='x' WHERE id=1"), /append-only/);
  assert.throws(() => db.run('DELETE FROM audit_log WHERE id=1'), /append-only/);
  const csv = await helen.get('/api/audit.csv');
  assert.match(csv.text, /^id,timestamp,actor/);
  const failed = await (new Client()).post('/api/login', { email: 'helen.park@example.com', password: 'wrong' });
  assert.equal(failed.status, 401);
  assert.ok((await helen.get('/api/audit?action=auth.login_failed')).body.entries.length >= 1);
});

test('notifications: read state and ownership', async () => {
  const aisha = await login('aisha.khan@example.com');
  const maria = await login('maria.santos@example.com');
  const list = (await aisha.get('/api/notifications')).body;
  assert.ok(list.unread > 0);
  const n = list.notifications[0];
  assert.equal((await maria.post(`/api/notifications/${n.id}/read`)).status, 404, 'not yours');
  assert.equal((await aisha.post(`/api/notifications/${n.id}/read`)).status, 200);
  assert.equal((await aisha.post('/api/notifications/read-all')).status, 200);
  assert.equal((await aisha.get('/api/notifications')).body.unread, 0);
  assert.equal((await aisha.get('/api/me')).body.unread, 0);
});

test('calendar, dashboards and team views respect roles', async () => {
  const aisha = await login('aisha.khan@example.com');
  const maria = await login('maria.santos@example.com');
  const helen = await login('helen.park@example.com');
  const cal = await aisha.get('/api/calendar?month=2026-10');
  assert.equal(cal.status, 200);
  assert.ok(cal.body.entries.length > 0);
  const others = cal.body.entries.filter((e) => e.user_id !== ids['Aisha Khan']);
  assert.ok(others.every((e) => e.type_name === 'Away'), 'leave types hidden from peers');
  assert.ok(cal.body.users.every((u) => u.department === 'Customer Support'));
  const mcal = await maria.get('/api/calendar?month=2026-10');
  assert.ok(mcal.body.entries.some((e) => e.type_name === 'Sick Leave'), 'manager sees leave types');
  assert.equal((await aisha.get('/api/calendar?month=bad')).status, 200);
  assert.equal((await aisha.get('/api/team')).status, 403);
  assert.equal((await aisha.get('/api/team-balances')).status, 403);
  const dash = await maria.get('/api/dashboard');
  assert.ok(dash.body.manager.coverage.length === 14);
  assert.equal((await aisha.get('/api/dashboard')).body.manager, undefined);
  const hd = await helen.get('/api/dashboard');
  assert.equal(hd.body.manager.scope, 'organisation');
  assert.ok((await aisha.get(`/api/balances?user_id=${ids['Farid Hassan']}`)).status === 403);
  assert.ok((await maria.get(`/api/balances?user_id=${ids['Ben Carter']}`)).status === 200);
});

test('static files and routing hygiene', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/js/app.js')).status, 200);
  assert.equal((await fetch(base + '/../package.json')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/package.json')).status, 404);
  const c = await login('aisha.khan@example.com');
  assert.equal((await c.get('/api/nope')).status, 404);
  assert.equal((await c.req('PATCH', '/api/me')).status, 405);
  const bad = await fetch(base + '/api/leave-requests', { method: 'POST', headers: { 'X-Requested-With': 'app', Cookie: c.cookie, 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(bad.status, 400);
});
