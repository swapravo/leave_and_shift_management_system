import {
  h, get, post, qs, state, openModal, toast, refresh, fmtDay, fmtFull, fmtRange, fmtShort, addDays, chip, badge, num, days, progress, empty,
} from '../core.js';

export const timeRange = (s) => `${s.start_time}-${s.end_time}`;
export const shiftName = (s) => s.label || s.type_name || 'Shift';

export function balanceCards(balances) {
  const shown = balances.filter((b) => b.total > 0 || b.used || b.pending || b.allow_negative);
  if (!shown.length) return empty('No leave entitlements', 'HR has not assigned any leave types yet.');
  return h`<div class="grid cards">${shown.map((b) => h`
    <div class="card bal">
      <div class="row between"><strong>${b.name}</strong>${chip(b.paid ? 'Paid' : 'Unpaid', b.color)}</div>
      <div class="big">${num(b.available)}<small> day${b.available === 1 ? '' : 's'} available</small></div>
      ${progress(b.used, b.pending, b.total || 1, b.color)}
      <div class="muted small">${num(b.used)} used${b.pending ? `, ${num(b.pending)} pending` : ''} of ${num(b.total)}${b.carried_over ? ` (incl. ${num(b.carried_over)} carried over)` : ''}</div>
    </div>`)}</div>`;
}

export async function leaveModal(preType) {
  const { leave_types: types } = await get('/api/leave-types');
  const today = state.today;
  let timer = null;
  let seq = 0;
  openModal({
    title: 'Request leave', submit: 'Submit request',
    body: h`
      <label>Leave type<select name="leave_type_id" required>${types.map((t) => h`<option value="${t.id}" ${t.id === preType ? 'selected' : ''}>${t.name}${t.requires_approval ? '' : ' (no approval needed)'}</option>`)}</select></label>
      <div class="two">
        <label>First day<input type="date" name="start_date" value="${today}" min="${addDays(today, -14)}" required></label>
        <label>Last day<input type="date" name="end_date" value="${today}" min="${addDays(today, -14)}" required></label>
      </div>
      <label class="check"><input type="checkbox" name="half_day"> Half day (single day only)</label>
      <label>Reason <small>(optional)</small><textarea name="reason" rows="2" maxlength="500"></textarea></label>
      <div id="lv-preview" class="preview" aria-live="polite"></div>`,
    onSubmit: async (v, { close }) => {
      const r = await post('/api/leave-requests', { leave_type_id: Number(v.leave_type_id), start_date: v.start_date, end_date: v.end_date, half_day: v.half_day, reason: v.reason });
      close();
      toast(r.request.status === 'approved' ? 'Leave recorded and approved' : 'Leave request submitted for approval');
      await refresh();
    },
    onOpen: (d) => {
      const f = d.querySelector('form');
      const btn = f.querySelector('button[type=submit]');
      const pv = d.querySelector('#lv-preview');
      const update = async () => {
        const mine = ++seq;
        const { leave_type_id, start_date, end_date, half_day } = f;
        half_day.disabled = start_date.value !== end_date.value;
        if (half_day.disabled) half_day.checked = false;
        if (!start_date.value || !end_date.value) { pv.innerHTML = ''; return; }
        try {
          const r = await post('/api/leave-requests/preview', { leave_type_id: Number(leave_type_id.value), start_date: start_date.value, end_date: end_date.value, half_day: half_day.checked });
          if (mine !== seq) return;
          btn.disabled = r.errors.length > 0;
          pv.innerHTML = h`${r.errors.map((e) => h`<p class="msg bad">${e}</p>`)}
            ${!r.errors.length ? h`<p class="msg ok"><strong>${days(r.days)}</strong> will be deducted${r.balance ? r.balance.map((b) => h` - ${b.year}: ${num(b.available)} available, ${num(b.after)} after`) : ''}</p>` : ''}
            ${r.warnings.map((w) => h`<p class="msg warn">${w}</p>`)}`.s;
        } catch (e) { pv.innerHTML = h`<p class="msg bad">${e.message}</p>`.s; }
      };
      const debounced = (ev) => {
        if (ev && ev.target === f.start_date && f.end_date.value < f.start_date.value) f.end_date.value = f.start_date.value;
        clearTimeout(timer);
        timer = setTimeout(update, 200);
      };
      f.addEventListener('input', debounced);
      f.addEventListener('change', debounced);
      update();
    },
  });
}

