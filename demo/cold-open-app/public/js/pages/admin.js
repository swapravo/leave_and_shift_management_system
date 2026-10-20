import {
  h, get, post, put, del, qs, state, actions, openModal, confirmBox, toast, refresh, busy, num, chip, roleLabel, fmtFull, empty,
} from '../core.js';

let tab = 'types';
let holYear = null;
let cache = {};

actions['adm-tab'] = (el) => { tab = el.dataset.tab; refresh(); };

const check = (name, label, on, hint = '') => h`<label class="check"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}> ${label}${hint ? h` <small>${hint}</small>` : ''}</label>`;

// ---------------------------------------------------------------- leave types
function typeForm(t) {
  const x = t || { name: '', code: '', color: '#2563eb', annual_allowance: 20, carry_over_max: 0, paid: true, requires_approval: true, allow_negative: false, active: true };
  openModal({
    title: t ? `Edit ${t.name}` : 'New leave type', submit: t ? 'Save changes' : 'Create leave type',
    body: h`
      <div class="two"><label>Name<input name="name" required maxlength="60" value="${x.name}"></label>
      <label>Code<input name="code" required maxlength="10" value="${x.code}" placeholder="ANNUAL" style="text-transform:uppercase"></label></div>
      <div class="two"><label>Days per year<input type="number" name="annual_allowance" min="0" max="365" step="0.5" required value="${x.annual_allowance}"></label>
      <label>Max carry-over days<input type="number" name="carry_over_max" min="0" max="365" step="0.5" required value="${x.carry_over_max}"></label></div>
      <label>Colour<input type="color" name="color" value="${x.color}"></label>
      ${check('paid', 'Paid leave', x.paid)}
      ${check('requires_approval', 'Requires manager approval', x.requires_approval, '- if off, leave is recorded instantly unless the person is rostered')}
      ${check('allow_negative', 'Allow balance to go below zero', x.allow_negative, '- typical for unpaid leave')}
      ${t ? check('active', 'Active (employees can request it)', x.active) : ''}`,
    onSubmit: async (v, { close }) => {
      const body = { ...v, annual_allowance: Number(v.annual_allowance), carry_over_max: Number(v.carry_over_max) };
      if (t) await put(`/api/leave-types/${t.id}`, body); else await post('/api/leave-types', body);
      close(); toast(t ? 'Leave type updated' : 'Leave type created'); await refresh();
    },
  });
}
actions['type-new'] = () => typeForm(null);
actions['type-edit'] = (el) => typeForm(cache.types.find((t) => String(t.id) === el.dataset.id));
actions['type-delete'] = async (el) => {
  const t = cache.types.find((x) => String(x.id) === el.dataset.id);
  if (!(await confirmBox({ title: `Delete ${t.name}?`, message: 'This only works for leave types that have never been used.', confirm: 'Delete', danger: true }))) return;
  await busy(el, async () => { await del(`/api/leave-types/${t.id}`); toast('Leave type deleted'); await refresh(); });
};

