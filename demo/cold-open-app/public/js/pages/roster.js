import {
  h, get, post, put, del, qs, state, actions, openModal, closeModal, confirmBox, toast, refresh, busy,
  fmtDay, fmtShort, fmtFull, addDays, mondayOf, dowOf, shiftHours, num, avatar, isManager, isHr, empty,
} from '../core.js';
import { swapModal, timeRange, shiftName } from './shared.js';

let start = null;
let dept = '';
let data = null;
let shiftTypes = null;

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

actions['roster-prev'] = () => { start = addDays(start, -7); refresh(); };
actions['roster-next'] = () => { start = addDays(start, 7); refresh(); };
actions['roster-today'] = () => { start = mondayOf(state.today); refresh(); };
actions['roster-dept'] = (el) => { dept = el.value; refresh(); };

actions['shift-open'] = (el) => {
  const s = data.shifts.find((x) => String(x.id) === el.dataset.id);
  if (!s) return;
  const person = data.users.find((u) => u.id === s.user_id);
  const own = s.user_id === state.user.id;
  const future = s.date >= state.today;
  openModal({
    title: `${person.name} - ${fmtDay(s.date)}`, hideFooter: true,
    body: h`<dl class="kv"><dt>Time</dt><dd class="mono">${timeRange(s)} (${num(shiftHours(s))} h)</dd><dt>Type</dt><dd>${shiftName(s)}</dd>
      ${s.notes ? h`<dt>Notes</dt><dd>${s.notes}</dd>` : ''}</dl>
      <div class="row gap end">
        ${person.can_manage && future ? h`<button type="button" class="btn danger" data-act="shift-cancel" data-id="${s.id}">Cancel shift</button><button type="button" class="btn primary" data-act="shift-edit" data-id="${s.id}">Edit</button>` : ''}
        ${own && s.date > state.today ? h`<button type="button" class="btn primary" data-act="shift-swap" data-id="${s.id}">Request swap</button>` : ''}
        <button type="button" class="btn" data-act="modal-close">Close</button>
      </div>`,
  });
};
actions['shift-swap'] = (el) => { closeModal(); swapModal(Number(el.dataset.id)); };
actions['shift-cancel'] = async (el) => {
  const s = data.shifts.find((x) => String(x.id) === el.dataset.id);
  closeModal();
  const ok = await confirmBox({ title: 'Cancel this shift?', message: `The shift on ${fmtDay(s.date)} (${timeRange(s)}) will be removed and the employee notified.`, confirm: 'Cancel shift', danger: true });
  if (!ok) return;
  await busy(null, async () => { await del(`/api/shifts/${s.id}`, {}); toast('Shift cancelled'); await refresh(); });
};

async function loadTypes() {
  if (!shiftTypes) shiftTypes = (await get('/api/shift-types')).shift_types;
  return shiftTypes;
}
async function shiftForm(existing, prefUser, prefDate) {
  const types = await loadTypes();
  const people = data.users.filter((u) => u.can_manage);
  const s = existing || { user_id: prefUser, date: prefDate, shift_type_id: types[0] && types[0].id, start_time: types[0] ? types[0].start_time : '09:00', end_time: types[0] ? types[0].end_time : '17:00', label: '', notes: '' };
  openModal({
    title: existing ? 'Edit shift' : 'Add shift', submit: existing ? 'Save changes' : 'Add shift',
    body: h`
      <div class="two">
        <label>Person<select name="user_id" required>${people.map((u) => h`<option value="${u.id}" ${u.id === s.user_id ? 'selected' : ''}>${u.name}</option>`)}</select></label>
        <label>Date<input type="date" name="date" value="${s.date}" min="${state.today}" required></label>
      </div>
      <label>Shift type<select name="shift_type_id"><option value="">Custom times</option>${types.map((t) => h`<option value="${t.id}" data-s="${t.start_time}" data-e="${t.end_time}" ${t.id === s.shift_type_id ? 'selected' : ''}>${t.name} (${t.start_time}-${t.end_time})</option>`)}</select></label>
      <div class="two">
        <label>Starts<input type="time" name="start_time" value="${s.start_time}" required></label>
        <label>Ends<input type="time" name="end_time" value="${s.end_time}" required><small>An end before the start means the shift finishes the next day.</small></label>
      </div>
      <label>Label <small>(optional)</small><input name="label" maxlength="60" value="${s.label || ''}" placeholder="e.g. Front desk"></label>
      <label>Notes <small>(optional)</small><input name="notes" maxlength="300" value="${s.notes || ''}"></label>`,
    onOpen: (d) => {
      const f = d.querySelector('form');
      f.shift_type_id.addEventListener('change', () => {
        const o = f.shift_type_id.selectedOptions[0];
        if (o && o.dataset.s) { f.start_time.value = o.dataset.s; f.end_time.value = o.dataset.e; }
      });
    },
    onSubmit: async (v, { close }) => {
      const body = { user_id: Number(v.user_id), date: v.date, shift_type_id: v.shift_type_id ? Number(v.shift_type_id) : null, start_time: v.start_time, end_time: v.end_time, label: v.label, notes: v.notes };
      if (existing) await put(`/api/shifts/${existing.id}`, body); else await post('/api/shifts', body);
      close(); toast(existing ? 'Shift updated' : 'Shift added'); await refresh();
    },
  });
}
actions['shift-add'] = (el) => shiftForm(null, Number(el.dataset.user), el.dataset.date);
actions['shift-edit'] = (el) => { const s = data.shifts.find((x) => String(x.id) === el.dataset.id); closeModal(); shiftForm(s); };

