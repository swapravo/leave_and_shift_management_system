import { h, get, post, actions, openModal, confirmBox, toast, refresh, busy, fmtRange, fmtTs, chip, badge, days, empty, num, state } from '../core.js';
import { balanceCards, leaveModal } from './shared.js';

actions['leave-new'] = () => leaveModal();
actions['leave-cancel'] = async (btn) => {
  const ok = await confirmBox({ title: 'Cancel this request?', message: 'The days will be returned to your balance and your manager will be told.', confirm: 'Cancel request', danger: true });
  if (!ok) return;
  await busy(btn, async () => { await post(`/api/leave-requests/${btn.dataset.id}/cancel`, {}); toast('Request cancelled'); await refresh(); });
};

export async function render() {
  const [bal, reqs] = await Promise.all([get('/api/balances'), get('/api/leave-requests?scope=mine')]);
  const rows = reqs.requests;
  return h`
    <div class="row between wrap"><p class="muted">Your balances and leave history. Weekends and public holidays are not deducted.</p><button class="btn primary" data-act="leave-new">Request leave</button></div>
    ${balanceCards(bal.balances)}
    <h3 class="section">My requests</h3>
    ${rows.length ? h`<div class="table-wrap"><table>
      <thead><tr><th>Type</th><th>Dates</th><th class="num">Days</th><th>Status</th><th>Details</th><th></th></tr></thead>
      <tbody>${rows.map((r) => h`<tr>
        <td>${chip(r.type_name, r.type_color)}</td>
        <td>${fmtRange(r.start_date, r.end_date)}${r.half_day ? ' (half day)' : ''}</td>
        <td class="num">${num(r.days)}</td>
        <td>${badge(r.status)}</td>
        <td class="small">${r.reason ? h`<div>${r.reason}</div>` : ''}${r.decision_note ? h`<div class="muted">${r.decided_by_name ? `${r.decided_by_name}: ` : ''}${r.decision_note}</div>` : ''}<div class="muted">Submitted ${fmtTs(r.created_at)}</div></td>
        <td class="right">${r.can_cancel ? h`<button class="btn small" data-act="leave-cancel" data-id="${r.id}">Cancel</button>` : ''}</td>
      </tr>`)}</tbody></table></div>` : empty('No leave requests yet', 'Use "Request leave" to book time off.')}`;
}
