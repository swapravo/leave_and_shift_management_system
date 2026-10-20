import { h, get, qs, actions, forms, openModal, refresh, fmtTs, empty } from '../core.js';

let filters = { q: '', action: '', actor_id: '', from: '', to: '' };
let offset = 0;
const LIMIT = 50;

forms['audit-filter'] = (f, v) => { filters = { q: v.q, action: v.action, actor_id: v.actor_id, from: v.from, to: v.to }; offset = 0; refresh(); };
actions['audit-clear'] = () => { filters = { q: '', action: '', actor_id: '', from: '', to: '' }; offset = 0; refresh(); };
actions['audit-prev'] = () => { offset = Math.max(0, offset - LIMIT); refresh(); };
actions['audit-next'] = () => { offset += LIMIT; refresh(); };

const kind = (a) => (a.startsWith('auth') ? 'muted' : /reject|revoke|cancel|delete|failed|decline/.test(a) ? 'bad' : /approve|accept/.test(a) ? 'ok' : 'info');

function details(d) {
  if (!d) return '';
  return h`<details><summary>Details</summary><pre>${JSON.stringify(d, null, 2)}</pre></details>`;
}

export async function render() {
  const r = await get(`/api/audit${qs({ ...filters, limit: LIMIT, offset })}`);
  const csv = `/api/audit.csv${qs(filters)}`;
  const from = r.total ? r.offset + 1 : 0;
  const to = Math.min(r.offset + r.limit, r.total);
  return h`
    <form class="filters card" data-form="audit-filter">
      <label>Search<input name="q" value="${filters.q}" placeholder="Name or description"></label>
      <label>Action<select name="action"><option value="">All actions</option>${[...new Set(r.actions.map((a) => a.split('.')[0]))].map((g) => h`<option value="${g}." ${filters.action === `${g}.` ? 'selected' : ''}>${g}.*</option>`)}
        ${r.actions.map((a) => h`<option ${filters.action === a ? 'selected' : ''}>${a}</option>`)}</select></label>
      <label>Person<select name="actor_id"><option value="">Anyone</option>${r.actors.map((a) => h`<option value="${a.id}" ${String(a.id) === String(filters.actor_id) ? 'selected' : ''}>${a.name}</option>`)}</select></label>
      <label>From<input type="date" name="from" value="${filters.from}"></label>
      <label>To<input type="date" name="to" value="${filters.to}"></label>
      <div class="row gap end"><button class="btn primary" type="submit">Filter</button><button class="btn" type="button" data-act="audit-clear">Clear</button><a class="btn" href="${csv}" download>Export CSV</a></div>
    </form>
    <p class="muted small">The audit log is append-only: entries cannot be edited or deleted. Showing ${from}-${to} of ${r.total}.</p>
    ${r.entries.length ? h`<div class="table-wrap"><table class="audit"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>What happened</th></tr></thead>
      <tbody>${r.entries.map((e) => h`<tr><td class="nowrap small">${fmtTs(e.ts)}</td><td>${e.actor_name}${e.actor_role ? h`<div class="muted small">${e.actor_role}</div>` : ''}</td>
        <td><span class="badge ${kind(e.action)}">${e.action}</span></td><td>${e.summary}${details(e.details)}</td></tr>`)}</tbody></table></div>
      <div class="row between"><button class="btn" data-act="audit-prev" ${r.offset === 0 ? 'disabled' : ''}>Newer</button><button class="btn" data-act="audit-next" ${to >= r.total ? 'disabled' : ''}>Older</button></div>` : empty('No matching entries')}`;
}
