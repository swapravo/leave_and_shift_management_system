import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { Card, ConfirmDialog, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { useAction, useLoad } from "../hooks";
import type { ShiftTemplate } from "../types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daysLabel(days: number[]): string {
  if (days.length === 7) return "Every day";
  if (days.join() === "0,1,2,3,4") return "Mon–Fri";
  if (days.join() === "5,6") return "Sat–Sun";
  return days.map((d) => DAYS[d]).join(", ");
}

function TemplateDialog({ template, teamId, onClose, onSaved }: {
  template: ShiftTemplate | null; teamId: number; onClose: () => void; onSaved: (t: ShiftTemplate) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [start, setStart] = useState(template?.start_time ?? "09:00");
  const [end, setEnd] = useState(template?.end_time ?? "17:00");
  const [days, setDays] = useState<number[]>(template?.days_of_week ?? [0, 1, 2, 3, 4]);
  const [minimum, setMinimum] = useState(String(template?.min_headcount ?? 1));
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    let saved: ShiftTemplate | undefined;
    const body = { name, start_time: start, end_time: end, days_of_week: days, min_headcount: Number(minimum) };
    const ok = await run(async () => {
      saved = template ? await api.updateShiftTemplate(template.id, body) : await api.createShiftTemplate({ team_id: teamId, ...body });
    });
    if (ok && saved) onSaved(saved);
  }

  return (
    <Modal title={template ? `Edit ${template.name}` : "Add shift"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name" htmlFor="st-name"><input id="st-name" value={name} required onChange={(e) => setName(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="Starts" htmlFor="st-start"><input id="st-start" type="time" value={start} required onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Ends" htmlFor="st-end" hint={end && start && end <= start ? "Ends the next day (overnight)." : undefined}>
            <input id="st-end" type="time" value={end} required onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Minimum headcount" htmlFor="st-min">
            <input id="st-min" type="number" min={0} step={1} value={minimum} required onChange={(e) => setMinimum(e.target.value)} />
          </Field>
        </div>
        <fieldset className="field" style={{ border: "none", padding: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.25rem" }}>Runs on</legend>
          <div className="day-picks">
            {DAYS.map((label, i) => (
              <label key={label} className="check">
                <input type="checkbox" checked={days.includes(i)}
                  onChange={(e) => setDays(e.target.checked ? [...days, i].sort() : days.filter((d) => d !== i))} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {template && <p className="hint muted small">Changing times or days doesn't move existing assignments.</p>}
        <ErrorBox error={error} />
        <div className="modal-foot">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : template ? "Save changes" : "Add shift"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ShiftTemplates() {
  const me = useMe();
  const teams = useLoad(() => api.teams(), []);
  const myTeams = useMemo(
    () => (teams.data ?? []).filter((t) => me.role === "hr_admin" || t.id === me.managed_team_id),
    [teams.data, me.role, me.managed_team_id],
  );
  const [teamId, setTeamId] = useState<number | null>(null);
  useEffect(() => {
    if (teamId === null && myTeams.length) setTeamId(myTeams[0].id);
  }, [myTeams, teamId]);
  const templates = useLoad(
    () => (teamId === null ? Promise.resolve([]) : api.shiftTemplates({ team_id: teamId, include_inactive: true })),
    [teamId],
  );
  const [editing, setEditing] = useState<ShiftTemplate | null | "new">(null);
  const [archiving, setArchiving] = useState<ShiftTemplate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const toggle = useAction();

  if (teams.data && myTeams.length === 0) {
    return <div className="page"><PageHeader title="Shift templates" /><Empty>You don't manage a team yet.</Empty></div>;
  }

  return (
    <div className="page">
      <PageHeader title="Shift templates" subtitle="The shifts a team works, the days they run, and the minimum headcount each needs."
        actions={<button type="button" className="primary" disabled={teamId === null} onClick={() => setEditing("new")}>Add shift</button>} />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={toggle.error} />
      <Card>
        {myTeams.length > 1 && (
          <div className="inline-form" style={{ marginBottom: "0.75rem" }}>
            <Field label="Team" htmlFor="st-team">
              <select id="st-team" value={teamId ?? ""} onChange={(e) => setTeamId(Number(e.target.value))}>
                {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
        )}
        <ErrorBox error={templates.error} />
        {!templates.data ? <Loading /> : templates.data.length === 0 ? <Empty>No shifts yet.</Empty> : (
          <TableWrap label="Shift templates">
            <table>
              <thead><tr><th>Shift</th><th>Time</th><th>Days</th><th className="num">Minimum</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {templates.data.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="nowrap">{t.start_time}–{t.end_time}{t.end_time <= t.start_time ? " (+1 day)" : ""}</td>
                    <td>{daysLabel(t.days_of_week)}</td>
                    <td className="num">{t.min_headcount}</td>
                    <td><StatusBadge status={t.active ? "active" : "archived"} /></td>
                    <td className="actions">
                      <button type="button" className="small" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>Edit</button>
                      {t.active ? (
                        <button type="button" className="small" onClick={() => { toggle.setError(null); setArchiving(t); }} aria-label={`Archive ${t.name}`}>Archive</button>
                      ) : (
                        <button type="button" className="small" disabled={toggle.busy} aria-label={`Restore ${t.name}`}
                          onClick={async () => {
                            if (await toggle.run(() => api.updateShiftTemplate(t.id, { active: true }))) {
                              setNotice(`${t.name} restored.`);
                              void templates.reload();
                            }
                          }}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {editing !== null && teamId !== null && (
        <TemplateDialog template={editing === "new" ? null : editing} teamId={teamId} onClose={() => setEditing(null)}
          onSaved={(t) => { setEditing(null); setNotice(`${t.name} saved.`); void templates.reload(); }} />
      )}
      {archiving && (
        <ConfirmDialog
          title={`Archive ${archiving.name}?`}
          message={<p>Everyone rostered on {archiving.name} from today on is taken off it, and open swaps on those shifts are cancelled. Past days stay as they were.</p>}
          confirmLabel="Archive"
          danger
          busy={toggle.busy}
          error={toggle.error}
          onCancel={() => setArchiving(null)}
          onConfirm={async () => {
            const t = archiving;
            if (await toggle.run(() => api.updateShiftTemplate(t.id, { active: false }))) {
              setArchiving(null);
              setNotice(`${t.name} archived.`);
              void templates.reload();
            }
          }}
        />
      )}
    </div>
  );
}
