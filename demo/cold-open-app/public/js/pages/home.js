import { h, get, state, actions, fmtDay, fmtRange, fmtFull, chip, badge, days, empty, isManager } from '../core.js';
import { balanceCards, leaveModal, swapModal, timeRange, shiftName } from './shared.js';

actions['home-request-leave'] = () => leaveModal();
actions['home-request-swap'] = () => swapModal();

export async function render() {
  const d = await get('/api/dashboard');
  const m = d.me;
  const first = state.user.name.split(' ')[0];
  const next = m.next_shifts[0];
  const pending = m.upcoming_leave.filter((r) => r.status === 'pending').length;
  return h`
    <section class="hero">
      <div><h2>Hello, ${first}</h2><p class="muted">Today is ${fmtFull(d.today)}.${next ? ` Your next shift is ${next.date === d.today ? 'today' : fmtDay(next.date)}, ${timeRange(next)}.` : ' You have no upcoming shifts.'}</p></div>
      <div class="row gap"><button class="btn primary" data-act="home-request-leave">Request leave</button><button class="btn" data-act="home-request-swap">Request shift swap</button></div>
    </section>
    ${(m.incoming_swaps || (isManager() && state.approvals)) ? h`<div class="callouts">
      ${m.incoming_swaps ? h`<a class="callout" href="#/swaps"><strong>${m.incoming_swaps} shift swap request${m.incoming_swaps === 1 ? '' : 's'}</strong> waiting for your answer</a>` : ''}
      ${isManager() && state.approvals ? h`<a class="callout" href="#/approvals"><strong>${state.approvals} item${state.approvals === 1 ? '' : 's'}</strong> waiting for your approval</a>` : ''}
    </div>` : ''}
    <h3 class="section">Leave balances ${state.today.slice(0, 4)}</h3>
    ${balanceCards(m.balances)}
    <div class="grid two-col">
      <section class="card"><div class="row between"><h3>Upcoming shifts</h3><a href="#/roster">Roster</a></div>
        ${m.next_shifts.length ? h`<ul class="list">${m.next_shifts.map((s) => h`<li><span class="dot" style="--c:${s.color || '#6366f1'}"></span><div><strong>${fmtDay(s.date)}</strong> <span class="mono">${timeRange(s)}</span><small>${shiftName(s)}</small></div></li>`)}</ul>` : empty('No upcoming shifts')}
      </section>
      <section class="card"><div class="row between"><h3>Upcoming leave</h3><a href="#/leave">All requests</a></div>
        ${m.upcoming_leave.length ? h`<ul class="list">${m.upcoming_leave.map((r) => h`<li><div>${chip(r.type_name, r.type_color)} <strong>${fmtRange(r.start_date, r.end_date)}</strong> <span class="muted">(${days(r.days)})</span></div>${badge(r.status)}</li>`)}</ul>` : empty('No upcoming leave', 'Plan some time off with "Request leave".')}
      </section>
    </div>`;
}
