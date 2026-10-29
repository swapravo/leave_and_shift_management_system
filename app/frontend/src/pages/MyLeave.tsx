import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { Card, ConfirmDialog, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { formatDate, formatDays, formatRange, formatTimestamp, isISODate, workingDays } from "../dates";
import { asApiError, useAction, useLoad } from "../hooks";
import type { Balance, LeavePreview, LeaveRequest, LeaveRequestDetail, LedgerKind } from "../types";

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
    <div className="card balance-card">
      <h3>
        <span>{b.leave_type}</span>
        {!b.active && <span className="badge badge-neutral">Archived</span>}
      </h3>
      <div className="stat">
        <span className="value">{formatDays(b.available)}</span>
        <span className="label">Available (after pending)</span>
      </div>
      <dl>
        <dt>Balance</dt><dd>{formatDays(b.balance)}</dd>
        <dt>Pending</dt><dd>{formatDays(b.pending)}</dd>
        <dt>Used</dt><dd>{formatDays(b.used)}</dd>
        <dt>Accrued this year</dt><dd>{formatDays(b.accrued)} of {formatDays(b.annual_entitlement)}</dd>
        <dt>Carried forward</dt><dd>{formatDays(b.carried_forward)}</dd>
        {b.adjustments !== 0 && (<><dt>Adjustments</dt><dd>{formatDays(b.adjustments)}</dd></>)}
      </dl>
    </div>
  );
}

