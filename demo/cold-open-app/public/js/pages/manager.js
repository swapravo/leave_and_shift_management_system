import { h, get, state, actions, fmtDay, fmtShort, fmtRange, fmtFull, ago, chip, num, days, empty, avatar } from '../core.js';
import { leaveCard } from './approvals.js';
import { swapCard } from './swaps.js';

function coverageChart(cov) {
  if (!cov.length) return empty('No team members');
  const max = Math.max(1, ...cov.map((c) => c.scheduled + (c.away || 0)));
  return h`<div class="cov" role="list">${cov.map((c) => {
    const sh = (c.scheduled / max) * 100;
    const aw = ((c.away || 0) / max) * 100;
    const low = !c.weekend && !c.holiday && c.team_size > 0 && c.away / c.team_size >= 0.4;
    return h`<div class="cov-col ${c.weekend || c.holiday ? 'off' : ''} ${low ? 'low' : ''} ${c.date === state.today ? 'today' : ''}" role="listitem" title="${fmtDay(c.date)}: ${c.scheduled} shifts, ${num(c.away)} away${c.holiday ? `, ${c.holiday}` : ''}">
      <div class="cov-bar"><i class="a" style="height:${aw}%"></i><i class="s" style="height:${sh}%"></i></div>
      <b>${c.scheduled}</b><span>${fmtShort(c.date).replace(' ', ' ')}</span>${num(c.away) > 0 ? h`<em>${num(c.away)} off</em>` : ''}${c.holiday ? h`<em>holiday</em>` : ''}
    </div>`;
  })}</div>
  <div class="legend"><span><i class="sw s"></i> Shifts scheduled</span><span><i class="sw a"></i> People on leave</span><span class="muted small">Red outline: 40% or more of the team away</span></div>`;
}

export async function render() {
  const d = await get('/api/dashboard');
  const m = d.manager;
  const pendingCount = m.pending_leave.length + m.pending_swaps.length;
  return h`
    <p class="muted">${m.scope === 'organisation' ? 'Organisation-wide view' : `Your team of ${m.team_size}`} as of ${fmtFull(d.today)}.</p>
    <div class="grid stats">
      <a class="card stat ${pendingCount ? 'hot' : ''}" href="#/approvals"><span>Waiting for approval</span><b>${pendingCount}</b><small>${m.pending_leave.length} leave, ${m.pending_swaps.length} swaps</small></a>
      <div class="card stat"><span>Away today</span><b>${m.out_today.length}</b><small>of ${m.team_size}</small></div>
      <div class="card stat"><span>Away in the next 14 days</span><b>${new Set(m.out_soon.map((o) => o.user_id)).size}</b><small>${m.out_soon.length} approved absence${m.out_soon.length === 1 ? '' : 's'}</small></div>
      <div class="card stat"><span>Low balances</span><b>${m.low_balances.length}</b><small>2 days or fewer left</small></div>
    </div>
    <div class="grid two-col">
      <section>
        <h3 class="section">Needs your decision</h3>
        ${pendingCount ? h`<div class="stack">${m.pending_leave.slice(0, 5).map((r) => leaveCard(r))}${m.pending_swaps.slice(0, 3).map(swapCard)}
          ${pendingCount > 8 ? h`<a href="#/approvals">See all ${pendingCount}</a>` : ''}</div>` : empty('All caught up', 'Nothing is waiting for your approval.')}
      </section>
      <section>
        <h3 class="section">Who is away</h3>
        <div class="card">
          <h4>Today</h4>
          ${m.out_today.length ? h`<ul class="list">${m.out_today.map((o) => h`<li>${avatar(o.name)}<div><strong>${o.name}</strong><small>${o.type_name}${o.amount < 1 ? ' (half day)' : ''} until ${fmtDay(o.end_date)}</small></div>${chip(o.type_name, o.color)}</li>`)}</ul>` : h`<p class="muted">Everyone is available today.</p>`}
          <h4>Next 14 days</h4>
          ${m.out_soon.length ? h`<ul class="list">${m.out_soon.map((o) => h`<li>${avatar(o.name)}<div><strong>${o.name}</strong><small>${fmtRange(o.start_date, o.end_date)} (${days(o.days)})</small></div>${chip(o.type_name, o.color)}</li>`)}</ul>` : h`<p class="muted">No approved leave coming up.</p>`}
        </div>
      </section>
    </div>
    <h3 class="section">Coverage - next 14 days</h3>
    <div class="card">${coverageChart(m.coverage)}</div>
    <div class="grid two-col">
      <section>
        <h3 class="section">Low leave balances</h3>
        <div class="card">${m.low_balances.length ? h`<ul class="list">${m.low_balances.map((b) => h`<li>${avatar(b.user.name)}<div><strong>${b.user.name}</strong><small>${b.name}: ${num(b.available)} of ${num(b.total)} left</small></div></li>`)}</ul>` : h`<p class="muted">Nobody is running low.</p>`}</div>
      </section>
      <section>
        <h3 class="section">Recent activity</h3>
        <div class="card">${m.activity.length ? h`<ul class="list activity">${m.activity.map((a) => h`<li><div>${a.summary}<small>${a.actor_name} - ${ago(a.ts)}</small></div></li>`)}</ul>` : h`<p class="muted">No activity yet.</p>`}</div>
      </section>
    </div>`;
}
