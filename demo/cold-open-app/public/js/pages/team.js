import { h, get, fmtDay, num, avatar, progress, empty, chip } from '../core.js';
import { timeRange } from './shared.js';

export async function render() {
  const { team } = await get('/api/team');
  if (!team.length) return empty('No team members yet', 'People who report to you will appear here.');
  return h`<div class="grid cards wide">${team.map((m) => h`<section class="card person-card">
    <div class="row gap">${avatar(m.name)}<div><strong>${m.name}</strong><small class="muted block">${m.title || ''} - ${m.department}</small></div>
      ${m.away_today ? h`<span class="badge warn">Away today</span>` : h`<span class="badge ok">Available</span>`}</div>
    <p class="small muted">${m.next_shift ? h`Next shift: <strong>${fmtDay(m.next_shift.date)}</strong> <span class="mono">${timeRange(m.next_shift)}</span>` : 'No upcoming shifts'}</p>
    ${m.balances.filter((b) => b.total > 0).map((b) => h`<div class="mini"><div class="row between small"><span>${b.name}</span><span><strong>${num(b.available)}</strong> / ${num(b.total)}</span></div>${progress(b.used, b.pending, b.total, b.color)}</div>`)}
  </section>`)}</div>`;
}
