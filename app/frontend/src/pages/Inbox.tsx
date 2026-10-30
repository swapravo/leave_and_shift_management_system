import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { useMe } from "../auth";
import { LeaveCard, SwapCard, useDecisions } from "../components/decisions";
import { useSwapActions } from "../components/swapActions";
import { Empty, ErrorBox, Loading, Notice, PageHeader } from "../components/ui";
import { formatTimestamp } from "../dates";
import { useAction, useLoad } from "../hooks";
import type { Notification } from "../types";

const KIND_LABEL: Record<Notification["kind"], string> = {
  approval: "Needs approval",
  leave: "Leave",
  swap: "Swap",
  roster: "Roster",
  coverage: "Coverage",
};

/** Tell the nav badge to refresh its count. */
function bellChanged() {
  window.dispatchEvent(new Event("lsm:notifications"));
}

// Links that used to point at pages now folded into this one.
const SELF_LINKS = new Set(["/approvals", "/notifications", "/inbox"]);

/** Everything waiting on you, then what's new: decisions, swap offers, updates. */
export default function Inbox() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const canDecide = me.role !== "employee";
  const data = useLoad(async () => {
    const [pending, swaps, notes] = await Promise.all([
      canDecide ? api.leaveRequests("pending") : Promise.resolve([]),
      api.swaps(),
      api.notifications(),
    ]);
    return { pending, swaps, notes };
  }, [canDecide]);
  const [notice, setNotice] = useState<string | null>(null);
  const { open, dialog } = useDecisions(() => void data.reload());
  const swapActions = useSwapActions((m) => { setNotice(m); void data.reload(); });
  const read = useAction();

  const d = data.data;
  const toDecideSwaps = d?.swaps.filter((s) => s.status === "pending_manager" && s.can_decide) ?? [];
  const offers = d?.swaps.filter((s) => s.can_respond) ?? [];
  const waiting = d?.swaps.filter((s) => s.status === "pending_peer" && s.can_decide === false && s.requester_id !== me.id && s.target_id !== me.id) ?? [];
  const decisionCount = (d?.pending.length ?? 0) + toDecideSwaps.length;
  const nothingToDo = decisionCount === 0 && offers.length === 0;

  async function markRead(n: Notification) {
    if (n.read) return;
    if (await read.run(() => api.readNotification(n.id))) {
      bellChanged();
      void data.reload();
    }
  }

  return (
    <div className="page narrow">
      <PageHeader
        title="Inbox"
        subtitle={d ? (nothingToDo ? "Nothing needs your answer right now" : `${decisionCount + offers.length} waiting for you`) : undefined}
        actions={
          <button type="button" disabled={!d?.notes.unread || read.busy}
            onClick={async () => { if (await read.run(() => api.readAllNotifications())) { bellChanged(); void data.reload(); } }}>
            Mark all as read
          </button>
        }
      />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={data.error ?? read.error} />
      {swapActions.error}
      {!d ? <Loading /> : (
        <div className="stack">
          {decisionCount > 0 && (
            <section aria-label="Needs your decision">
              <div className="section-title"><h2>Needs your decision ({decisionCount})</h2></div>
              {d.pending.map((r) => (
                <LeaveCard key={r.id} r={r} year={year} onDecide={(approve) => open({ kind: "leave", item: r, approve })} />
              ))}
              {toDecideSwaps.map((s) => (
                <SwapCard key={s.id} s={s} meId={me.id} year={year} onDecide={(approve) => open({ kind: "swap", item: s, approve })} />
              ))}
            </section>
          )}
          {offers.length > 0 && (
            <section aria-label="Swap offers for you">
              <div className="section-title"><h2>Swap offers for you</h2></div>
              {offers.map((s) => <SwapCard key={s.id} s={s} meId={me.id} year={year} actions={swapActions.buttons(s)} />)}
            </section>
          )}
          {nothingToDo && <Empty>You're all caught up. Approvals and swap offers show up here.</Empty>}
          {waiting.length > 0 && (
            <details className="card">
              <summary><strong>Waiting for a teammate to accept ({waiting.length})</strong></summary>
              {waiting.map((s) => <SwapCard key={s.id} s={s} meId={me.id} year={year} />)}
            </details>
          )}
          <section aria-label="Updates">
            <div className="section-title"><h2>Updates</h2><span className="muted small">{d.notes.unread} unread</span></div>
            {d.notes.notifications.length === 0 ? <Empty>No updates yet.</Empty> : (
              <ul className="list" aria-label="Updates" style={{ padding: 0 }}>
                {d.notes.notifications.map((n) => (
                  <li key={n.id} style={{ display: "block", padding: 0, border: "none" }}>
                    <div className={`item-card${n.read ? "" : " unread"}`} style={n.read ? { opacity: 0.8 } : undefined}>
                      <div style={{ flex: "1 1 14rem" }}>
                        <div className="meta">{KIND_LABEL[n.kind]} · {formatTimestamp(n.created_at)}</div>
                        <div>{n.read ? n.message : <strong>{n.message}</strong>}</div>
                      </div>
                      <div className="row-actions">
                        {n.link && !SELF_LINKS.has(n.link) && (
                          <Link className="button small" to={n.link} onClick={() => void markRead(n)}>Open</Link>
                        )}
                        {!n.read && <button type="button" className="small" onClick={() => markRead(n)}>Mark read</button>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {dialog}
    </div>
  );
}
