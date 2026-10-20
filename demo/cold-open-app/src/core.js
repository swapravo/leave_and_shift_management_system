'use strict';
// Cross-cutting helpers: audit log, notifications, people/permission rules.
const db = require('./db');
const { nowIso, forbidden, notFound } = require('./lib');

function audit(actor, action, entityType, entityId, summary, details) {
  db.run(
    `INSERT INTO audit_log(ts,actor_id,actor_name,actor_role,action,entity_type,entity_id,summary,details,ip)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    nowIso(), actor ? actor.id : null, actor ? actor.name : 'System', actor ? actor.role : null,
    action, entityType || null, entityId ?? null, summary, details ? JSON.stringify(details) : null,
    actor && actor.ip ? actor.ip : null,
  );
}

function notify(userIds, { type, title, body, link }) {
  const ids = [...new Set([].concat(userIds).filter((x) => x != null))];
  for (const id of ids) {
    db.run('INSERT INTO notifications(user_id,type,title,body,link,created_at) VALUES(?,?,?,?,?,?)', id, type, title, body || null, link || null, nowIso());
  }
}

const getUser = (id) => db.get('SELECT * FROM users WHERE id = ?', id);
function requireUser(id) {
  const u = getUser(id);
  if (!u) throw notFound('User not found');
  return u;
}
const hrAdmins = () => db.all("SELECT * FROM users WHERE role='hr_admin' AND active=1");

// Who should be asked to approve things for `user`.
function approversFor(user) {
  if (user.manager_id) {
    const m = getUser(user.manager_id);
    if (m && m.active) return [m];
  }
  return hrAdmins().filter((h) => h.id !== user.id);
}
// May `actor` approve/reject things belonging to `owner`?
function canDecide(actor, owner) {
  if (actor.id === owner.id) return false;
  return actor.role === 'hr_admin' || (actor.role === 'manager' && owner.manager_id === actor.id);
}
// May `actor` manage (schedule, adjust) `target`?
function canManage(actor, target) {
  return actor.role === 'hr_admin' || (actor.role === 'manager' && target.manager_id === actor.id);
}
function requireManage(actor, target) {
  if (!canManage(actor, target)) throw forbidden('You can only manage people who report to you');
}
// People whose schedules `actor` may see.
function visibleUsers(actor, department) {
  let rows;
  if (actor.role === 'hr_admin') rows = db.all('SELECT * FROM users WHERE active=1 ORDER BY name');
  else if (actor.role === 'manager') rows = db.all('SELECT * FROM users WHERE active=1 AND (department=? OR manager_id=? OR id=?) ORDER BY name', actor.department, actor.id, actor.id);
  else rows = db.all('SELECT * FROM users WHERE active=1 AND department=? ORDER BY name', actor.department);
  if (department) rows = rows.filter((u) => u.department === department);
  return rows;
}
// People `actor` manages: direct reports (managers) or everyone (HR).
function teamOf(actor) {
  if (actor.role === 'hr_admin') return db.all('SELECT * FROM users WHERE active=1 AND id<>? ORDER BY name', actor.id);
  if (actor.role === 'manager') return db.all('SELECT * FROM users WHERE active=1 AND manager_id=? ORDER BY name', actor.id);
  return [];
}
const isApprover = (u) => u.role === 'manager' || u.role === 'hr_admin';
function requireApprover(u) {
  if (!isApprover(u)) throw forbidden('Managers or HR only');
}
function requireHr(u) {
  if (u.role !== 'hr_admin') throw forbidden('HR administrators only');
}
const slim = (u) => u && { id: u.id, name: u.name, title: u.title, department: u.department, role: u.role };

module.exports = {
  audit, notify, getUser, requireUser, hrAdmins, approversFor, canDecide, canManage, requireManage,
  visibleUsers, teamOf, isApprover, requireApprover, requireHr, slim,
};
