import {
  h, get, post, actions, openModal, closeModal, toast, refresh, busy, fmtRange, fmtDay, fmtTs, chip, badge, days, num, empty,
} from '../core.js';
import { swapCard } from './swaps.js';

let tab = 'pending';

export function leaveCard(r, { compact = false } = {}) {
  return h`<div class="card approval">
    <div class="row between wrap"><div><strong>${r.user_name}</strong> <span class="muted small">${r.department}</span></div>${r.status === 'pending' ? '' : badge(r.status)}</div>
    <div class="row gap wrap mid">${chip(r.type_name, r.type_color)} <strong>${fmtRange(r.start_date, r.end_date)}</strong> <span class="muted">(${days(r.days)}${r.half_day ? ', half day' : ''})</span></div>
    ${r.reason ? h`<p class="quote">"${r.reason}"</p>` : ''}
    ${r.status === 'pending' ? h`<div class="row gap wrap small">
      <span class="muted">Balance available: <strong>${num(r.balance_available)}</strong> day(s)</span>
      ${r.shift_conflicts ? h`<span class="badge warn">${r.shift_conflicts} rostered shift${r.shift_conflicts === 1 ? '' : 's'} affected</span>` : ''}
    </div>` : ''}
    ${r.decision_note && r.status !== 'pending' ? h`<p class="muted small">${r.decided_by_name ? `${r.decided_by_name}: ` : ''}${r.decision_note}</p>` : ''}
    <div class="row between"><small class="muted">Submitted ${fmtTs(r.created_at)}</small>
      <div class="row gap">
        ${r.can_decide ? h`<button class="btn primary small" data-act="lv-approve" data-id="${r.id}">Approve</button><button class="btn small" data-act="lv-reject" data-id="${r.id}">Reject</button>` : ''}
        ${!r.can_decide && r.can_cancel && r.user_id !== undefined && r.status === 'approved' ? h`<button class="btn small" data-act="lv-revoke" data-id="${r.id}" data-name="${r.user_name}">Revoke</button>` : ''}
      </div></div>
  </div>`;
}

async function approve(id, release) {
  try {
    await post(`/api/leave-requests/${id}/approve`, { release_shifts: release });
    toast(release ? 'Approved and shifts released' : 'Leave approved');
    await refresh();
  } catch (e) {
    if (e.data && e.data.code === 'shift_conflicts') {
      openModal({
        title: 'Rostered shifts clash with this leave', submit: 'Approve and release shifts',
        body: h`<p>${e.message.replace(/ Approve and release them\?$/, '')} Approving will cancel these shifts so they can be re-covered:</p>
          <ul class="plain">${e.data.shifts.map((s) => h`<li><strong>${fmtDay(s.date)}</strong> ${s.start_time}-${s.end_time}${s.label ? ` (${s.label})` : ''}</li>`)}</ul>`,
        onSubmit: async (_, { close }) => { close(); await approve(id, true); },
      });
    } else throw e;
  }
}
actions['lv-approve'] = (btn) => busy(btn, () => approve(btn.dataset.id, false));
actions['lv-reject'] = (btn) => {
  openModal({
    title: 'Reject leave request', submit: 'Reject request', danger: true,
    body: h`<label>Reason <small>(shown to the employee)</small><textarea name="note" rows="3" required maxlength="500"></textarea></label>`,
    onSubmit: async (v, { close }) => { await post(`/api/leave-requests/${btn.dataset.id}/reject`, { note: v.note }); close(); toast('Request rejected'); await refresh(); },
  });
};
actions['lv-revoke'] = (btn) => {
  openModal({
    title: `Revoke ${btn.dataset.name}'s approved leave`, submit: 'Revoke leave', danger: true,
    body: h`<label>Reason <small>(shown to the employee)</small><textarea name="note" rows="3" required maxlength="500"></textarea></label>`,
    onSubmit: async (v, { close }) => { await post(`/api/leave-requests/${btn.dataset.id}/cancel`, { note: v.note }); close(); toast('Leave revoked'); await refresh(); },
  });
};
actions['swap-approve'] = (btn) => busy(btn, async () => { await post(`/api/swaps/${btn.dataset.id}/approve`, {}); toast('Swap approved - the roster has been updated'); await refresh(); });
actions['swap-reject'] = (btn) => {
  openModal({
    title: 'Reject shift swap', submit: 'Reject swap', danger: true,
    body: h`<label>Reason <small>(shown to both employees)</small><textarea name="note" rows="3" required maxlength="300"></textarea></label>`,
    onSubmit: async (v, { close }) => { await post(`/api/swaps/${btn.dataset.id}/reject`, { note: v.note }); close(); toast('Swap rejected'); await refresh(); },
  });
};
actions['appr-tab'] = (el) => { tab = el.dataset.tab; refresh(); };

export async function render() {
  const pending = tab === 'pending';
  const [lv, sw] = await Promise.all([
    get(`/api/leave-requests?scope=approvals&status=${pending ? 'pending' : 'approved,rejected,cancelled'}&limit=60`),
    get('/api/swaps?scope=approvals'),
  ]);
  const swaps = sw.swaps.filter((w) => (pending ? w.status === 'pending_manager' : w.status !== 'pending_manager'));
  return h`
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="${pending}" data-act="appr-tab" data-tab="pending">Pending</button>
      <button role="tab" aria-selected="${!pending}" data-act="appr-tab" data-tab="history">History</button>
    </div>
    <h3 class="section">Leave requests</h3>
    ${lv.requests.length ? h`<div class="grid cards wide">${lv.requests.map((r) => leaveCard(r))}</div>` : empty(pending ? 'No leave requests waiting' : 'No decided requests yet')}
    <h3 class="section">Shift swaps</h3>
    ${swaps.length ? h`<div class="grid cards wide">${swaps.map(swapCard)}</div>` : empty(pending ? 'No swaps waiting for approval' : 'No past swaps')}`;
}