actions['roster-copy'] = () => {
  openModal({
    title: 'Copy a week of shifts', submit: 'Copy shifts',
    body: h`<p class="muted">Copies every scheduled shift for the people you manage. Anything that clashes with leave or rest rules is skipped.</p>
      <div class="two"><label>Copy from the week of<input type="date" name="from_start" value="${start}" required></label>
      <label>Into the week of<input type="date" name="to_start" value="${addDays(start, 7)}" required></label></div>`,
    onSubmit: async (v, { close }) => {
      const r = await post('/api/shifts/copy-week', v);
      close();
      toast(`Created ${r.created} shift${r.created === 1 ? '' : 's'}${r.skipped.length ? `, skipped ${r.skipped.length}` : ''}`);
      if (r.skipped.length) openModal({ title: 'Some shifts were skipped', hideFooter: true, body: h`<ul class="plain">${r.skipped.slice(0, 40).map((x) => h`<li>${x}</li>`)}</ul><div class="row end"><button type="button" class="btn" data-act="modal-close">Close</button></div>` });
      if (v.to_start) start = mondayOf(v.to_start);
      await refresh();
    },
  });
};

export async function render() {
  if (!start) start = mondayOf(state.today);
  data = await get(`/api/roster${qs({ start, department: dept })}`);
  const dates = data.dates;
  const byCell = (uid, date) => data.shifts.filter((s) => s.user_id === uid && s.date === date);
  const leaveCell = (uid, date) => data.leave.filter((l) => l.user_id === uid && l.date === date);
  const hol = new Map(data.holidays.map((x) => [x.date, x.name]));
  const hours = (uid) => data.shifts.filter((s) => s.user_id === uid).reduce((t, s) => t + shiftHours(s), 0);
  const canAdd = isManager();
  return h`
    <div class="toolbar">
      <div class="row gap"><button class="btn" data-act="roster-prev" aria-label="Previous week">&larr;</button><button class="btn" data-act="roster-today">This week</button><button class="btn" data-act="roster-next" aria-label="Next week">&rarr;</button></div>
      <strong class="range">${fmtShort(data.start)} - ${fmtFull(data.end)}</strong>
      <div class="spacer"></div>
      ${data.departments.length ? h`<label class="inline">Department <select data-change="roster-dept"><option value="">All</option>${data.departments.map((d) => h`<option ${d === dept ? 'selected' : ''}>${d}</option>`)}</select></label>` : ''}
      ${canAdd ? h`<button class="btn" data-act="roster-copy">Copy week...</button>` : ''}
    </div>
    ${data.users.length ? h`<div class="table-wrap roster-wrap"><table class="roster">
      <thead><tr><th class="sticky">Team</th>${dates.map((d) => h`<th class="${d === data.today ? 'today' : ''} ${dowOf(d) % 6 === 0 ? 'weekend' : ''}">${DOW[dowOf(d)]} <span>${fmtShort(d)}</span>${hol.has(d) ? h`<em class="hol">${hol.get(d)}</em>` : ''}</th>`)}<th class="num">Hours</th></tr></thead>
      <tbody>${data.users.map((u) => h`<tr class="${u.id === state.user.id ? 'me' : ''}">
        <th class="sticky" scope="row"><div class="person">${avatar(u.name)}<div><strong>${u.name}</strong><small>${u.title || u.department}</small></div></div></th>
        ${dates.map((d) => h`<td class="${d === data.today ? 'today' : ''} ${dowOf(d) % 6 === 0 ? 'weekend' : ''} ${hol.has(d) ? 'holiday' : ''}">
          ${leaveCell(u.id, d).map((l) => h`<div class="leave-chip ${l.status}" style="--c:${l.color}" title="${l.type_name}${l.status === 'pending' ? ' (pending)' : ''}">${l.type_name}${l.amount < 1 ? ' (half)' : ''}${l.status === 'pending' ? '?' : ''}</div>`)}
          ${byCell(u.id, d).map((s) => h`<button class="shift-chip" style="--c:${s.color || '#6366f1'}" data-act="shift-open" data-id="${s.id}" aria-label="${u.name}, ${fmtDay(d)}, ${timeRange(s)}"><b>${timeRange(s)}</b><span>${shiftName(s)}</span></button>`)}
          ${u.can_manage && d >= data.today ? h`<button class="add-chip" data-act="shift-add" data-user="${u.id}" data-date="${d}" aria-label="Add shift for ${u.name} on ${fmtDay(d)}">+</button>` : ''}
        </td>`)}
        <td class="num">${num(hours(u.id))}</td></tr>`)}</tbody></table></div>
      <p class="muted small">Dashed boxes are leave. ${canAdd ? 'Use + to add a shift or click a shift to edit it.' : 'Click one of your shifts to request a swap.'}</p>` : empty('Nobody to show', 'There are no active people in this view.')}`;
}
