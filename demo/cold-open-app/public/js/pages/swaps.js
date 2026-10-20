import { h, get, post, actions, openModal, confirmBox, toast, refresh, busy, fmtTs, badge, empty } from '../core.js';
import { swapModal, swapSummary } from './shared.js';

actions['swap-new'] = () => swapModal();
actions['swap-accept'] = (btn) => busy(btn, async () => { await post(`/api/swaps/${btn.dataset.id}/accept`, {}); toast('Accepted - your manager will be asked to approve'); await refresh(); });
actions['swap-decline'] = (btn) => {
  openModal({
    title: 'Decline swap request', submit: 'Decline', danger: true,
    body: h`<label>Note to your teammate <small>(optional)</small><input name="note" maxlength="300"></label>`,
    onSubmit: async (v, { close }) => { await post(`/api/swaps/${btn.dataset.id}/decline`, { note: v.note }); close(); toast('Swap declined'); await refresh(); },
  });
};
actions['swap-withdraw'] = async (btn) => {
  if (!(await confirmBox({ title: 'Withdraw this request?', message: 'Your teammate will be notified.', confirm: 'Withdraw', danger: true }))) return;
  await busy(btn, async () => { await post(`/api/swaps/${btn.dataset.id}/cancel`, {}); toast('Swap withdrawn'); await refresh(); });
};

export function swapCard(w) {
  return h`<div class="card swap">
    <div class="row between"><div>${swapSummary(w)}</div>${badge(w.status)}</div>
    ${w.message ? h`<p class="quote">"${w.message}"</p>` : ''}
    ${w.decision_note ? h`<p class="muted small">${w.decided_by_name ? `${w.decided_by_name}: ` : ''}${w.decision_note}</p>` : ''}
    <div class="row between"><small class="muted">Requested ${fmtTs(w.created_at)}</small>
      <div class="row gap">
        ${w.can_accept ? h`<button class="btn primary small" data-act="swap-accept" data-id="${w.id}">Accept</button><button class="btn small" data-act="swap-decline" data-id="${w.id}">Decline</button>` : ''}
        ${w.can_cancel ? h`<button class="btn small" data-act="swap-withdraw" data-id="${w.id}">Withdraw</button>` : ''}
        ${w.can_decide ? h`<button class="btn primary small" data-act="swap-approve" data-id="${w.id}">Approve</button><button class="btn small" data-act="swap-reject" data-id="${w.id}">Reject</button>` : ''}
      </div></div>
  </div>`;
}

export async function render() {
  const { swaps } = await get('/api/swaps?scope=mine');
  const need = swaps.filter((w) => w.can_accept);
  const open = swaps.filter((w) => !w.can_accept && ['pending_peer', 'pending_manager'].includes(w.status));
  const done = swaps.filter((w) => !['pending_peer', 'pending_manager'].includes(w.status));
  return h`
    <div class="row between wrap"><p class="muted">Swap a shift with a teammate in your department. They accept first, then your manager approves.</p><button class="btn primary" data-act="swap-new">Request a swap</button></div>
    <h3 class="section">Waiting for your answer</h3>
    ${need.length ? need.map(swapCard) : empty('Nothing waiting for you')}
    <h3 class="section">Open requests</h3>
    ${open.length ? open.map(swapCard) : empty('No open swap requests')}
    <h3 class="section">History</h3>
    ${done.length ? done.map(swapCard) : empty('No past swaps')}`;
}
