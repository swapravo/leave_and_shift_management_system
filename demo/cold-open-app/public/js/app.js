import {
  h, raw, state, hooks, actions, forms, install, get, post, toast, openModal, closeModal, setUnauthorizedHandler,
  isManager, isHr, roleLabel, avatar, ago, busy, esc, empty,
} from './core.js';
import * as home from './pages/home.js';
import * as leave from './pages/leave.js';
import * as balances from './pages/balances.js';
import * as roster from './pages/roster.js';
import * as swaps from './pages/swaps.js';
import * as calendar from './pages/calendar.js';
import * as approvals from './pages/approvals.js';
import * as manager from './pages/manager.js';
import * as team from './pages/team.js';
import * as admin from './pages/admin.js';
import * as audit from './pages/audit.js';
import * as notifications from './pages/notifications.js';

const ROUTES = {
  '/': { title: 'Home', page: home },
  '/leave': { title: 'My leave', page: leave },
  '/balances': { title: 'Leave balances', page: balances },
  '/roster': { title: 'Shift roster', page: roster },
  '/swaps': { title: 'Shift swaps', page: swaps },
  '/calendar': { title: 'Team calendar', page: calendar },
  '/notifications': { title: 'Notifications', page: notifications },
  '/manager': { title: 'Manager dashboard', page: manager, need: isManager },
  '/approvals': { title: 'Approvals', page: approvals, need: isManager },
  '/team': { title: 'My team', page: team, need: isManager },
  '/admin': { title: 'HR setup', page: admin, need: isHr },
  '/audit': { title: 'Audit log', page: audit, need: isHr },
};