function ApplyForm({ balances, today, onApplied }: { balances: Balance[]; today: string; onApplied: (r: LeaveRequest) => void }) {
  const types = balances.filter((b) => b.active);
  const [typeId, setTypeId] = useState<number | "">(types[0]?.leave_type_id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const { busy, error, setError, run } = useAction();

  const ready = typeId !== "" && isISODate(start) && isISODate(end);

  // Live preview: every rule the server will apply, re-run shortly after each change.
  useEffect(() => {
    setPreview(null);
    if (!ready) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      api.previewLeave({ leave_type_id: Number(typeId), start_date: start, end_date: end })
        .then((p) => alive && setPreview(p))
        .catch((e) => alive && setError(asApiError(e)));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [typeId, start, end, ready, setError]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let created: LeaveRequest | null = null;
    const ok = await run(async () => {
      created = await api.applyLeave({ leave_type_id: Number(typeId), start_date: start, end_date: end, reason });
    });
    if (ok && created) {
      setStart("");
      setEnd("");
      setReason("");
      onApplied(created);
    }
  }

  if (!types.length) return <Empty>No leave types are available to you.</Empty>;
  const localDays = ready ? workingDays(start, end) : 0;
  return (
    <form onSubmit={submit} aria-label="Apply for leave">
      <div className="form-grid">
        <Field label="Leave type" htmlFor="leave-type">
          <select id="leave-type" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
            {types.map((t) => <option key={t.leave_type_id} value={t.leave_type_id}>{t.leave_type}</option>)}
          </select>
        </Field>
        <Field label="First day" htmlFor="start-date">
          <input id="start-date" type="date" min={today} value={start} required
            onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} />
        </Field>
        <Field label="Last day" htmlFor="end-date">
          <input id="end-date" type="date" min={start || today} value={end} required onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="Reason (optional)" htmlFor="reason">
        <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </Field>
      {ready && (
        <div className="alert alert-info" role="status" aria-live="polite" data-testid="leave-preview">
          {preview ? (
            <>
              <strong>{formatDays(preview.days)} working day{preview.days === 1 ? "" : "s"}</strong> (Mon–Fri)
              {preview.available !== null && (
                <> · available {formatDays(preview.available)} → remaining after this request{" "}
                  <strong>{formatDays(preview.remaining_after ?? 0)}</strong></>
              )}
            </>
          ) : <>{localDays} working day{localDays === 1 ? "" : "s"} (Mon–Fri) · checking…</>}
        </div>
      )}
      {preview && preview.errors.length > 0 && (
        <div className="alert alert-bad" role="alert">
          <strong>This request can't be submitted:</strong>
          <ul>{preview.errors.map((m) => <li key={m}>{m}</li>)}</ul>
          {preview.violations.length > 1 && (
            <>
              <div>Shifts that would be short without you:</div>
              <ul>
                {preview.violations.map((v) => (
                  <li key={`${v.shift_template_id}-${v.date}`}>
                    {v.shift_name} on {formatDate(v.date)} — {v.headcount_without_you} of {v.min_headcount} without you
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <ErrorBox error={error} />
      <button type="submit" className="primary" disabled={!ready || busy || (preview?.errors.length ?? 0) > 0}>
        {busy ? "Submitting…" : "Submit request"}
      </button>
    </form>
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

function DetailBody({ d, year }: { d: LeaveRequestDetail; year: number }) {
  return (
    <>
      <p><strong>{d.leave_type}</strong> · {formatRange(d.start_date, d.end_date, year)} · {formatDays(d.days)} day(s)</p>
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

export default function MyLeave() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const balances = useLoad(() => api.balances(), []);
  const requests = useLoad(() => api.leaveRequests("mine"), []);
  const ledger = useLoad(() => api.ledger(), []);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const cancel = useAction();

  const refresh = () => Promise.all([balances.reload(), requests.reload(), ledger.reload()]);

  return (
    <div className="page">
      <PageHeader title="My leave" subtitle={`Balances for ${year}. Leave counts Monday to Friday only.`} />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={balances.error} />
      {balances.data ? (
        <div className="grid cards" aria-label="Leave balances" role="region">
          {balances.data.map((b) => <BalanceCard key={b.leave_type_id} b={b} />)}
        </div>
      ) : <Loading />}

      <div className="grid two" style={{ marginTop: "1rem" }}>
        <Card title="Apply for leave">
          {balances.data && (
            <ApplyForm
              balances={balances.data}
              today={me.today}
              onApplied={(r) => {
                setNotice(`Request sent for ${formatRange(r.start_date, r.end_date, year)} (${formatDays(r.days)} day${r.days === 1 ? "" : "s"}). It's waiting for approval.`);
                void refresh();
              }}
            />
          )}
        </Card>
        <Card title="My requests">
          <ErrorBox error={requests.error} />
          {!requests.data ? <Loading /> : requests.data.length === 0 ? <Empty>No requests yet.</Empty> : (
            <ul className="list" aria-label="My leave requests">
              {requests.data.map((r) => (
                <li key={r.id}>
                  <div>
                    <div><strong>{r.leave_type}</strong> · {formatRange(r.start_date, r.end_date, year)} · {formatDays(r.days)} day{r.days === 1 ? "" : "s"}</div>
                    <div className="meta">
                      <StatusBadge status={r.status} />
                      {r.decided_by_name && ` by ${r.decided_by_name}`}
                      {r.decision_comment && ` — “${r.decision_comment}”`}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="small" onClick={() => setDetail(r.id)}>Details</button>
                    {r.can_cancel && (
                      <button type="button" className="small" onClick={() => { cancel.setError(null); setCancelling(r); }}>
                        {r.status === "pending" ? "Withdraw" : "Cancel leave"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Balance history" className="ledger">
        {!ledger.data ? <Loading /> : ledger.data.length === 0 ? <Empty>No movements this year.</Empty> : (
          <TableWrap label="Balance history">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Movement</th><th className="num">Days</th><th>Details</th></tr></thead>
              <tbody>
                {ledger.data.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{formatTimestamp(e.created_at)}</td>
                    <td>{e.leave_type}</td>
                    <td>{KIND_LABEL[e.kind]}{e.period ? ` (${e.period})` : ""}</td>
                    <td className="num">{e.amount > 0 ? "+" : ""}{formatDays(e.amount)}</td>
                    <td className="small">{e.reason}{e.created_by_name ? ` · ${e.created_by_name}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

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
