import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { Card, ConfirmDialog, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { formatDate, formatDayMonth } from "../dates";
import { useAction, useLoad } from "../hooks";
import type { Role, Team, User } from "../types";

const ROLES: { value: Role; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_admin", label: "HR Admin" },
];

function UserDialog({ user, teams, isSelf, today, onClose, onSaved }: {
  user: User | null; teams: Team[]; isSelf: boolean; today: string; onClose: () => void; onSaved: (u: User, created: boolean) => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "employee");
  const [teamId, setTeamId] = useState<number | "">(user?.team_id ?? teams[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [born, setBorn] = useState(user?.date_of_birth ?? "");
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const team_id = role === "hr_admin" ? null : (teamId === "" ? null : teamId);
    let saved: User | undefined;
    const ok = await run(async () => {
      if (user) {
        const changes: Parameters<typeof api.updateUser>[1] = { name, email, team_id };
        if (role !== user.role) changes.role = role;
        if (password) changes.password = password;
        if (role !== "hr_admin" && born !== (user.date_of_birth ?? "")) changes.date_of_birth = born || null;
        saved = await api.updateUser(user.id, changes);
      } else {
        saved = await api.createUser({
          name, email, role, team_id, password, ...(joinDate ? { join_date: joinDate } : {}),
          ...(born && role !== "hr_admin" ? { date_of_birth: born } : {}),
        });
      }
    });
    if (ok && saved) onSaved(saved, !user);
  }

  return (
    <Modal title={user ? `Edit ${user.name}` : "Add user"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name" htmlFor="u-name"><input id="u-name" value={name} required onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" htmlFor="u-email"><input id="u-email" type="email" value={email} required onChange={(e) => setEmail(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="Role" htmlFor="u-role" hint={isSelf ? "You can't change your own role." : undefined}>
            <select id="u-role" value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Team" htmlFor="u-team" hint={role === "hr_admin" ? "HR Admins don't belong to a team." : undefined}>
            <select id="u-team" value={role === "hr_admin" ? "" : teamId} disabled={role === "hr_admin"}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}>
              {role === "hr_admin" && <option value="">—</option>}
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        {role !== "hr_admin" && (
          <Field label="Date of birth" htmlFor="u-born" hint="They get a bonus Casual Leave day on their birthday. Only HR can see this.">
            <input id="u-born" type="date" value={born} max={today} onChange={(e) => setBorn(e.target.value)} />
          </Field>
        )}
        {!user && (
          <Field label="Join date" htmlFor="u-join" hint="Accrual starts in this month. Defaults to today.">
            <input id="u-join" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </Field>
        )}
        <Field label={user ? "New password (optional)" : "Initial password"} htmlFor="u-password"
          hint={user ? "Setting a password signs the user out everywhere." : "At least 8 characters."}>
          <input id="u-password" type="password" autoComplete="new-password" value={password} required={!user} minLength={8}
            onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {user && user.team_id !== null && role !== "hr_admin" && teamId !== user.team_id && (
          <Notice tone="warn">Moving to another team releases this person's future shifts in {user.team_name}.</Notice>
        )}
        <ErrorBox error={error} />
        <div className="modal-foot">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : user ? "Save changes" : "Add user"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const [teamFilter, setTeamFilter] = useState<number | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const teams = useLoad(() => api.teams(), []);
  const users = useLoad(
    () => api.users({ include_inactive: showInactive, team_id: teamFilter === "" ? undefined : teamFilter }),
    [showInactive, teamFilter],
  );
  const [editing, setEditing] = useState<User | null | "new">(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deactivate = useAction();

  return (
    <div className="page">
      <PageHeader title="Users" subtitle="Add people, change their role or team, and deactivate leavers."
        actions={<button type="button" className="primary" disabled={!teams.data} onClick={() => setEditing("new")}>Add user</button>} />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <Card>
        <div className="inline-form" style={{ marginBottom: "0.75rem" }}>
          <Field label="Team" htmlFor="filter-team">
            <select id="filter-team" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : "")}>
              <option value="">All teams</option>
              {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show deactivated</label>
        </div>
        <ErrorBox error={users.error} />
        {!users.data ? <Loading /> : users.data.length === 0 ? <Empty>No users match.</Empty> : (
          <TableWrap label="Users">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Joined</th><th>Birthday</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="small">{u.email}</td>
                    <td>{ROLES.find((r) => r.value === u.role)?.label}</td>
                    <td>{u.team_name ?? "—"}</td>
                    <td className="nowrap">{formatDate(u.join_date, year)}</td>
                    <td className="nowrap">{u.date_of_birth ? formatDayMonth(u.date_of_birth) : "—"}</td>
                    <td><StatusBadge status={u.active ? "active" : "inactive"} /></td>
                    <td className="actions">
                      {u.active && (
                        <>
                          <button type="button" className="small" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>Edit</button>
                          {u.id !== me.id && (
                            <button type="button" className="small" onClick={() => { deactivate.setError(null); setRemoving(u); }}
                              aria-label={`Deactivate ${u.name}`}>Deactivate</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {editing !== null && teams.data && (
        <UserDialog
          user={editing === "new" ? null : editing}
          teams={teams.data}
          isSelf={editing !== "new" && editing.id === me.id}
          today={me.today}
          onClose={() => setEditing(null)}
          onSaved={(u, created) => {
            setEditing(null);
            setNotice(created ? `${u.name} was added. They can sign in with the password you set.` : `${u.name} was updated.`);
            void users.reload();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Deactivate ${removing.name}?`}
          message={<p>They won't be able to sign in. Their future shifts are released, pending leave and open swaps are cancelled. History is kept.</p>}
          confirmLabel="Deactivate"
          danger
          busy={deactivate.busy}
          error={deactivate.error}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const target = removing;
            if (await deactivate.run(() => api.deactivateUser(target.id))) {
              setRemoving(null);
              setNotice(`${target.name} was deactivated.`);
              void users.reload();
            }
          }}
        />
      )}
    </div>
  );
}