// ---------------------------------------------------------------- users
function userForm(u) {
  const x = u || { name: '', email: '', role: 'employee', department: '', title: '', manager_id: null, hire_date: '', active: true };
  const mgrs = cache.users.filter((m) => m.active && m.role !== 'employee' && (!u || m.id !== u.id));
  const depts = [...new Set(cache.users.map((m) => m.department))];
  openModal({
    title: u ? `Edit ${u.name}` : 'Add person', submit: u ? 'Save changes' : 'Create account',
    body: h`
      <div class="two"><label>Full name<input name="name" required maxlength="80" value="${x.name}"></label>
      <label>Email<input type="email" name="email" required maxlength="120" value="${x.email}"></label></div>
      <div class="two"><label>Role<select name="role">${['employee', 'manager', 'hr_admin'].map((r) => h`<option value="${r}" ${r === x.role ? 'selected' : ''}>${roleLabel(r)}</option>`)}</select></label>
      <label>Department<input name="department" required maxlength="60" list="dept-list" value="${x.department}"><datalist id="dept-list">${depts.map((d) => h`<option value="${d}">`)}</datalist></label></div>
      <div class="two"><label>Job title<input name="title" maxlength="80" value="${x.title || ''}"></label>
      <label>Hire date<input type="date" name="hire_date" value="${x.hire_date || ''}"></label></div>
      <label>Reports to (approver)<select name="manager_id"><option value="">Nobody - HR approves</option>${mgrs.map((m) => h`<option value="${m.id}" ${m.id === x.manager_id ? 'selected' : ''}>${m.name} (${roleLabel(m.role)})</option>`)}</select></label>
      ${u ? check('active', 'Active account', x.active) : h`<label>Initial password<input type="text" name="password" required minlength="8" autocomplete="off"><small>At least 8 characters. Share it securely.</small></label>`}`,
    onSubmit: async (v, { close }) => {
      const body = { ...v, manager_id: v.manager_id ? Number(v.manager_id) : null, hire_date: v.hire_date || null };
      if (u) await put(`/api/users/${u.id}`, body); else await post('/api/users', body);
      close(); toast(u ? 'Person updated' : 'Account created'); await refresh();
    },
  });
}
actions['user-new'] = () => userForm(null);
actions['user-edit'] = (el) => userForm(cache.users.find((u) => String(u.id) === el.dataset.id));
actions['user-reset'] = (el) => {
  const u = cache.users.find((x) => String(x.id) === el.dataset.id);
  openModal({
    title: `Reset password for ${u.name}`, submit: 'Reset password', danger: true,
    body: h`<p class="muted">They will be signed out everywhere.</p><label>New password<input type="text" name="password" required minlength="8" autocomplete="off"></label>`,
    onSubmit: async (v, { close }) => { await post(`/api/users/${u.id}/reset-password`, v); close(); toast('Password reset'); },
  });
};

// ---------------------------------------------------------------- holidays
actions['hol-year'] = (el) => { holYear = Number(el.value); refresh(); };
actions['hol-new'] = () => openModal({
  title: 'Add public holiday', submit: 'Add holiday',
  body: h`<label>Date<input type="date" name="date" required value="${holYear}-01-01"></label><label>Name<input name="name" required maxlength="80"></label>
    <p class="muted small">Holidays are not deducted from leave. Requests that were already submitted keep their original day count.</p>`,
  onSubmit: async (v, { close }) => { await post('/api/holidays', v); close(); toast('Holiday added'); await refresh(); },
});
actions['hol-del'] = async (el) => {
  if (!(await confirmBox({ title: 'Remove this holiday?', message: `${el.dataset.name} will no longer be a public holiday.`, confirm: 'Remove', danger: true }))) return;
  await busy(el, async () => { await del(`/api/holidays/${el.dataset.date}`); toast('Holiday removed'); await refresh(); });
};

// ---------------------------------------------------------------- shift types
function stForm(t) {
  const x = t || { name: '', start_time: '09:00', end_time: '17:00', color: '#10b981', active: true };
  openModal({
    title: t ? `Edit ${t.name}` : 'New shift type', submit: t ? 'Save changes' : 'Create shift type',
    body: h`<label>Name<input name="name" required maxlength="40" value="${x.name}"></label>
      <div class="two"><label>Starts<input type="time" name="start_time" required value="${x.start_time}"></label><label>Ends<input type="time" name="end_time" required value="${x.end_time}"></label></div>
      <label>Colour<input type="color" name="color" value="${x.color}"></label>
      ${t ? check('active', 'Active', x.active) : ''}`,
    onSubmit: async (v, { close }) => {
      if (t) await put(`/api/shift-types/${t.id}`, v); else await post('/api/shift-types', v);
      close(); toast('Saved'); await refresh();
    },
  });
}
actions['st-new'] = () => stForm(null);
actions['st-edit'] = (el) => stForm(cache.shiftTypes.find((t) => String(t.id) === el.dataset.id));
actions['st-del'] = async (el) => {
  const t = cache.shiftTypes.find((x) => String(x.id) === el.dataset.id);
  if (!(await confirmBox({ title: `Delete ${t.name}?`, message: 'Only possible if no shift uses it; otherwise deactivate it.', confirm: 'Delete', danger: true }))) return;
  await busy(el, async () => { await del(`/api/shift-types/${t.id}`); toast('Shift type deleted'); await refresh(); });
};

const yn = (v) => (v ? 'Yes' : 'No');

