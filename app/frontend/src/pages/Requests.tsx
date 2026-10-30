import { useState } from "react";
import { ArrowLeftRight, CalendarPlus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { api } from "../api";
import { useMe } from "../auth";
import { SwapCard } from "../components/decisions";
import { LeaveSheet } from "../components/LeaveSheet";
import { SwapSheet } from "../components/SwapSheet";
import { useSwapActions } from "../components/swapActions";
import { ConfirmDialog, Empty, ErrorBox, Loading, Modal, Notice, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { formatDate, formatDays, formatRange, formatTimestamp, hasStarted } from "../dates";
import { useAction, useLoad } from "../hooks";
import { leaveStatusText, plural } from "../plain";
import type { Balance, LeaveRequest, LeaveRequestDetail, LedgerKind } from "../types";

const KIND_LABEL: Record<LedgerKind, string> = {
  accrual: "Monthly accrual",
  carry_forward: "Carried forward",
  year_end_close: "Year-end close",
  leave_taken: "Leave taken",
  leave_refund: "Refund",
  adjustment: "HR adjustment",
};

function BalanceCard({ b }: { b: Balance }) {
  return (
    <div className="stat">
      <span className="label">{b.leave_type}{!b.active ? " (archived)" : ""}</span>
      <span className="value">{formatDays(b.available)}</span>
      <span className="label">days available{b.pending ? `, ${formatDays(b.pending)} pending` : ""}</span>
      <details style={{ marginTop: "0.5rem" }}>
        <summary className="small">How it adds up</summary>
        <dl className="balance-detail">
          <dt>Balance</dt><dd>{formatDays(b.balance)}</dd>
          <dt>Pending</dt><dd>{formatDays(b.pending)}</dd>
          <dt>Used</dt><dd>{formatDays(b.used)}</dd>
          <dt>Accrued this year</dt><dd>{formatDays(b.accrued)} of {formatDays(b.annual_entitlement)}</dd>
          <dt>Carried forward</dt><dd>{formatDays(b.carried_forward)}</dd>
          {b.adjustments !== 0 && (<><dt>Adjustments</dt><dd>{formatDays(b.adjustments)}</dd></>)}
        </dl>
      </details>
    </div>
  );
}

function DetailBody({ d, year }: { d: LeaveRequestDetail; year: number }) {
  return (
    <>
      <p><strong>{d.leave_type}</strong> · {formatRange(d.start_date, d.end_date, year)} · {plural(d.days, "day")}</p>
      <p><StatusBadge status={d.status} /> {d.decided_by_name && `by ${d.decided_by_name}`} {d.decision_comment && `— ${d.decision_comment}`}</p>
      {d.removed_shifts.length > 0 && (
        <>
          <h3>Shifts taken off your roster</h3>
          <ul className="list">
            {d.removed_shifts.map((s) => (
              <li key={s.id}>
                <span>{s.shift_name} · {formatDate(s.date, year)}{s.note ? ` — ${s.note}` : ""}</span>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </>
      )}
      {d.refund_days.length > 0 && (
        <>
          <h3>Refund per working day</h3>
          <ul className="list">
            {d.refund_days.map((r) => (
              <li key={r.date}>
                <span>{formatDate(r.date, year)}{r.status === "owed" ? " — refunded once you're rostered that day again" : ""}</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function RequestDetail({ id, year, onClose }: { id: number; year: number; onClose: () => void }) {
  const { data, error } = useLoad(() => api.leaveRequest(id), [id]);
  return (
    <Modal title="Leave request" onClose={onClose}>
      <ErrorBox error={error} />
      {!data ? <Loading /> : <DetailBody d={data} year={year} />}
    </Modal>
  );
}

export default function Requests() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const [params] = useSearchParams();
  const tab = params.get("tab") === "swaps" ? "swaps" : "leave";
  const balances = useLoad(() => api.balances(), []);
  const requests = useLoad(() => api.leaveRequests("mine"), []);
  const ledger = useLoad(() => api.ledger(), []);
  const teams = useLoad(() => api.teams(), []);
  const shifts = useLoad(() => api.myShifts(), []);
  const swaps = useLoad(() => api.swaps(), []);
  const [sheet, setSheet] = useState<{ kind: "leave" } | { kind: "swap"; shiftId?: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const cancel = useAction();

  const refresh = () => Promise.all([balances.reload(), requests.reload(), ledger.reload(), shifts.reload(), swaps.reload()]);
  const swapActions = useSwapActions((m) => { setNotice(m); void refresh(); });
  const approver = me.role === "manager" ? "HR Admin" : teams.data?.find((t) => t.id === me.team_id)?.manager_name ?? null;

  const mySwaps = swaps.data?.filter((s) => s.requester_id === me.id || s.target_id === me.id) ?? [];
  const openSwaps = mySwaps.filter((s) => s.status === "pending_peer" || s.status === "pending_manager");
  const closedSwaps = mySwaps.filter((s) => s.status !== "pending_peer" && s.status !== "pending_manager").slice(0, 10);
  const upcoming = (shifts.data ?? []).filter((s) => !hasStarted(s.date, s.start_time, me.today));

  return (
    <div className="page">
      <PageHeader
        title="Requests"
        subtitle="Your leave and shift swaps, and where each one stands"
        actions={
          <>
            <button type="button" className="primary" onClick={() => setSheet({ kind: "leave" })}>
              <CalendarPlus size={18} aria-hidden="true" />Request time off
            </button>
            <button type="button" onClick={() => setSheet({ kind: "swap" })}>
              <ArrowLeftRight size={18} aria-hidden="true" />Swap a shift
            </button>
          </>
        }
      />
      <div className="tabs" role="navigation" aria-label="Request type">
        <Link to="/requests" className={tab === "leave" ? "active" : ""} aria-current={tab === "leave" ? "page" : undefined}>Leave</Link>
        <Link to="/requests?tab=swaps" className={tab === "swaps" ? "active" : ""} aria-current={tab === "swaps" ? "page" : undefined}>Shifts &amp; swaps</Link>
      </div>
      {notice && <Notice tone="ok">{notice}</Notice>}
      {swapActions.error}

      {tab === "leave" ? (
        <div className="stack">
          <section aria-label="Leave balances">
            <ErrorBox error={balances.error} />
            {!balances.data ? <Loading /> : (
              <div className="grid cards">{balances.data.map((b) => <BalanceCard key={b.leave_type_id} b={b} />)}</div>
            )}
          </section>
          <section aria-label="My leave requests">
            <div className="section-title"><h2>My requests</h2></div>
            <ErrorBox error={requests.error} />
            {!requests.data ? <Loading /> : requests.data.length === 0 ? (
              <Empty>No leave requests yet.<br />
                <button type="button" className="primary" onClick={() => setSheet({ kind: "leave" })}>Request time off</button>
              </Empty>
            ) : requests.data.map((r) => (
              <div key={r.id} className="item-card">
                <div>
                  <div className="title">{r.leave_type} · {formatRange(r.start_date, r.end_date, year)}</div>
                  <div className="meta">{plural(r.days, "day")} · <StatusBadge status={r.status} label={leaveStatusText(r, approver)} />
                    {r.decision_comment ? ` — “${r.decision_comment}”` : ""}</div>
                </div>
                <div className="row-actions">
                  <button type="button" className="small" onClick={() => setDetail(r.id)}>Details</button>
                  {r.can_cancel && (
                    <button type="button" className="small" onClick={() => { cancel.setError(null); setCancelling(r); }}>
                      {r.status === "pending" ? "Withdraw" : "Cancel leave"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
          <details className="card">
            <summary><strong>Balance history</strong></summary>
            {!ledger.data ? <Loading /> : ledger.data.length === 0 ? <Empty>No movements this year.</Empty> : (
              <TableWrap label="Balance history">
                <table>
                  <thead><tr><th>Date</th><th>Type</th><th>Movement</th><th className="num">Days</th><th>Details</th></tr></thead>
                  <tbody>
                    {ledger.data.map((e) => (
                      <tr key={e.id}>
                        <td className="nowrap">{formatTimestamp(e.created_at)}</td>
                        <td>{e.leave_type}</td>
                        <td>{e.kind === "adjustment" && !e.created_by_name ? "Automatic credit" : KIND_LABEL[e.kind]}{e.period ? ` (${e.period})` : ""}</td>
                        <td className="num">{e.amount > 0 ? "+" : ""}{formatDays(e.amount)}</td>
                        <td className="small">{e.reason}{e.created_by_name ? ` · ${e.created_by_name}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </details>
        </div>
      ) : (
        <div className="stack">
          <section aria-label="Open swaps">
            <div className="section-title"><h2>Open swaps</h2></div>
            <ErrorBox error={swaps.error} />
            {!swaps.data ? <Loading /> : openSwaps.length === 0 ? <Empty>No swaps in progress.</Empty> : openSwaps.map((s) => (
              <SwapCard key={s.id} s={s} meId={me.id} year={year} actions={swapActions.buttons(s)} />
            ))}
          </section>
          <section aria-label="My upcoming shifts">
            <div className="section-title"><h2>My upcoming shifts</h2></div>
            <ErrorBox error={shifts.error} />
            {!shifts.data ? <Loading /> : upcoming.length === 0 ? <Empty>You aren't rostered in the next four weeks.</Empty> : (
              <div className="card">
                <ul className="list" aria-label="My upcoming shifts">
                  {upcoming.map((s) => (
                    <li key={s.id}>
                      <div>
                        <strong>{formatDate(s.date, year)}</strong> · {s.shift_name}
                        <div className="meta">{s.start_time}–{s.end_time}{s.end_time <= s.start_time ? " (ends next day)" : ""} · {s.team_name}</div>
                      </div>
                      <button type="button" className="small" onClick={() => setSheet({ kind: "swap", shiftId: s.id })}
                        aria-label={`Swap ${s.shift_name} on ${formatDate(s.date, year)}`}>Swap</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          {closedSwaps.length > 0 && (
            <details className="card">
              <summary><strong>Recent swaps</strong></summary>
              {closedSwaps.map((s) => <SwapCard key={s.id} s={s} meId={me.id} year={year} />)}
            </details>
          )}
        </div>
      )}

      {sheet?.kind === "leave" && (
        <LeaveSheet onClose={() => setSheet(null)} onDone={(r) => {
          setSheet(null);
          setNotice(`Request sent for ${formatRange(r.start_date, r.end_date, year)} (${plural(r.days, "day")}). ${approver ? `${approver} will decide.` : "It's waiting for approval."}`);
          void refresh();
        }} />
      )}
      {sheet?.kind === "swap" && (
        <SwapSheet initialShiftId={sheet.shiftId} onClose={() => setSheet(null)} onDone={(s) => {
          setSheet(null);
          setNotice(`Asked ${s.target_name} to swap. They answer first, then it goes for approval.`);
          void refresh();
        }} />
      )}
      {detail !== null && <RequestDetail id={detail} year={year} onClose={() => setDetail(null)} />}
      {cancelling && (
        <ConfirmDialog
          title={cancelling.status === "pending" ? "Withdraw request?" : "Cancel approved leave?"}
          message={cancelling.status === "pending"
            ? <p>Withdraw your {cancelling.leave_type} request for {formatRange(cancelling.start_date, cancelling.end_date, year)}?</p>
            : <p>Your shifts are put back where possible. Each working day is refunded straight away, or once you're rostered that day again if a shift can't be restored.</p>}
          confirmLabel={cancelling.status === "pending" ? "Withdraw" : "Cancel leave"}
          danger
          busy={cancel.busy}
          error={cancel.error}
          onCancel={() => setCancelling(null)}
          onConfirm={async () => {
            const target = cancelling;
            const ok = await cancel.run(async () => {
              const d = await api.cancelLeave(target.id);
              const owed = d.refund_days.filter((r) => r.status === "owed").length;
              const refunded = d.refund_days.filter((r) => r.status === "refunded").length;
              setNotice(target.status === "pending" ? "Request withdrawn."
                : `Leave cancelled: ${refunded} day(s) refunded${owed ? `, ${owed} owed until you're rostered again` : ""}.`);
            });
            if (ok) {
              setCancelling(null);
              setDetail(target.status === "approved" ? target.id : null);
              void refresh();
            }
          }}
        />
      )}
    </div>
  );
}
