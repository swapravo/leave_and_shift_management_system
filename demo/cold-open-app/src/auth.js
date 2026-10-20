'use strict';
const crypto = require('node:crypto');
const db = require('./db');
const { HttpError, nowIso, bad } = require('./lib');

const SESSION_HOURS = 12;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, saltHex, hashHex] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const h = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(h, expected);
  } catch {
    return false;
  }
}
function checkPasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw bad('Password must be at least 8 characters', 'password');
  if (pw.length > 200) throw bad('Password is too long', 'password');
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + SESSION_HOURS * 3600e3).toISOString();
  db.run('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)', sha(token), userId, nowIso(), exp);
  return { token, maxAge: SESSION_HOURS * 3600 };
}
function userForToken(token) {
  if (!token) return null;
  const row = db.get(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    sha(token), nowIso(),
  );
  return row || null;
}
function destroySession(token) {
  if (token) db.run('DELETE FROM sessions WHERE token_hash = ?', sha(token));
}
function destroyUserSessions(userId) {
  db.run('DELETE FROM sessions WHERE user_id = ?', userId);
}
function purgeExpired() {
  db.run('DELETE FROM sessions WHERE expires_at <= ?', nowIso());
}

// Simple brute-force protection: 5 failures per (ip,email) in 10 minutes => locked out.
const fails = new Map();
const WINDOW = 10 * 60e3;
const MAX_FAILS = 5;
function loginKey(ip, email) { return `${ip}|${String(email).toLowerCase()}`; }
function checkLockout(ip, email) {
  const k = loginKey(ip, email);
  const rec = fails.get(k);
  if (rec && Date.now() - rec.first < WINDOW && rec.count >= MAX_FAILS) {
    throw new HttpError(429, 'Too many failed sign-in attempts. Try again in a few minutes.');
  }
}
function recordFail(ip, email) {
  const k = loginKey(ip, email);
  const rec = fails.get(k);
  if (!rec || Date.now() - rec.first >= WINDOW) fails.set(k, { first: Date.now(), count: 1 });
  else rec.count++;
}
function clearFails(ip, email) { fails.delete(loginKey(ip, email)); }

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ip, ...rest } = u;
  return { ...rest, active: !!rest.active };
}

module.exports = {
  hashPassword, verifyPassword, checkPasswordPolicy, createSession, userForToken, destroySession,
  destroyUserSessions, purgeExpired, checkLockout, recordFail, clearFails, publicUser,
};
