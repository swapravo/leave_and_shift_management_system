import { h, get, post, qs, actions, forms, openModal, toast, refresh, confirmBox, busy, state, isManager, isHr, num, chip, empty, progress } from '../core.js';
import { balanceCards } from './shared.js';

let year = null;
let team = null;

actions['bal-year'] = (el) => { year = Number(el.value); refresh(); };
actions['bal-adjust'] = (btn) => {
  const { user, type, name, tname, y } = btn.dataset;
  const t = team.people.find((p) => String(p.user.id) === user).balances.find((b) => String(b.leave_type_id) === type);
  openModal({
    title: `Adjust ${tname} - ${name}`,
    body: h`<p class="muted">${y}: allocated ${num(t.allocated)}${t.custom_allocation ? ' (custom)' : ' (type default)'}, carried over ${num(t.carried_over)}, adjustment ${num(t.adjustment)}, used ${num(t.used)}, pending ${num(t.pending)}. Available: <strong>${num(t.available)}</strong>.</p>
      <div class="two">
        <label>Allocated <small>(blank = default)</small><input name="allocated" type="number" step="0.5" min="0" max="365" value="${t.custom_allocation ? t.allocated : ''}"></label>
        <label>Carried over<input name="carried_over" type="number" step="0.5" min="0" max="365" value="${t.carried_over}"></label>
      </div>
      <label>Manual adjustment <small>(+ or - days)</small><input name="adjustment" type="number" step="0.5" min="-365" max="365" value="${t.adjustment}"></label>
      <label>Reason <small>(recorded in the audit log)</small><input name="reason" required minlength="3" maxlength="300"></label>`,
    submit: 'Save adjustment',
    onSubmit: async (v, { close }) => {
      await post('/api/balances/adjust', {
        user_id: Number(user), leave_type_id: Number(type), year: Number(y),
        allocated: v.allocated === '' ? null : Number(v.allocated), carried_over: Number(v.carried_over), adjustment: Number(v.adjustment), reason: v.reason,
      });
      close(); toast('Balance updated'); await refresh();
    },
  });
};
actions['bal-rollover'] = async (btn) => {
  const ok = await confirmBox({ title: `Run carry-over from ${year - 1} to ${year}?`, message: 'Unused days are carried over up to each leave type\'s limit and replace any existing carry-over for the new year.', confirm: 'Run carry-over' });
  if (!ok) return;
  await busy(btn, async () => { const r = await post('/api/balances/rollover', { from_year: year - 1 }); toast(`Updated ${r.updated} balances for ${r.to_year}`); await refresh(); });
};

export async function render() {
  if (!year) year = Number(state.today.slice(0, 4));
  const mine = await get(`/api/balances${qs({ year })}`);
  team = isManager() ? await get(`/api/team-balances${qs({ year })}`) : null;
  const types = team ? [...new Map(team.people.flatMap((p) => p.balances).map((b) => [b.leave_type_id, b])).values()] : [];
  const yrs = [year - 1, year, year + 1];
  return h`
    <div class="row between wrap">
      <label class="inline">Year <select data-change="bal-year">${yrs.map((y) => h`<option ${y === year ? 'selected' : ''}>${y}</option>`)}</select></label>
      ${isHr() ? h`<button class="btn" data-act="bal-rollover" title="Carry unused days from ${year - 1} into ${year}">Run carry-over into ${year}</button>` : ''}
    </div>
    <h3 class="section">My balances</h3>
    ${balanceCards(mine.balances)}
    <div class="table-wrap"><table>
      <thead><tr><th>Leave type</th><th class="num">Allocated</th><th class="num">Carried over</th><th class="num">Adjusted</th><th class="num">Used</th><th class="num">Pending</th><th class="num">Available</th></tr></thead>
      <tbody>${mine.balances.map((b) => h`<tr><td>${chip(b.name, b.color)}</td><td class="num">${num(b.allocated)}</td><td class="num">${num(b.carried_over)}</td><td class="num">${num(b.adjustment)}</td><td class="num">${num(b.used)}</td><td class="num">${num(b.pending)}</td><td class="num"><strong>${num(b.available)}</strong></td></tr>`)}</tbody></table></div>
    ${team ? h`<h3 class="section">${isHr() ? 'Everyone' : 'My team'} - available days in ${year}</h3>
      ${team.people.length ? h`<div class="table-wrap"><table>
        <thead><tr><th>Person</th>${types.map((t) => h`<th class="num">${t.name}</th>`)}</tr></thead>
        <tbody>${team.people.map((p) => h`<tr><td><strong>${p.user.name}</strong><div class="muted small">${p.user.department}</div></td>
          ${types.map((t) => { const b = p.balances.find((x) => x.leave_type_id === t.leave_type_id); return b ? h`<td class="num">${num(b.available)} <span class="muted small">/ ${num(b.total)}</span>
            ${isHr() ? h`<button class="link small" data-act="bal-adjust" data-user="${p.user.id}" data-type="${b.leave_type_id}" data-name="${p.user.name}" data-tname="${b.name}" data-y="${year}" aria-label="Adjust ${b.name} for ${p.user.name}">edit</button>` : ''}</td>` : h`<td class="num">-</td>`; })}</tr>`)}</tbody></table></div>` : empty('No team members')}` : ''}`;
}
