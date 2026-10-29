import { useMemo, useState } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { Card, ErrorBox, Field, Loading, PageHeader } from "../components/ui";
import { addDays, addMonths, formatDate, monthEnd, monthLabel, monthStart, range, weekStart } from "../dates";
import { useLoad } from "../hooks";
import type { CalendarLeave, CoverageCell } from "../types";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** With several teams in view, one line per team: how many of its shifts are below minimum that day. */
function teamSummaries(cells: CoverageCell[]): { team: string; short: number; detail: string }[] {
  const byTeam = new Map<string, CoverageCell[]>();
  for (const c of cells) byTeam.set(c.team_name, [...(byTeam.get(c.team_name) ?? []), c]);
  return Array.from(byTeam, ([team, list]) => ({
    team,
    short: list.filter((c) => c.gap).length,
    detail: list.map((c) => `${c.shift_name} ${c.headcount}/${c.min_headcount}`).join(", "),
  }));
}

export default function Calendar() {
  const me = useMe();
  const isHr = me.role === "hr_admin";
  const [month, setMonth] = useState(monthStart(me.today));
  const [teamId, setTeamId] = useState<number | "">(isHr ? "" : (me.team_id ?? ""));
  const [person, setPerson] = useState<number | "">("");
  const [showLeave, setShowLeave] = useState(true);
  const [showShifts, setShowShifts] = useState(true);

  const gridStart = weekStart(month);
  const gridEnd = addDays(weekStart(monthEnd(month)), 6);
  const teams = useLoad(() => api.teams(), []);
  const cal = useLoad(() => api.calendar(gridStart, gridEnd, teamId === "" ? undefined : teamId), [gridStart, gridEnd, teamId]);

  const byDay = useMemo(() => {
    const leaves = new Map<string, CalendarLeave[]>();
    const cells = new Map<string, CoverageCell[]>();
    for (const l of cal.data?.leaves ?? []) {
      if (person !== "" && l.user_id !== person) continue;
      for (const d of range(l.start_date > gridStart ? l.start_date : gridStart, l.end_date < gridEnd ? l.end_date : gridEnd)) {
        leaves.set(d, [...(leaves.get(d) ?? []), l]);
      }
    }
    for (const c of cal.data?.cells ?? []) {
      if (person !== "" && !c.assigned.some((p) => p.user_id === person)) continue;
      cells.set(c.date, [...(cells.get(c.date) ?? []), c]);
    }
    return { leaves, cells };
  }, [cal.data, person, gridStart, gridEnd]);

  const multiTeam = (cal.data?.teams.length ?? 0) > 1;
  const days = range(gridStart, gridEnd);

  return (
    <div className="page">
      <PageHeader
        title="Team calendar"
        subtitle="Leave and shift coverage together. A red day has at least one shift below its minimum."
        actions={
          <div className="row-actions">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">←</button>
            <strong aria-live="polite" style={{ minWidth: "9rem", textAlign: "center" }}>{monthLabel(month)}</strong>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">→</button>
            <button type="button" onClick={() => setMonth(monthStart(me.today))}>Today</button>
          </div>
        }
      />
      <Card>
        <div className="inline-form">
          <Field label="Team" htmlFor="cal-team">
            <select id="cal-team" value={teamId} disabled={!isHr}
              onChange={(e) => { setTeamId(e.target.value ? Number(e.target.value) : ""); setPerson(""); }}>
              {isHr && <option value="">All teams</option>}
              {(teams.data ?? []).filter((t) => isHr || t.id === me.team_id).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Person" htmlFor="cal-person">
            <select id="cal-person" value={person} onChange={(e) => setPerson(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Everyone</option>
              {(cal.data?.members ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <label className="check"><input type="checkbox" checked={showLeave} onChange={(e) => setShowLeave(e.target.checked)} /> Show leave</label>
          <label className="check"><input type="checkbox" checked={showShifts} onChange={(e) => setShowShifts(e.target.checked)} /> Show shifts</label>
        </div>
        <div className="legend" style={{ marginTop: "0.5rem" }}>
          <span><span className="leave-chip approved">Approved leave</span></span>
          <span><span className="leave-chip pending">Pending leave</span></span>
          <span>{multiTeam ? "One line per team: shifts below minimum" : "Shift lines: people counted / minimum"}</span>
          <span className="cov-line gap">Below minimum ⚠</span>
        </div>
      </Card>
      <ErrorBox error={cal.error} />
      {!cal.data ? <Loading /> : (
        <div className="calendar" role="grid" aria-label={`Calendar for ${monthLabel(month)}`} style={{ marginTop: "1rem" }}>
          {DOW.map((d) => <div key={d} className="dow" role="columnheader">{d}</div>)}
          {days.map((d) => {
            const leaves = showLeave ? byDay.leaves.get(d) ?? [] : [];
            const cells = showShifts ? byDay.cells.get(d) ?? [] : [];
            const gap = (byDay.cells.get(d) ?? []).some((c) => c.gap);
            const outside = d.slice(0, 7) !== month.slice(0, 7);
            return (
              <div
                key={d}
                role="gridcell"
                data-testid={`day-${d}`}
                aria-label={`${formatDate(d)}${gap ? ", coverage gap" : ""}`}
                className={`day${outside ? " outside" : ""}${d === me.today ? " today" : ""}${gap && showShifts ? " has-gap" : ""}`}
              >
                <div className="day-num">
                  <span>{Number(d.slice(8))}</span>
                  {gap && showShifts && <span title="A shift is below minimum" aria-hidden="true">⚠</span>}
                </div>
                {leaves.map((l) => (
                  <div key={l.id} className={`leave-chip ${l.status}`}
                    title={`${l.user_name}: ${l.leave_type} (${l.status})`}>
                    {l.user_name}{l.status === "pending" ? " (pending)" : ""}
                  </div>
                ))}
                {multiTeam
                  ? teamSummaries(cells).map((t) => (
                    <div key={t.team} className={`cov-line${t.short ? " gap" : ""}`} title={t.detail}>
                      <span>{t.team}</span>
                      <span>{t.short ? `${t.short} short ⚠` : "OK"}</span>
                    </div>
                  ))
                  : cells.map((c) => (
                    <div key={c.shift_template_id} className={`cov-line${c.gap ? " gap" : ""}`} data-testid={`cell-${c.shift_template_id}-${c.date}`}
                      title={`${c.shift_name}: ${c.assigned.map((p) => p.user_name).join(", ") || "nobody"}`}>
                      <span>{c.shift_name}</span>
                      <span>{c.headcount}/{c.min_headcount}{c.gap ? " ⚠" : ""}</span>
                    </div>
                  ))}
                <div className="dots" aria-hidden="true">
                  {leaves.map((l) => <span key={l.id} className={`dot ${l.status}`} />)}
                  {cells.filter((c) => c.gap).map((c) => <span key={c.shift_template_id} className="dot gap" />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