const ICONS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  leave: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h3',
  balance: 'M12 3v18M5 7h10a3 3 0 0 1 0 6H7a3 3 0 0 0 0 6h12',
  roster: 'M4 5h16M4 10h16M4 15h10M4 20h6',
  swap: 'M7 7h13l-3-3M17 17H4l3 3',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2',
  dash: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  check: 'M5 12l5 5 9-10',
  team: 'M16 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM4 20a7 7 0 0 1 14 0M19 8a3 3 0 0 1 0 5',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z',
  audit: 'M9 3h6l4 4v14H5V3zM14 3v5h5M8 13h8M8 17h6',
  bell: 'M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5zM10 20a2 2 0 0 0 4 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
};
const icon = (n) => h`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

function navItems() {
  const items = [
    ['/', 'Home', 'home'], ['/leave', 'My leave', 'leave'], ['/balances', 'Balances', 'balance'],
    ['/roster', 'Shift roster', 'roster'], ['/swaps', 'Shift swaps', 'swap', 'incoming'], ['/calendar', 'Team calendar', 'calendar'],
  ];
  const mgr = [['/manager', 'Manager dashboard', 'dash'], ['/approvals', 'Approvals', 'check', 'approvals'], ['/team', 'My team', 'team']];
  const hr = [['/admin', 'HR setup', 'admin'], ['/audit', 'Audit log', 'audit']];
  return { items, mgr: isManager() ? mgr : [], hr: isHr() ? hr : [] };
}
const navLink = ([path, label, ic, badgeKey]) => h`<a href="#${path}" data-path="${path}">${icon(ic)}<span>${label}</span>${badgeKey && state[badgeKey] ? h`<b class="count" data-badge="${badgeKey}">${state[badgeKey]}</b>` : ''}</a>`;

let current = '/';
let renderToken = 0;

function shell() {
  const n = navItems();
  document.getElementById('app').innerHTML = h`
    <div class="layout">
      <aside class="sidebar" id="sidebar">
        <div class="brand"><span class="logo" aria-hidden="true"></span><span>Leave &amp; Shift</span></div>
        <nav aria-label="Main">
          ${n.items.map(navLink)}
          ${n.mgr.length ? h`<div class="nav-group">Manage</div>${n.mgr.map(navLink)}` : ''}
          ${n.hr.length ? h`<div class="nav-group">Administration</div>${n.hr.map(navLink)}` : ''}
        </nav>
        <div class="side-user">
          ${avatar(state.user.name)}
          <div><strong>${state.user.name}</strong><small>${roleLabel(state.user.role)} - ${state.user.department}</small></div>
        </div>
      </aside>
      <div class="scrim" data-act="nav-toggle"></div>
      <div class="content">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-act="nav-toggle" aria-label="Toggle menu">${icon('menu')}</button>
          <h1 id="page-title"></h1>
          <div class="spacer"></div>
          <div class="bell-wrap">
            <button class="icon-btn" id="bell" data-act="bell" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">${icon('bell')}<b class="count bell-count" id="bell-count" hidden></b></button>
            <div class="popover" id="bell-pop" hidden></div>
          </div>
          <div class="user-wrap">
            <button class="btn ghost" data-act="user-menu" aria-haspopup="true" aria-expanded="false">${avatar(state.user.name)}<span class="hide-sm">${state.user.name}</span></button>
            <div class="popover small" id="user-pop" hidden>
              <div class="pop-head"><strong>${state.user.name}</strong><small>${state.user.email}</small></div>
              <button class="pop-item" data-act="change-password">Change password</button>
              <button class="pop-item" data-act="logout">Sign out</button>
            </div>
          </div>
        </header>
        <main id="main" tabindex="-1"></main>
      </div>
    </div>`.s;
  updateBadges();
}

function updateBadges() {
  const bc = document.getElementById('bell-count');
  if (bc) { bc.hidden = !state.unread; bc.textContent = state.unread > 99 ? '99+' : state.unread; }
  for (const key of ['incoming', 'approvals']) {
    const a = document.querySelector(`nav a[data-path="${key === 'incoming' ? '/swaps' : '/approvals'}"]`);
    if (!a) continue;
    let b = a.querySelector('.count');
    if (state[key]) {
      if (!b) { b = document.createElement('b'); b.className = 'count'; a.appendChild(b); }
      b.textContent = state[key];
    } else if (b) b.remove();
  }
}

export async function refreshMe() {
  try {
    const r = await get('/api/me');
    Object.assign(state, { user: r.user, today: r.today, unread: r.unread, approvals: r.approvals, incoming: r.incoming_swaps });
    updateBadges();
  } catch { /* handled by 401 hook */ }
}

export async function render() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const path = hash.split('?')[0];
  const route = ROUTES[path] || ROUTES['/'];
  current = ROUTES[path] ? path : '/';
  const token = ++renderToken;
  document.getElementById('page-title').textContent = route.title;
  document.title = `${route.title} - Leave & Shift`;
  document.querySelectorAll('nav a').forEach((a) => {
    if (a.dataset.path === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.getElementById('sidebar').classList.remove('open');
  const main = document.getElementById('main');
  if (route.need && !route.need()) {
    main.innerHTML = empty('Not available', 'You do not have access to this page.').s;
    return;
  }
  const scroll = main.dataset.path === current ? window.scrollY : 0;
  if (main.dataset.path !== current) main.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const out = await route.page.render(hash.includes('?') ? new URLSearchParams(hash.split('?')[1]) : new URLSearchParams());
    if (token !== renderToken) return;
    main.innerHTML = out.s;
    main.dataset.path = current;
    if (route.page.mount) route.page.mount(main);
    window.scrollTo(0, scroll);
  } catch (e) {
    if (token !== renderToken) return;
    main.innerHTML = h`<div class="empty"><strong>Could not load this page</strong><p>${e.message}</p><button class="btn" data-act="reload">Try again</button></div>`.s;
  }
}

// ---------------------------------------------------------------- login
function loginView(message = '') {
  document.getElementById('app').innerHTML = h`
    <div class="login-wrap">
      <form class="card login" data-form="login" autocomplete="on">
        <div class="brand big"><span class="logo" aria-hidden="true"></span><span>Leave &amp; Shift</span></div>
        <h1>Sign in</h1>
        ${message ? h`<p class="form-error" role="alert">${message}</p>` : ''}
        <label>Email<input name="email" type="email" required autocomplete="username" autofocus></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn primary block" type="submit">Sign in</button>
        <details class="demo">
          <summary>Demo accounts</summary>
          <p>All use the password <code>password123</code>. Click one to fill the form.</p>
          <div class="demo-list">
            ${[['helen.park@example.com', 'Helen Park', 'HR admin'], ['maria.santos@example.com', 'Maria Santos', 'Manager, Support'], ['daniel.okafor@example.com', 'Daniel Okafor', 'Manager, Operations'], ['aisha.khan@example.com', 'Aisha Khan', 'Employee, Support'], ['farid.hassan@example.com', 'Farid Hassan', 'Employee, Operations']]
              .map(([e, n, r]) => h`<button type="button" class="demo-btn" data-act="demo-login" data-email="${e}"><strong>${n}</strong><small>${r}</small></button>`)}
          </div>
        </details>
      </form>
    </div>`.s;
}
actions['demo-login'] = (el) => {
  const f = document.querySelector('[data-form=login]');
  f.email.value = el.dataset.email;
  f.password.value = 'password123';
  f.querySelector('button[type=submit]').focus();
};
forms.login = async (f, v) => {
  const btn = f.querySelector('button[type=submit]');
  await busy(btn, async () => {
    try { await post('/api/login', { email: v.email, password: v.password }); } catch (e) { loginView(e.message); return; }
    await start();
  });
};

// ---------------------------------------------------------------- popovers & misc actions
function closePops() {
  document.querySelectorAll('.popover').forEach((p) => { p.hidden = true; });
  document.querySelectorAll('[aria-haspopup]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
document.addEventListener('click', (e) => { if (!e.target.closest('.bell-wrap, .user-wrap')) closePops(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePops(); });

actions['nav-toggle'] = () => document.getElementById('sidebar').classList.toggle('open');
actions.reload = () => render();
actions['user-menu'] = (btn) => {
  const pop = document.getElementById('user-pop');
  const show = pop.hidden;
  closePops();
  pop.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
};
actions.logout = async () => {
  try { await post('/api/logout'); } catch { /* ignore */ }
  state.user = null;
  location.hash = '#/';
  loginView();
};
actions['change-password'] = () => {
  closePops();
  openModal({
    title: 'Change password',
    body: h`<label>Current password<input type="password" name="current" required autocomplete="current-password"></label>
      <label>New password<input type="password" name="password" required minlength="8" autocomplete="new-password"><small>At least 8 characters</small></label>`,
    submit: 'Update password',
    onSubmit: async (v, { close }) => { await post('/api/me/password', v); close(); toast('Password updated'); },
  });
};
actions.bell = async (btn) => {
  const pop = document.getElementById('bell-pop');
  const show = pop.hidden;
  closePops();
  if (!show) return;
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  pop.innerHTML = '<div class="pop-empty">Loading...</div>';
  try {
    const r = await get('/api/notifications?limit=8');
    state.unread = r.unread;
    updateBadges();
    pop.innerHTML = h`<div class="pop-head row"><strong>Notifications</strong>
        <button class="link" data-act="notif-read-all">Mark all read</button></div>
      ${r.notifications.length ? r.notifications.map((n) => h`<button class="notif ${n.read ? '' : 'unread'}" data-act="notif-open" data-id="${n.id}" data-link="${n.link || ''}">
        <strong>${n.title}</strong><span>${n.body || ''}</span><small>${ago(n.created_at)}</small></button>`) : h`<div class="pop-empty">You are all caught up.</div>`}
      <a class="pop-foot" href="#/notifications">View all</a>`.s;
  } catch (e) { pop.innerHTML = h`<div class="pop-empty">${e.message}</div>`.s; }
};
actions['notif-open'] = async (el) => {
  try { await post(`/api/notifications/${el.dataset.id}/read`); } catch { /* ignore */ }
  closePops();
  await refreshMe();
  if (el.dataset.link) { if (location.hash === el.dataset.link) render(); else location.hash = el.dataset.link; }
};
actions['notif-read-all'] = async () => {
  await post('/api/notifications/read-all');
  closePops();
  await refreshMe();
  if (current === '/notifications') render();
};

// ---------------------------------------------------------------- boot
let pollTimer = null;
async function start() {
  try {
    if (!(await get('/api/session')).authenticated) return loginView();
    const r = await get('/api/me');
    Object.assign(state, { user: r.user, today: r.today, unread: r.unread, approvals: r.approvals, incoming: r.incoming_swaps });
  } catch { return loginView(); }
  shell();
  await render();
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (state.user && !document.hidden) refreshMe(); }, 30000);
}
hooks.render = render;
hooks.me = refreshMe;
setUnauthorizedHandler(() => {
  if (!state.user) return;
  state.user = null;
  closeModal();
  loginView('Your session has expired. Please sign in again.');
});
window.addEventListener('hashchange', () => { if (state.user) render(); });
install();
start();
