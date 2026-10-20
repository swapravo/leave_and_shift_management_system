import { h, get, post, actions, refresh, ago, empty } from '../core.js';

actions['notif-page-open'] = async (el) => {
  await post(`/api/notifications/${el.dataset.id}/read`);
  if (el.dataset.link) location.hash = el.dataset.link; else await refresh();
};

export async function render() {
  const r = await get('/api/notifications?limit=100');
  return h`
    <div class="row between wrap"><p class="muted">${r.unread ? `${r.unread} unread` : 'Everything is read'}</p>
      ${r.unread ? h`<button class="btn" data-act="notif-read-all">Mark all as read</button>` : ''}</div>
    ${r.notifications.length ? h`<div class="card flush">${r.notifications.map((n) => h`<button class="notif wide ${n.read ? '' : 'unread'}" data-act="notif-page-open" data-id="${n.id}" data-link="${n.link || ''}">
      <strong>${n.title}</strong><span>${n.body || ''}</span><small>${ago(n.created_at)}</small></button>`)}</div>` : empty('No notifications yet')}`;
}
