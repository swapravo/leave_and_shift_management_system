import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { Card, Empty, ErrorBox, Field, Loading, Notice, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { addDays, formatDate, overlaps, range, weekStart } from "../dates";
import { useAction, useLoad } from "../hooks";
import type { CopyWeekResult, CoverageCell, Member, RosterView, ShiftTemplate } from "../types";

function AddPerson({ cell, members, view, busy, onAdd }: {
  cell: CoverageCell; members: Member[]; view: RosterView; busy: boolean; onAdd: (userId: number) => void;
}) {
  const [userId, setUserId] = useState<number | "">("");
  const assigned = new Set(cell.assigned.map((p) => p.user_id));
  const onLeave = (id: number) => view.leaves.find((l) => l.user_id === id && overlaps(l.start_date, l.end_date, cell.date, cell.date));
  const label = `${cell.shift_name} ${formatDate(cell.date)}`;
  return (
    <div className="cell-add">
      <select aria-label={`Add person to ${label}`} value={userId} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Add…</option>
        {members.filter((m) => !assigned.has(m.id)).map((m) => {
          const leave = onLeave(m.id);
          return (
            <option key={m.id} value={m.id} disabled={!!leave}>
              {m.name}{leave ? ` (${leave.status} leave)` : ""}
            </option>
          );
        })}
      </select>
      <button type="button" className="small" disabled={busy || userId === ""} aria-label={`Assign to ${label}`}
        onClick={() => { if (userId !== "") { onAdd(userId); setUserId(""); } }}>+</button>
    </div>
  );
}

function Cell({ cell, view, today, busy, onAdd, onRemove }: {
  cell: CoverageCell | undefined; view: RosterView; today: string; busy: boolean;
  onAdd: (cell: CoverageCell, userId: number) => void; onRemove: (assignmentId: number, name: string) => void;
}) {
  if (!cell) return <td className="roster-cell past"><span className="muted small">Not scheduled</span></td>;
  const past = cell.date < today;
  return (
    <td className={`roster-cell${cell.gap ? " gap" : ""}${past ? " past" : ""}`} data-testid={`cell-${cell.shift_template_id}-${cell.date}`}>
      <div className="count">
        <span aria-label={`${cell.headcount} of ${cell.min_headcount} needed`}>{cell.headcount} / {cell.min_headcount}</span>
        {cell.gap ? <StatusBadge status="gap" label="Short" /> : <StatusBadge status="ok" label="OK" />}
      </div>
      {cell.assigned.map((p) => (
        <div key={p.assignment_id} className={`chip${p.leave_status ? " on-leave" : ""}`}>
          <span title={p.leave_status ? `On ${p.leave_status} leave: not counted` : undefined}>
            {p.user_name}{p.leave_status ? ` (${p.leave_status} leave)` : ""}
          </span>
          {!past && (
            <button type="button" className="ghost" disabled={busy} aria-label={`Remove ${p.user_name} from ${cell.shift_name} ${formatDate(cell.date)}`}
              onClick={() => onRemove(p.assignment_id, p.user_name)}>×</button>
          )}
        </div>
      ))}
      {!past && <AddPerson cell={cell} members={view.members} view={view} busy={busy} onAdd={(u) => onAdd(cell, u)} />}
    </td>
  );
}

export default function Roster() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const teams = useLoad(() => api.teams(), []);
  const myTeams = useMemo(
    () => (teams.data ?? []).filter((t) => me.role === "hr_admin" || t.id === me.managed_team_id),
    [teams.data, me.role, me.managed_team_id],
  );
  const [teamId, setTeamId] = useState<number | null>(null);
  const [start, setStart] = useState(weekStart(me.today));
  const end = addDays(start, 6);
  useEffect(() => {
    if (teamId === null && myTeams.length) setTeamId(myTeams[0].id);
  }, [myTeams, teamId]);

  const view = useLoad(() => (teamId === null ? Promise.resolve(undefined) : api.roster(teamId, start, end)), [teamId, start, end]);
  const act = useAction();
  const [copyResult, setCopyResult] = useState<CopyWeekResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dates = range(start, end);
  const cellMap = useMemo(() => {
    const m = new Map<string, CoverageCell>();
    for (const c of view.data?.cells ?? []) m.set(`${c.shift_template_id}|${c.date}`, c);
    return m;
  }, [view.data]);
  const rows: ShiftTemplate[] = view.data?.templates ?? [];

  async function add(cell: CoverageCell, userId: number) {
    setNotice(null);
    const name = view.data?.members.find((m) => m.id === userId)?.name ?? "";
    if (await act.run(() => api.assign(cell.shift_template_id, userId, cell.date))) {
      setNotice(`${name} added to ${cell.shift_name} on ${formatDate(cell.date, year)}.`);
      void view.reload();
    }
  }

  async function remove(assignmentId: number, name: string) {
    setNotice(null);
    if (await act.run(() => api.unassign(assignmentId))) {
      setNotice(`${name} removed.`);
      void view.reload();
    }
  }

  async function copyWeek() {
    if (teamId === null) return;
    setNotice(null);
    setCopyResult(null);
    await act.run(async () => {
      setCopyResult(await api.copyWeek(teamId, start));
    });
    void view.reload();
  }

  if (teams.data && myTeams.length === 0) {
    return <div className="page"><PageHeader title="Roster builder" /><Empty>You don't manage a team yet.</Empty></div>;
  }

  return (
    <div className="page">
      <PageHeader
        title="Roster builder"
        subtitle="Each cell shows people counted against the shift's minimum. People on leave are not counted. Past days are read-only."
      />
      <Card>
        <div className="inline-form">
          <Field label="Team" htmlFor="roster-team">
            <select id="roster-team" value={teamId ?? ""} onChange={(e) => { setTeamId(Number(e.target.value)); setCopyResult(null); }}>
              {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Week starting" htmlFor="roster-week">
            <input id="roster-week" type="date" value={start} onChange={(e) => e.target.value && setStart(weekStart(e.target.value))} />
          </Field>
          <div className="row-actions">
            <button type="button" onClick={() => setStart(addDays(start, -7))}>← Previous week</button>
            <button type="button" onClick={() => setStart(weekStart(me.today))}>This week</button>
            <button type="button" onClick={() => setStart(addDays(start, 7))}>Next week →</button>
            <button type="button" className="primary" disabled={act.busy || end < me.today} onClick={copyWeek}>
              Copy previous week
            </button>
          </div>
        </div>
      </Card>
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={act.error} />
      {copyResult && (
        <div className="alert alert-info" role="status">
          Copied {copyResult.copied} assignment{copyResult.copied === 1 ? "" : "s"} from the previous week.
          {copyResult.skipped.length > 0 && (
            <>
              {" "}Skipped {copyResult.skipped.length}:
              <ul>{copyResult.skipped.map((s) => <li key={s}>{s}</li>)}</ul>
            </>
          )}
        </div>
      )}
      <ErrorBox error={view.error} />
      {!view.data ? <Loading /> : rows.length === 0 ? <Empty>This team has no active shift templates yet.</Empty> : (
        <Card>
          <TableWrap label="Roster grid">
            <table className="roster-grid">
              <thead>
                <tr>
                  <th scope="col">Shift</th>
                  {dates.map((d) => (
                    <th key={d} scope="col" className={d === me.today ? "is-today" : undefined}>
                      {formatDate(d)}{d === me.today ? " · today" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <th scope="row">
                      {t.name}
                      <div className="muted small">{t.start_time}–{t.end_time} · min {t.min_headcount}</div>
                    </th>
                    {dates.map((d) => (
                      <Cell key={d} cell={cellMap.get(`${t.id}|${d}`)} view={view.data!} today={me.today} busy={act.busy}
                        onAdd={add} onRemove={remove} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          {view.data.leaves.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <h3>Leave this week</h3>
              <ul className="list">
                {view.data.leaves.map((l) => (
                  <li key={l.id}>
                    <span>{l.user_name} · {l.leave_type} · {formatDate(l.start_date, year)}{l.end_date !== l.start_date ? ` – ${formatDate(l.end_date, year)}` : ""}</span>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
