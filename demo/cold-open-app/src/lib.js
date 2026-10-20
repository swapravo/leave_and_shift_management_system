'use strict';
// Shared helpers: errors, validation, date maths.

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const bad = (m, field) => new HttpError(400, m, field ? { field } : {});
const forbidden = (m = 'You do not have permission to do that') => new HttpError(403, m);
const notFound = (m = 'Not found') => new HttpError(404, m);
const conflict = (m, extra) => new HttpError(409, m, extra || {});

// ---- dates (all dates are 'YYYY-MM-DD' strings, computed in UTC to avoid DST drift)
const DAY_MS = 86400000;
function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
const fmtDate = (dt) => dt.toISOString().slice(0, 10);
const addDays = (s, n) => fmtDate(new Date(parseDate(s).getTime() + n * DAY_MS));
const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
const dow = (s) => parseDate(s).getUTCDay(); // 0=Sun
const isWeekend = (s) => dow(s) === 0 || dow(s) === 6;
function eachDay(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
function today() {
  if (process.env.APP_TODAY) return process.env.APP_TODAY;
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}
function mondayOf(s) {
  const w = dow(s);
  return addDays(s, w === 0 ? -6 : 1 - w);
}
const nowIso = () => new Date().toISOString();

// ---- validation
function str(v, field, { min = 0, max = 500, required = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`, field);
    return null;
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`, field);
  const t = v.trim();
  if (required && t.length === 0) throw bad(`${field} is required`, field);
  if (t.length < min) throw bad(`${field} must be at least ${min} characters`, field);
  if (t.length > max) throw bad(`${field} must be at most ${max} characters`, field);
  return t.length ? t : null;
}
function num(v, field, { min = -Infinity, max = Infinity, required = true, step } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`, field);
    return null;
  }
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw bad(`${field} must be a number`, field);
  if (n < min || n > max) throw bad(`${field} must be between ${min} and ${max}`, field);
  if (step && Math.abs(n / step - Math.round(n / step)) > 1e-9) throw bad(`${field} must be a multiple of ${step}`, field);
  return n;
}
function int(v, field, opts = {}) {
  const n = num(v, field, opts);
  if (n !== null && !Number.isInteger(n)) throw bad(`${field} must be a whole number`, field);
  return n;
}
function date(v, field, required = true) {
  if ((v === undefined || v === null || v === '') && !required) return null;
  if (!parseDate(v)) throw bad(`${field} must be a valid date (YYYY-MM-DD)`, field);
  return v;
}
function time(v, field) {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad(`${field} must be a time (HH:MM)`, field);
  return v;
}
function oneOf(v, field, list, required = true) {
  if ((v === undefined || v === null || v === '') && !required) return null;
  if (!list.includes(v)) throw bad(`${field} must be one of: ${list.join(', ')}`, field);
  return v;
}
function bool(v) {
  return v === true || v === 1 || v === 'true' || v === '1';
}
function color(v, field = 'color') {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) throw bad(`${field} must be a hex colour like #3b82f6`, field);
  return v.toLowerCase();
}
const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const round2 = (n) => Math.round(n * 100) / 100;

module.exports = {
  HttpError, bad, forbidden, notFound, conflict,
  parseDate, fmtDate, addDays, diffDays, dow, isWeekend, eachDay, today, mondayOf, nowIso,
  str, num, int, date, time, oneOf, bool, color, toMinutes, round2,
};
