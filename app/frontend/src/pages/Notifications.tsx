import { Link } from "react-router";
import { api } from "../api";
import { Card, Empty, ErrorBox, Loading, PageHeader } from "../components/ui";
import { formatTimestamp } from "../dates";
import { useAction, useLoad } from "../hooks";
import type { Notification } from "../types";

const KIND_LABEL: Record<Notification["kind"], string> = {
  approval: "Needs your approval",
  leave: "Leave",
  swap: "Swap",
  roster: "Roster",
  coverage: "Coverage",
};

/** Tell the bell in the layout to refresh its count. */
function bellChanged() {
  window.dispatchEvent(new Event("lsm:notifications"));
}

export default function Notifications() {
  const list = useLoad(() => api.notifications(), []);
  const act = useAction();

  async function markRead(n: Notification) {
    if (n.read) return;
    if (await act.run(() => api.readNotification(n.id))) {
      bellChanged();
      void list.reload();
    }
  }

  return (
    <div className="page narrow">
      <PageHeader
        title="Notifications"
        subtitle={list.data ? `${list.data.unread} unread` : undefined}
        actions={
          <button type="button" disabled={!list.data?.unread || act.busy}
            onClick={async () => { if (await act.run(() => api.readAllNotifications())) { bellChanged(); void list.reload(); } }}>
            Mark all read
          </button>
        }
      />
      <ErrorBox error={list.error ?? act.error} />
      <Card>
        {!list.data ? <Loading /> : list.data.notifications.length === 0 ? <Empty>You're all caught up.</Empty> : (
          <ul className="list" aria-label="Notifications">
            {list.data.notifications.map((n) => (
              <li key={n.id} style={n.read ? { opacity: 0.7 } : undefined}>
                <div>
                  <div className="meta">
                    {!n.read && <span className="badge badge-info">New</span>} {KIND_LABEL[n.kind]} · {formatTimestamp(n.created_at)}
                  </div>
                  <div>{n.read ? n.message : <strong>{n.message}</strong>}</div>
                </div>
                <div className="row-actions">
                  {n.link && <Link className="button small" to={n.link} onClick={() => void markRead(n)}>Open</Link>}
                  {!n.read && <button type="button" className="small" onClick={() => markRead(n)}>Mark read</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
