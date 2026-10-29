import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { Card, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { formatDays } from "../dates";
import { useAction, useLoad } from "../hooks";
import type { LeaveType } from "../types";

function TypeDialog({ type, onClose, onSaved }: { type: LeaveType | null; onClose: () => void; onSaved: (t: LeaveType) => void }) {
  const [name, setName] = useState(type?.name ?? "");
  const [entitlement, setEntitlement] = useState(String(type?.annual_entitlement ?? ""));
  const [cap, setCap] = useState(String(type?.carry_forward_cap ?? "0"));
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    let saved: LeaveType | undefined;
    const body = { name, annual_entitlement: Number(entitlement), carry_forward_cap: Number(cap) };
    const ok = await run(async () => {
      saved = type ? await api.updateLeaveType(type.id, body) : await api.createLeaveType(body);
    });
    if (ok && saved) onSaved(saved);
  }

  return (
    <Modal title={type ? `Edit ${type.name}` : "Add leave type"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name" htmlFor="lt-name"><input id="lt-name" value={name} required onChange={(e) => setName(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="Days per year" htmlFor="lt-ent" hint="1/12 is credited on the 1st of each month.">
            <input id="lt-ent" type="number" min={0} max={366} step="0.01" value={entitlement} required onChange={(e) => setEntitlement(e.target.value)} />
          </Field>
          <Field label="Carry-forward cap" htmlFor="lt-cap" hint="Unused days kept at year end; the rest lapse.">
            <input id="lt-cap" type="number" min={0} step="0.01" value={cap} required onChange={(e) => setCap(e.target.value)} />
          </Field>
        </div>
        <ErrorBox error={error} />
        <div className="modal-foot">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : type ? "Save changes" : "Add leave type"}</button>
        </div>
      </form>
    </Modal>
  );
}

function AccrualPanel({ today }: { today: string }) {
  const year = Number(today.slice(0, 4));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [monthYear, setMonthYear] = useState(year);
  const [closing, setClosing] = useState(year - 1);
  const [result, setResult] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  return (
    <Card title="Accrual">
      <p className="muted small">Accrual catches up automatically when the server starts. Both runs are safe to repeat.</p>
      <form className="inline-form" onSubmit={async (e) => {
        e.preventDefault();
        setResult(null);
        await run(async () => {
          const r = await api.runMonthly(monthYear, month);
          setResult(r.entries_created ? `Monthly accrual: ${r.entries_created} credit(s) added.` : "Monthly accrual: already up to date.");
        });
      }}>
        <Field label="Month" htmlFor="acc-month">
          <select id="acc-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </Field>
        <Field label="Year" htmlFor="acc-year">
          <input id="acc-year" type="number" value={monthYear} min={2000} max={2100} onChange={(e) => setMonthYear(Number(e.target.value))} />
        </Field>
        <button type="submit" disabled={busy}>Run monthly accrual</button>
      </form>
      <form className="inline-form" style={{ marginTop: "0.75rem" }} onSubmit={async (e) => {
        e.preventDefault();
        setResult(null);
        await run(async () => {
          const r = await api.runYearEnd(closing);
          setResult(r.balances_closed ? `Year-end ${closing}: ${r.balances_closed} balance(s) closed and carried forward.` : `Year-end ${closing}: already closed.`);
        });
      }}>
        <Field label="Close year" htmlFor="acc-close">
          <input id="acc-close" type="number" value={closing} min={2000} max={year - 1} onChange={(e) => setClosing(Number(e.target.value))} />
        </Field>
        <button type="submit" disabled={busy}>Run year-end close</button>
      </form>
      {result && <Notice tone="ok">{result}</Notice>}
      <ErrorBox error={error} />
    </Card>
  );
}

function AdjustPanel({ types, today }: { types: LeaveType[]; today: string }) {
  const users = useLoad(() => api.users(), []);
  const [userId, setUserId] = useState<number | "">("");
  const [typeId, setTypeId] = useState<number | "">(types[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const people = (users.data ?? []).filter((u) => u.role !== "hr_admin");

  return (
    <Card title="Adjust a balance">
      <form onSubmit={async (e) => {
        e.preventDefault();
        setResult(null);
        const ok = await run(async () => {
          const balances = await api.adjustBalance({ user_id: Number(userId), leave_type_id: Number(typeId), amount: Number(amount), reason });
          const b = balances.find((x) => x.leave_type_id === Number(typeId));
          const name = people.find((p) => p.id === userId)?.name;
          setResult(`${name}'s ${b?.leave_type} balance is now ${formatDays(b?.balance ?? 0)} (available ${formatDays(b?.available ?? 0)}).`);
        });
        if (ok) { setAmount(""); setReason(""); }
      }}>
        <div className="form-grid">
          <Field label="Person" htmlFor="adj-user">
            <select id="adj-user" value={userId} required onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose…</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.name}{u.team_name ? ` · ${u.team_name}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Leave type" htmlFor="adj-type">
            <select id="adj-type" value={typeId} required onChange={(e) => setTypeId(Number(e.target.value))}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Days (+ credit, − debit)" htmlFor="adj-amount">
            <input id="adj-amount" type="number" step="0.01" value={amount} required onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        <Field label="Reason" htmlFor="adj-reason" hint={`Recorded in the ledger and audit log for ${today.slice(0, 4)}.`}>
          <input id="adj-reason" value={reason} required onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        {result && <Notice tone="ok">{result}</Notice>}
        <button type="submit" className="primary" disabled={busy}>Save adjustment</button>
      </form>
    </Card>
  );
}

export default function LeaveTypes() {
  const me = useMe();
  const types = useLoad(() => api.leaveTypes(true), []);
  const [editing, setEditing] = useState<LeaveType | null | "new">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const toggle = useAction();

  return (
    <div className="page">
      <PageHeader title="Leave types & accrual" subtitle="One accrual rule: monthly credit of 1/12, year-end carry-forward up to the cap."
        actions={<button type="button" className="primary" onClick={() => setEditing("new")}>Add leave type</button>} />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={toggle.error} />
      <Card title="Leave types">
        <ErrorBox error={types.error} />
        {!types.data ? <Loading /> : types.data.length === 0 ? <Empty>No leave types yet.</Empty> : (
          <TableWrap label="Leave types">
            <table>
              <thead><tr><th>Name</th><th className="num">Days / year</th><th className="num">Carry-forward cap</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {types.data.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="num">{formatDays(t.annual_entitlement)}</td>
                    <td className="num">{formatDays(t.carry_forward_cap)}</td>
                    <td><StatusBadge status={t.active ? "active" : "archived"} /></td>
                    <td className="actions">
                      <button type="button" className="small" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>Edit</button>
                      <button type="button" className="small" disabled={toggle.busy} aria-label={`${t.active ? "Archive" : "Restore"} ${t.name}`}
                        onClick={async () => {
                          if (await toggle.run(() => api.updateLeaveType(t.id, { active: !t.active }))) {
                            setNotice(`${t.name} ${t.active ? "archived: no new accrual or applications" : "restored"}.`);
                            void types.reload();
                          }
                        }}>{t.active ? "Archive" : "Restore"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      <div className="grid two" style={{ marginTop: "1rem" }}>
        <AccrualPanel today={me.today} />
        {types.data && <AdjustPanel types={types.data} today={me.today} />}
      </div>
      {editing !== null && (
        <TypeDialog type={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={(t) => { setEditing(null); setNotice(`${t.name} saved.`); void types.reload(); }} />
      )}
    </div>
  );
}
