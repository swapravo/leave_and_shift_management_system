import { useState, type FormEvent } from "react";
import { api } from "../api";
import { Card, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { useAction, useLoad } from "../hooks";
import type { Team, User } from "../types";

function TeamDialog({ team, managers, teams, onClose, onSaved }: {
  team: Team | null; managers: User[]; teams: Team[]; onClose: () => void; onSaved: (t: Team) => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [department, setDepartment] = useState(team?.department ?? "");
  const [managerId, setManagerId] = useState<number | "">(team?.manager_id ?? "");
  const { busy, error, run } = useAction();
  const managing = (id: number) => teams.find((t) => t.manager_id === id && t.id !== team?.id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let saved: Team | undefined;
    const manager_id = managerId === "" ? null : managerId;
    const ok = await run(async () => {
      saved = team
        ? await api.updateTeam(team.id, { name, department, manager_id })
        : await api.createTeam({ name, department, manager_id });
    });
    if (ok && saved) onSaved(saved);
  }

  const chosen = managers.find((m) => m.id === managerId);
  return (
    <Modal title={team ? `Edit ${team.name}` : "Add team"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Team name" htmlFor="t-name"><input id="t-name" value={name} required onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Department (label)" htmlFor="t-dept"><input id="t-dept" value={department} onChange={(e) => setDepartment(e.target.value)} /></Field>
        <Field label="Manager" htmlFor="t-manager" hint="Only users with the Manager role. Without a manager, members can't submit leave or swaps.">
          <select id="t-manager" value={managerId} onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">No manager</option>
            {managers.map((m) => {
              const other = managing(m.id);
              return <option key={m.id} value={m.id} disabled={!!other}>{m.name}{other ? ` (manages ${other.name})` : m.team_name ? ` · ${m.team_name}` : ""}</option>;
            })}
          </select>
        </Field>
        {chosen && team && chosen.team_id !== team.id && (
          <Notice tone="warn">{chosen.name} moves into this team; their future shifts in {chosen.team_name} are released.</Notice>
        )}
        <ErrorBox error={error} />
        <div className="modal-foot">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : team ? "Save changes" : "Add team"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Teams() {
  const teams = useLoad(() => api.teams(), []);
  const users = useLoad(() => api.users(), []);
  const [editing, setEditing] = useState<Team | null | "new">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const managers = (users.data ?? []).filter((u) => u.role === "manager");

  return (
    <div className="page">
      <PageHeader title="Teams" subtitle="Each team has one manager, who approves its leave and swaps and builds its roster."
        actions={<button type="button" className="primary" disabled={!users.data} onClick={() => setEditing("new")}>Add team</button>} />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <Card>
        <ErrorBox error={teams.error} />
        {!teams.data ? <Loading /> : teams.data.length === 0 ? <Empty>No teams yet.</Empty> : (
          <TableWrap label="Teams">
            <table>
              <thead><tr><th>Team</th><th>Department</th><th>Manager</th><th className="num">Members</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {teams.data.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.department || "—"}</td>
                    <td>{t.manager_name ?? <StatusBadge status="gap" label="No manager" />}</td>
                    <td className="num">{t.member_count}</td>
                    <td className="actions">
                      <button type="button" className="small" disabled={!users.data} onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {editing !== null && teams.data && (
        <TeamDialog
          team={editing === "new" ? null : editing}
          managers={managers}
          teams={teams.data}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setEditing(null);
            setNotice(`${t.name} saved.`);
            void teams.reload();
            void users.reload();
          }}
        />
      )}
    </div>
  );
}