export async function swapModal(prefShiftId) {
  const from = addDays(state.today, 1);
  const { shifts } = await get(`/api/shifts${qs({ from, to: addDays(from, 45) })}`);
  if (!shifts.length) { toast('You have no upcoming shifts that can be swapped', 'bad'); return; }
  let opts = null;
  openModal({
    title: 'Request a shift swap', submit: 'Send request', wide: true,
    body: h`
      <label>Your shift<select name="my_shift_id" required>${shifts.map((s) => h`<option value="${s.id}" ${s.id === prefShiftId ? 'selected' : ''}>${fmtDay(s.date)}, ${s.start_time}-${s.end_time}${s.label || s.type_name ? ` (${s.label || s.type_name})` : ''}</option>`)}</select></label>
      <div id="sw-body"><p class="muted">Loading teammates...</p></div>
      <label>Message <small>(optional)</small><textarea name="message" rows="2" maxlength="300" placeholder="Why do you need the change?"></textarea></label>`,
    onSubmit: async (v, { close }) => {
      if (!v.target_id) throw new Error('Choose a teammate');
      if (v.choice === undefined) throw new Error('Choose what you would like in return');
      await post('/api/swaps', { my_shift_id: Number(v.my_shift_id), target_id: Number(v.target_id), target_shift_id: v.choice === 'cover' ? null : Number(v.choice), message: v.message });
      close();
      toast('Swap request sent');
      await refresh();
    },
    onOpen: (d) => {
      const f = d.querySelector('form');
      const body = d.querySelector('#sw-body');
      const drawShifts = () => {
        const mate = opts.colleagues.find((c) => String(c.user.id) === f.target_id.value);
        const box = d.querySelector('#sw-choices');
        if (!mate) { box.innerHTML = ''; return; }
        box.innerHTML = h`<fieldset><legend>What do you want in return from ${mate.user.name}?</legend>
          <label class="radio ${mate.can_cover ? '' : 'off'}"><input type="radio" name="choice" value="cover" ${mate.can_cover ? '' : 'disabled'}> Just cover my shift <small>${mate.can_cover ? '' : mate.cover_reason}</small></label>
          ${mate.shifts.map((s) => h`<label class="radio ${s.feasible ? '' : 'off'}"><input type="radio" name="choice" value="${s.id}" ${s.feasible ? '' : 'disabled'}> Swap for ${fmtDay(s.date)}, ${s.start_time}-${s.end_time}${s.label ? ` (${s.label})` : ''} <small>${s.feasible ? '' : s.reason}</small></label>`)}
          ${mate.shifts.length ? '' : h`<p class="muted small">${mate.user.name} has no upcoming shifts to swap with.</p>`}</fieldset>`.s;
      };
      const load = async () => {
        body.innerHTML = '<p class="muted">Loading teammates...</p>';
        try {
          opts = await get(`/api/swap-options?shift_id=${f.my_shift_id.value}`);
        } catch (e) { body.innerHTML = h`<p class="msg bad">${e.message}</p>`.s; return; }
        if (!opts.colleagues.length) { body.innerHTML = '<p class="msg warn">You have no teammates in your department to swap with.</p>'; return; }
        body.innerHTML = h`<label>Swap with<select name="target_id" required><option value="">Choose a teammate...</option>${opts.colleagues.map((c) => h`<option value="${c.user.id}">${c.user.name}</option>`)}</select></label><div id="sw-choices"></div>`.s;
        f.target_id.addEventListener('change', drawShifts);
      };
      f.my_shift_id.addEventListener('change', load);
      load();
    },
  });
}

export function swapSummary(w) {
  const a = `${fmtDay(w.r_date)} ${w.r_start}-${w.r_end}`;
  const b = w.t_date ? `${fmtDay(w.t_date)} ${w.t_start}-${w.t_end}` : null;
  return b
    ? h`<strong>${w.requester_name}</strong> gives <span class="mono">${a}</span> and takes <span class="mono">${b}</span> from <strong>${w.target_name}</strong>`
    : h`<strong>${w.target_name}</strong> covers <span class="mono">${a}</span> for <strong>${w.requester_name}</strong>`;
}

export function leaveLine(r) {
  return h`${chip(r.type_name, r.type_color)} <strong>${fmtRange(r.start_date, r.end_date)}</strong> <span class="muted">(${days(r.days)})</span> ${badge(r.status)}`;
}