export async function render() {
  const tabs = [['types', 'Leave types'], ['users', 'People'], ['holidays', 'Public holidays'], ['shifts', 'Shift types']];
  let body;
  if (tab === 'types') {
    cache.types = (await get('/api/leave-types?all=1')).leave_types;
    body = h`<div class="row between wrap"><p class="muted">Define the kinds of leave employees can request and how much they get each year.</p><button class="btn primary" data-act="type-new">New leave type</button></div>
      <div class="table-wrap"><table><thead><tr><th>Type</th><th class="num">Days / year</th><th class="num">Carry-over max</th><th>Paid</th><th>Approval</th><th>Below zero</th><th>Status</th><th></th></tr></thead>
      <tbody>${cache.types.map((t) => h`<tr><td>${chip(t.name, t.color)} <small class="muted">${t.code}</small></td><td class="num">${num(t.annual_allowance)}</td><td class="num">${num(t.carry_over_max)}</td><td>${yn(t.paid)}</td><td>${t.requires_approval ? 'Required' : 'Automatic'}</td><td>${yn(t.allow_negative)}</td>
        <td>${t.active ? h`<span class="badge ok">Active</span>` : h`<span class="badge muted">Inactive</span>`}</td>
        <td class="right"><button class="btn small" data-act="type-edit" data-id="${t.id}">Edit</button> <button class="btn small" data-act="type-delete" data-id="${t.id}">Delete</button></td></tr>`)}</tbody></table></div>`;
  } else if (tab === 'users') {
    cache.users = (await get('/api/users?include_inactive=1')).users;
    body = h`<div class="row between wrap"><p class="muted">Accounts, roles and who approves whom.</p><button class="btn primary" data-act="user-new">Add person</button></div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Reports to</th><th>Status</th><th></th></tr></thead>
      <tbody>${cache.users.map((u) => h`<tr><td><strong>${u.name}</strong><div class="muted small">${u.title || ''}</div></td><td>${u.email}</td><td>${roleLabel(u.role)}</td><td>${u.department}</td><td>${u.manager_name || '-'}</td>
        <td>${u.active ? h`<span class="badge ok">Active</span>` : h`<span class="badge muted">Inactive</span>`}</td>
        <td class="right"><button class="btn small" data-act="user-edit" data-id="${u.id}">Edit</button> <button class="btn small" data-act="user-reset" data-id="${u.id}">Reset password</button></td></tr>`)}</tbody></table></div>`;
  } else if (tab === 'holidays') {
    if (!holYear) holYear = Number(state.today.slice(0, 4));
    const r = await get(`/api/holidays${qs({ year: holYear })}`);
    body = h`<div class="row between wrap"><label class="inline">Year <select data-change="hol-year">${[holYear - 1, holYear, holYear + 1].map((y) => h`<option ${y === holYear ? 'selected' : ''}>${y}</option>`)}</select></label><button class="btn primary" data-act="hol-new">Add holiday</button></div>
      ${r.holidays.length ? h`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Holiday</th><th></th></tr></thead><tbody>${r.holidays.map((x) => h`<tr><td>${fmtFull(x.date)}</td><td>${x.name}</td><td class="right"><button class="btn small" data-act="hol-del" data-date="${x.date}" data-name="${x.name}">Remove</button></td></tr>`)}</tbody></table></div>` : empty(`No holidays in ${holYear}`)}`;
  } else {
    cache.shiftTypes = (await get('/api/shift-types?all=1')).shift_types;
    body = h`<div class="row between wrap"><p class="muted">Templates managers pick from when building the roster. An end time before the start time means the shift runs overnight.</p><button class="btn primary" data-act="st-new">New shift type</button></div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Time</th><th>Status</th><th></th></tr></thead><tbody>${cache.shiftTypes.map((t) => h`<tr><td>${chip(t.name, t.color)}</td><td class="mono">${t.start_time}-${t.end_time}</td><td>${t.active ? h`<span class="badge ok">Active</span>` : h`<span class="badge muted">Inactive</span>`}</td>
        <td class="right"><button class="btn small" data-act="st-edit" data-id="${t.id}">Edit</button> <button class="btn small" data-act="st-del" data-id="${t.id}">Delete</button></td></tr>`)}</tbody></table></div>`;
  }
  return h`<div class="tabs" role="tablist">${tabs.map(([k, l]) => h`<button role="tab" aria-selected="${tab === k}" data-act="adm-tab" data-tab="${k}">${l}</button>`)}</div>${body}`;
}
