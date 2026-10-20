import { h, get, qs, state, actions, openModal, refresh, fmtDay, fmtMonth, addDays, dowOf, mondayOf, chip, avatar, isManager, isHr, empty } from '../core.js';

let month = null;
let dept = '';
let data = null;

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const shiftMonth = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const short = (name) => { const p = name.split(' '); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : name; };

actions['cal-prev'] = () => { month = shiftMonth(month, -1); refresh(); };
actions['cal-next'] = () => { month = shiftMonth(month, 1); refresh(); };
actions['cal-today'] = () => { month = state.today.slice(0, 7); refresh(); };
actions['cal-dept'] = (el) => { dept = el.value; refresh(); };
actions['cal-day'] = (el) => {
  const date = el.dataset.date;
  const es = data.entries.filter((e) => e.date === date);
  const name = (id) => data.users.find((u) => u.id === id)?.name || 'Unknown';
  const hol = data.holidays.find((x) => x.date === date);
  openModal({
    title: fmtDay(date), hideFooter: true,
    body: h`${hol ? h`<p class="msg ok">Public holiday: ${hol.name}</p>` : ''}
      ${es.length ? h`<ul class="list">${es.map((e) => h`<li>${avatar(name(e.user_id))}<div><strong>${name(e.user_id)}</strong><small>${e.type_name}${e.amount < 1 ? ' (half day)' : ''}${e.status === 'pending' ? ' - pending approval' : ''}</small></div>${chip(e.type_name, e.color)}</li>`)}</ul>` : h`<p class="muted">Nobody is away.</p>`}
      <div class="row end"><button type="button" class="btn" data-act="modal-close">Close</button></div>`,
  });
};

export async function render() {
  if (!month) month = state.today.slice(0, 7);
  data = await get(`/api/calendar${qs({ month, department: dept })}`);
  const hol = new Map(data.holidays.map((x) => [x.date, x.name]));
  const dates = [];
  for (let d = data.grid_start; d <= data.grid_end; d = addDays(d, 1)) dates.push(d);
  const nameOf = new Map(data.users.map((u) => [u.id, u.name]));
  const legend = [...new Map(data.entries.map((e) => [e.type_name, e.color])).entries()];
  return h`
    <div class="toolbar">
      <div class="row gap"><button class="btn" data-act="cal-prev" aria-label="Previous month">&larr;</button><button class="btn" data-act="cal-today">Today</button><button class="btn" data-act="cal-next" aria-label="Next month">&rarr;</button></div>
      <strong class="range">${fmtMonth(month)}</strong>
      <div class="spacer"></div>
      ${data.departments.length ? h`<label class="inline">Department <select data-change="cal-dept"><option value="">Everyone</option>${data.departments.map((d) => h`<option ${d === dept ? 'selected' : ''}>${d}</option>`)}</select></label>` : h`<span class="muted small">${data.users.length} people</span>`}
    </div>
    <div class="cal-scroll"><div class="cal" role="grid" aria-label="Team leave calendar for ${fmtMonth(month)}">
      ${DOW.map((d) => h`<div class="cal-h" role="columnheader">${d}</div>`)}
      ${dates.map((d) => {
        const es = data.entries.filter((e) => e.date === d);
        const outside = d.slice(0, 7) !== month;
        const wk = dowOf(d) === 0 || dowOf(d) === 6;
        return h`<div class="cal-d ${outside ? 'out' : ''} ${wk ? 'weekend' : ''} ${d === data.today ? 'today' : ''} ${hol.has(d) ? 'holiday' : ''}" role="gridcell">
          <div class="cal-n"><button class="link" data-act="cal-day" data-date="${d}" aria-label="${fmtDay(d)}: ${es.length} away">${Number(d.slice(8))}</button>${es.length ? h`<span class="cal-count" title="${es.length} away">${es.length}</span>` : ''}</div>
          ${hol.has(d) ? h`<div class="cal-hol">${hol.get(d)}</div>` : ''}
          ${es.slice(0, 3).map((e) => h`<div class="cal-e ${e.status}" style="--c:${e.color}" title="${nameOf.get(e.user_id) || ''} - ${e.type_name}${e.status === 'pending' ? ' (pending)' : ''}">${short(nameOf.get(e.user_id) || '?')}${e.amount < 1 ? ' ½' : ''}</div>`)}
          ${es.length > 3 ? h`<button class="link small" data-act="cal-day" data-date="${d}">+${es.length - 3} more</button>` : ''}
        </div>`;
      })}
    </div></div>
    <div class="legend">${legend.map(([n, c]) => chip(n, c))}<span class="muted small">Dashed = pending approval${isManager() ? '' : '. Leave types are hidden for teammates.'}</span></div>`;
}
