import { Fragment, useState } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { Card, Empty, ErrorBox, Field, Loading, PageHeader, TableWrap } from "../components/ui";
import { formatTimestamp } from "../dates";
import { useLoad } from "../hooks";
import type { AuditEntry } from "../types";

const PAGE = 50;
const ENTITY_TYPES = ["leave_request", "shift_assignment", "swap_request", "user", "team", "leave_type",
  "shift_template", "balance_ledger", "accrual", "system"];

function Diff({ entry }: { entry: AuditEntry }) {
  const keys = Array.from(new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})])).sort();
  if (!keys.length) return <span className="muted small">No details</span>;
  const show = (v: unknown) => (v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <table className="small">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>
        {keys.map((k) => {
          const before = entry.before?.[k];
          const after = entry.after?.[k];
          const changed = JSON.stringify(before) !== JSON.stringify(after);
          return (
            <tr key={k}>
              <td>{k}</td>
              <td>{show(before)}</td>
              <td>{changed ? <strong>{show(after)}</strong> : show(after)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function AuditLog() {
  const me = useMe();
  const [entityType, setEntityType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const page = useLoad(
    () => api.audit({ entity_type: entityType || undefined, start: start || undefined, end: end || undefined, limit: PAGE, offset }),
    [entityType, start, end, offset],
  );

  const reset = (fn: () => void) => { fn(); setOffset(0); };
  return (
    <div className="page">
      <PageHeader title="Audit log" subtitle={me.role === "hr_admin" ? "Every change in the system, newest first." : "Changes affecting your team, newest first."} />
      <Card>
        <div className="inline-form" style={{ marginBottom: "0.75rem" }}>
          <Field label="What changed" htmlFor="audit-entity">
            <select id="audit-entity" value={entityType} onChange={(e) => reset(() => setEntityType(e.target.value))}>
              <option value="">Everything</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="From" htmlFor="audit-start"><input id="audit-start" type="date" value={start} onChange={(e) => reset(() => setStart(e.target.value))} /></Field>
          <Field label="To" htmlFor="audit-end"><input id="audit-end" type="date" value={end} onChange={(e) => reset(() => setEnd(e.target.value))} /></Field>
        </div>
        <ErrorBox error={page.error} />
        {!page.data ? <Loading /> : page.data.entries.length === 0 ? <Empty>No entries.</Empty> : (
          <>
            <TableWrap label="Audit entries">
              <table>
                <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th><span className="sr-only">Details</span></th></tr></thead>
                <tbody>
                  {page.data.entries.map((e) => (
                    <Fragment key={e.id}>
                      <tr>
                        <td className="nowrap">{formatTimestamp(e.created_at)}</td>
                        <td>{e.actor_name}</td>
                        <td><code>{e.action}</code></td>
                        <td className="small">{e.entity_type.replace(/_/g, " ")}{e.entity_id !== null ? ` #${e.entity_id}` : ""}</td>
                        <td className="actions">
                          <button type="button" className="small" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                            {open === e.id ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {open === e.id && (
                        <tr><td colSpan={5}><Diff entry={e} /></td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <div className="row-actions" style={{ marginTop: "0.75rem", alignItems: "center" }}>
              <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>← Newer</button>
              <span className="muted small">{offset + 1}–{Math.min(offset + PAGE, page.data.total)} of {page.data.total}</span>
              <button type="button" disabled={offset + PAGE >= page.data.total} onClick={() => setOffset(offset + PAGE)}>Older →</button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
