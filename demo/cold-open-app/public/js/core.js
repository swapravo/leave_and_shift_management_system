// Shared front-end helpers: safe HTML templating, API client, dialogs, formatting.

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
function part(v) {
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
}
// Tagged template: every interpolated value is HTML-escaped unless it came from another h`` call.
export function h(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Safe(out);
}

export const state = { user: null, today: '', unread: 0, approvals: 0, incoming: 0 };
export const hooks = { render: async () => {}, me: async () => {} };
// re-render the current page (and refresh badge counts) after a mutation
export const refresh = async () => { await hooks.me(); await hooks.render(); };
export const actions = {};   // data-act handlers, registered by pages
export const forms = {};     // data-form handlers

// ---------------------------------------------------------------- API
export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data || {}; }
}
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (f) => { onUnauthorized = f; };
export async function api(method, url, body) {
  const opts = { method, headers: { 'X-Requested-With': 'app' }, credentials: 'same-origin' };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opts); } catch { throw new ApiError('Cannot reach the server. Check your connection.', 0); }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/login')) onUnauthorized();
    throw new ApiError((data.error && data.error.message) || `Request failed (${res.status})`, res.status, data.error);
  }
  return data;
}
export const get = (u) => api('GET', u);
export const post = (u, b = {}) => api('POST', u, b);
export const put = (u, b = {}) => api('PUT', u, b);
export const del = (u, b = {}) => api('DELETE', u, b);
export const qs = (o) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

// ---------------------------------------------------------------- dates
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * 86400000));
export const dowOf = (s) => parse(s).getUTCDay();
export const mondayOf = (s) => addDays(s, dowOf(s) === 0 ? -6 : 1 - dowOf(s));
const fDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fFull = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const fmtDay = (s) => fDay.format(parse(s));
export const fmtFull = (s) => fFull.format(parse(s));
export const fmtShort = (s) => fShort.format(parse(s));
export const fmtMonth = (s) => fMonth.format(parse(`${s.slice(0, 7)}-01`));
export const fmtRange = (a, b) => (a === b ? fmtFull(a) : `${fmtDay(a)} - ${fmtFull(b)}`);
export function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function ago(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtTs(ts);
}
export const num = (n) => (Math.round(n * 100) / 100).toString();
export const days = (n) => `${num(n)} day${n === 1 ? '' : 's'}`;
export function shiftHours(s) {
  const [a, b] = [s.start_time, s.end_time].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
  return ((b <= a ? b + 1440 : b) - a) / 60;
}
export const isManager = () => state.user && (state.user.role === 'manager' || state.user.role === 'hr_admin');
export const isHr = () => state.user && state.user.role === 'hr_admin';
export const roleLabel = (r) => ({ employee: 'Employee', manager: 'Manager', hr_admin: 'HR admin' }[r] || r);

// ---------------------------------------------------------------- small components
export const chip = (name, color) => h`<span class="chip" style="--c:${color || '#64748b'}">${name}</span>`;
const STATUS = {
  pending: ['Pending', 'warn'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'bad'], cancelled: ['Cancelled', 'muted'],
  pending_peer: ['Awaiting teammate', 'warn'], pending_manager: ['Awaiting manager', 'warn'], declined: ['Declined', 'bad'], expired: ['Expired', 'muted'],
};
export const badge = (st) => { const [t, k] = STATUS[st] || [st, 'muted']; return h`<span class="badge ${k}">${t}</span>`; };
export const avatar = (name) => h`<span class="avatar" aria-hidden="true">${name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>`;
export const empty = (title, text = '') => h`<div class="empty"><strong>${title}</strong>${text ? h`<p>${text}</p>` : ''}</div>`;
export const progress = (used, pending, total, color) => {
  const t = Math.max(total, 0.0001);
  const u = Math.min(100, (used / t) * 100);
  const p = Math.min(100 - u, (pending / t) * 100);
  return h`<div class="bar" style="--c:${color}" role="img" aria-label="${num(used)} used, ${num(pending)} pending of ${num(total)}"><i class="u" style="width:${u}%"></i><i class="p" style="width:${p}%"></i></div>`;
};

// ---------------------------------------------------------------- toasts, modal, confirm
export function toast(message, kind = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 7000 : 3500);
}

const dlg = () => document.getElementById('modal');
export function closeModal() { const d = dlg(); if (d.open) d.close(); d.innerHTML = ''; }
// Opens a form dialog. onSubmit(values, api) may throw (message shown inline) or return normally to close.
export function openModal({ title, body, submit = 'Save', cancel = 'Cancel', danger = false, wide = false, onSubmit, onOpen, hideFooter = false }) {
  const d = dlg();
  d.className = wide ? 'wide' : '';
  d.innerHTML = h`<form method="dialog" novalidate id="modal-form">
      <header><h2 id="modal-title">${title}</h2><button type="button" class="icon-btn" data-act="modal-close" aria-label="Close">&times;</button></header>
      <div class="modal-body">${body}</div>
      <p class="form-error" role="alert" hidden></p>
      ${hideFooter ? '' : h`<footer><button type="button" class="btn" data-act="modal-close">${cancel}</button>
      <button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${submit}</button></footer>`}
    </form>`.s;
  const form = d.querySelector('form');
  const errEl = d.querySelector('.form-error');
  const setError = (m) => { errEl.textContent = m || ''; errEl.hidden = !m; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return closeModal();
    const btn = form.querySelector('button[type=submit]');
    if (btn.disabled) return;
    btn.disabled = true;
    setError('');
    try {
      const values = {};
      for (const [k, v] of new FormData(form).entries()) values[k] = v;
      form.querySelectorAll('input[type=checkbox]').forEach((c) => { values[c.name] = c.checked; });
      await onSubmit(values, { close: closeModal, setError, form });
    } catch (err) {
      setError(err.message || 'Something went wrong');
      btn.disabled = false;
    }
  });
  if (!d.open) d.showModal();
  if (onOpen) onOpen(d, { setError, form });
  const first = d.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (first) first.focus();
  return { el: d, setError };
}
export function confirmBox({ title, message, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    openModal({ title, body: h`<p>${message}</p>`, submit: confirm, danger, onSubmit: async (_, { close }) => { done = true; close(); resolve(true); } });
    dlg().addEventListener('close', () => { if (!done && !dlg().open) resolve(false); }, { once: true });
  });
}

// run an async action with a busy button + error toast
export async function busy(btn, fn) {
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { toast(e.message, 'bad'); } finally { if (btn) btn.disabled = false; }
}

export function install() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const fn = actions[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t, e); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = forms[f.dataset.form];
    if (fn) fn(f, Object.fromEntries(new FormData(f).entries()), e);
  });
  document.addEventListener('change', (e) => {
    const t = e.target.closest('[data-change]');
    if (t && actions[t.dataset.change]) actions[t.dataset.change](t, e);
  });
  actions['modal-close'] = () => closeModal();
  dlg().addEventListener('click', (e) => { if (e.target === dlg()) closeModal(); });
}
