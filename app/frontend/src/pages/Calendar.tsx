import { useMemo, useState } from "react";
import { ArrowLeftRight, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api";
import { useMe } from "../auth";
import { LeaveSheet } from "../components/LeaveSheet";
import { SwapSheet } from "../components/SwapSheet";
import { ErrorBox, Field, Loading, Modal, Notice, StatusBadge } from "../components/ui";
import { addDays, addMonths, formatDate, hasStarted, monthEnd, monthLabel, monthStart, range, weekStart } from "../dates";
import { useLoad } from "../hooks";
import { plural } from "../plain";
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

/** One day opened up: who is on each shift, who is away, and what you can do about it. */
function DayPanel({ date, cells, leaves, meId, canRequest, today, onSwap, onLeave, onClose }: {
  date: string; cells: CoverageCell[]; leaves: CalendarLeave[]; meId: number; canRequest: boolean; today: string;
  onSwap: (assignmentId: number) => void; onLeave: () => void; onClose: () => void;
}) {
  return (
    <Modal title={formatDate(date)} onClose={onClose}>
      <div className="day-panel">
        {cells.length === 0 && <p className="muted">No shifts are planned for this day.</p>}
        {cells.map((c) => {
          const mine = c.assigned.find((p) => p.user_id === meId);
          return (
            <div key={c.shift_template_id} className="shift-row">
              <div className="card-head" style={{ marginBottom: "0.2rem" }}>
                <strong>{c.shift_name} <span className="muted">{c.start_time}–{c.end_time}</span></strong>
                <span className={`badge ${c.gap ? "badge-bad" : "badge-ok"}`}>{c.headcount} of {c.min_headcount}{c.gap ? " · short" : ""}</span>
              </div>
              <div className="people">
                {c.assigned.length === 0 ? "Nobody rostered"
                  : c.assigned.map((p) => `${p.user_id === meId ? "You" : p.user_name}${p.leave_status ? " (on leave)" : ""}`).join(", ")}
              </div>
              {mine && !hasStarted(c.date, c.start_time, today) && (
                <button type="button" className="small" style={{ marginTop: "0.5rem" }} onClick={() => onSwap(mine.assignment_id)}>
                  <ArrowLeftRight size={16} aria-hidden="true" />Swap my {c.shift_name} shift
                </button>
              )}
            </div>
          );
        })}
        {leaves.length > 0 && (
          <div className="shift-row">
            <strong>Away</strong>
            <ul className="list">
              {leaves.map((l) => (
                <li key={l.id}><span>{l.user_id === meId ? "You" : l.user_name} · {l.leave_type}</span><StatusBadge status={l.status} /></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {canRequest && date >= today && (
        <div className="modal-foot">
          <button type="button" className="primary" onClick={onLeave}><CalendarPlus size={18} aria-hidden="true" />Request time off from this day</button>
        </div>
      )}
    </Modal>
  );
}

/** The spine of the app: shifts and leave on one month, for you or the whole team. Tap a day to act on it. */
export default function Calendar() {
  const me = useMe();
  const isHr = me.role === "hr_admin";
  const [month, setMonth] = useState(monthStart(me.today));
  const [teamId, setTeamId] = useState<number | "">(isHr ? "" : (me.team_id ?? ""));
  const [scope, setScope] = useState<"team" | "me">("team");
  const [day, setDay] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: "leave"; start: string } | { kind: "swap"; shiftId: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const gridStart = weekStart(month);
  const gridEnd = addDays(weekStart(monthEnd(month)), 6);
  const teams = useLoad(() => api.teams(), []);
  const cal = useLoad(() => api.calendar(gridStart, gridEnd, teamId === "" ? undefined : teamId), [gridStart, gridEnd, teamId]);
  const onlyMe = scope === "me" && !isHr;

  const byDay = useMemo(() => {
    const leaves = new Map<string, CalendarLeave[]>();
    const cells = new Map<string, CoverageCell[]>();
    for (const l of cal.data?.leaves ?? []) {
      if (onlyMe && l.user_id !== me.id) continue;
      for (const d of range(l.start_date > gridStart ? l.start_date : gridStart, l.end_date < gridEnd ? l.end_date : gridEnd)) {
        leaves.set(d, [...(leaves.get(d) ?? []), l]);
      }
    }
    for (const c of cal.data?.cells ?? []) {
      if (onlyMe && !c.assigned.some((p) => p.user_id === me.id)) continue;
      cells.set(c.date, [...(cells.get(c.date) ?? []), c]);
    }
    return { leaves, cells };
  }, [cal.data, onlyMe, me.id, gridStart, gridEnd]);

  const multiTeam = (cal.data?.teams.length ?? 0) > 1;
  const days = range(gridStart, gridEnd);
  const canRequest = !isHr;
  const year = Number(me.today.slice(0, 4));

  return (
    <div className="page">
      <div className="cal-bar">
        <div className="cal-nav">
          <button type="button" className="ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></button>
          <strong aria-live="polite">{monthLabel(month)}</strong>
          <button type="button" className="ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight aria-hidden="true" /></button>
          <button type="button" className="small" onClick={() => setMonth(monthStart(me.today))}>Today</button>
        </div>
        <div className="row-actions">
          {isHr ? (
            <Field label="Team" htmlFor="cal-team">
              <select id="cal-team" value={teamId} onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">All teams</option>
                {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          ) : (
            <div className="tabs" role="group" aria-label="Whose calendar" style={{ marginBottom: 0 }}>
              <button type="button" aria-selected={scope === "team"} onClick={() => setScope("team")}>Team</button>
              <button type="button" aria-selected={scope === "me"} onClick={() => setScope("me")}>Just me</button>
            </div>
          )}
          {canRequest && (
            <button type="button" className="primary" onClick={() => setSheet({ kind: "leave", start: "" })}>
              <CalendarPlus size={18} aria-hidden="true" />Request time off
            </button>
          )}
        </div>
      </div>
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={cal.error} />
      {!cal.data ? <Loading /> : (
        <>
          <div className="calendar" role="grid" aria-label={`Calendar for ${monthLabel(month)}`}>
            {DOW.map((d) => <div key={d} className="dow" role="columnheader">{d}</div>)}
            {days.map((d) => {
              const leaves = byDay.leaves.get(d) ?? [];
              const cells = byDay.cells.get(d) ?? [];
              const gap = d >= me.today && cells.some((c) => c.gap); // a past shortfall can't be acted on
              const mineHere = (cal.data?.cells ?? []).some((c) => c.date === d && c.assigned.some((p) => p.user_id === me.id && !p.leave_status));
              const outside = d.slice(0, 7) !== month.slice(0, 7);
              return (
                <div
                  key={d}
                  role="gridcell"
                  tabIndex={0}
                  data-testid={`day-${d}`}
                  aria-label={`${formatDate(d)}${gap ? ", coverage gap" : ""}${mineHere ? ", you are working" : ""}. Open day`}
                  className={`day${outside ? " outside" : ""}${d === me.today ? " today" : ""}${gap ? " has-gap" : ""}${mineHere ? " mine" : ""}`}
                  onClick={() => setDay(d)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDay(d); } }}
                >
                  <div className="day-num">
                    <span>{Number(d.slice(8))}</span>
                    {gap && <span className="badge badge-bad" style={{ padding: "0 0.4rem" }}>short</span>}
                  </div>
                  {leaves.map((l) => (
                    <div key={l.id} className={`leave-chip ${l.status}`} title={`${l.user_name}: ${l.leave_type} (${l.status})`}>
                      {l.user_id === me.id ? "You" : l.user_name}{l.status === "pending" ? " (pending)" : ""}
                    </div>
                  ))}
                  {multiTeam
                    ? teamSummaries(cells).map((t) => (
                      <div key={t.team} className={`cov-line${t.short ? " gap" : ""}`} title={t.detail}>
                        <span>{t.team}</span><span>{t.short ? `${t.short} short` : "OK"}</span>
                      </div>
                    ))
                    : cells.map((c) => {
                      const me_ = c.assigned.some((p) => p.user_id === me.id);
                      return (
                        <div key={c.shift_template_id} className={`cov-line${c.gap && d >= me.today ? " gap" : ""}${me_ ? " me" : ""}`}
                          data-testid={`cell-${c.shift_template_id}-${c.date}`}
                          title={`${c.shift_name}: ${c.assigned.map((p) => p.user_name).join(", ") || "nobody"}`}>
                          <span>{c.shift_name}{me_ ? " ·you" : ""}</span><span>{c.headcount}/{c.min_headcount}</span>
                        </div>
                      );
                    })}
                  <div className="dots" aria-hidden="true">
                    {mineHere && <span className="dot mine" />}
                    {leaves.map((l) => <span key={l.id} className={`dot ${l.status}`} />)}
                    {d >= me.today && cells.filter((c) => c.gap).map((c) => <span key={c.shift_template_id} className="dot gap" />)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><span className="leave-chip approved">Approved leave</span></span>
            <span><span className="leave-chip pending">Pending leave</span></span>
            <span>{multiTeam ? "One line per team" : "Shift: people / minimum"}</span>
            <span><span className="badge badge-bad">short</span> a shift is below its minimum</span>
            <span>Orange bar: you are working</span>
          </div>
        </>
      )}

      {day && !sheet && cal.data && (
        <DayPanel
          date={day}
          cells={(cal.data.cells).filter((c) => c.date === day)}
          leaves={(cal.data.leaves).filter((l) => l.start_date <= day && l.end_date >= day)}
          meId={me.id}
          canRequest={canRequest}
          today={me.today}
          onSwap={(shiftId) => setSheet({ kind: "swap", shiftId })}
          onLeave={() => setSheet({ kind: "leave", start: day })}
          onClose={() => setDay(null)}
        />
      )}
      {sheet?.kind === "leave" && (
        <LeaveSheet initialStart={sheet.start || undefined} onClose={() => setSheet(null)} onDone={(r) => {
          setSheet(null);
          setDay(null);
          setNotice(`Request sent for ${formatDate(r.start_date, year)}${r.end_date !== r.start_date ? ` – ${formatDate(r.end_date, year)}` : ""} (${plural(r.days, "day")}).`);
          void cal.reload();
        }} />
      )}
      {sheet?.kind === "swap" && (
        <SwapSheet initialShiftId={sheet.shiftId} onClose={() => setSheet(null)} onDone={(s) => {
          setSheet(null);
          setDay(null);
          setNotice(`Asked ${s.target_name} to swap. They answer first, then it goes for approval.`);
          void cal.reload();
        }} />
      )}
    </div>
  );
}
