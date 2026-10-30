import { useState } from "react";
import { ArrowLeftRight, CalendarPlus, LayoutGrid } from "lucide-react";
import { Link } from "react-router";
import { api } from "../api";
import { useMe } from "../auth";
import { LeaveCard, SwapCard, useDecisions } from "../components/decisions";
import { LeaveSheet } from "../components/LeaveSheet";
import { SwapSheet } from "../components/SwapSheet";
import { useSwapActions } from "../components/swapActions";
import { Empty, ErrorBox, Loading, Notice } from "../components/ui";
import { addDays, formatDate, formatDays, formatRange, hasStarted, istTimeNow } from "../dates";
import { useLoad } from "../hooks";
import { leaveStatusText, plural } from "../plain";
import type { CoverageCell, Role } from "../types";

const firstName = (name: string) => name.split(" ")[0];

function greeting(): string {
  const hour = Number(istTimeNow().slice(0, 2));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function dayWord(date: string, today: string): string {
  return date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : formatDate(date);
}

function GapList({ cells, year }: { cells: CoverageCell[]; year: number }) {
  if (!cells.length) return <Empty>No coverage gaps. Every shift has enough people.</Empty>;
  return (
    <ul className="list">
      {cells.map((c) => (
        <li key={`${c.shift_template_id}-${c.date}`}>
          <div>
            <strong>{c.shift_name}</strong> · {formatDate(c.date, year)} ({c.start_time}–{c.end_time})
            <div className="meta">{c.team_name}</div>
          </div>
          <span className="badge badge-bad">{c.headcount} of {c.min_headcount}</span>
        </li>
      ))}
    </ul>
  );
}


/** Employees and managers: the next shift, two big actions, balances and anything waiting on you. */
function PeopleHome() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const isManager = me.role === "manager";
  const [sheet, setSheet] = useState<"leave" | "swap" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = useLoad(async () => {
    const [shifts, balances, swaps, leave, teams, dash] = await Promise.all([
      api.myShifts({ start: me.today, end: addDays(me.today, 27) }),
      api.balances(),
      api.swaps(),
      api.leaveRequests("mine"),
      api.teams(),
      isManager ? api.dashboard() : Promise.resolve(null),
    ]);
    return { shifts, balances, swaps, leave, teams, dash };
  }, [me.today, isManager]);
  const { open, dialog } = useDecisions(() => void data.reload());
  const swapActions = useSwapActions((m) => { setNotice(m); void data.reload(); });

  const d = data.data;
  const next = d?.shifts.find((s) => !hasStarted(s.date, s.start_time, me.today));
  const approver = isManager ? "HR Admin" : d?.teams.find((t) => t.id === me.team_id)?.manager_name ?? null;
  const offers = d?.swaps.filter((s) => s.can_respond) ?? [];
  const pendingLeave = d?.leave.filter((r) => r.status === "pending") ?? [];
  const mySwaps = d?.swaps.filter((s) => (s.requester_id === me.id) && (s.status === "pending_peer" || s.status === "pending_manager")) ?? [];
  const nextLeave = d?.leave.find((r) => r.status === "approved" && r.end_date >= me.today);
  const decisionsCount = (d?.dash?.pending_leave.length ?? 0) + (d?.dash?.pending_swaps.length ?? 0);

  return (
    <div className="page">
      <div className="hello">
        <h1>{greeting()}, {firstName(me.name)}</h1>
        <p className="muted">{formatDate(me.today)} {year}{me.team_name ? ` · ${me.team_name}` : ""}</p>
      </div>
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={data.error} />
      {swapActions.error}
      {!d ? <Loading /> : (
        <div className="stack">
          {next ? (
            <section className="hero-card" aria-label="Your next shift">
              <div className="eyebrow">Your next shift</div>
              <div className="big">{dayWord(next.date, me.today)} · {next.shift_name}</div>
              <div>{next.start_time}–{next.end_time}{next.end_time <= next.start_time ? " (ends next day)" : ""} · {next.team_name}</div>
            </section>
          ) : isManager ? null : (
            <section className="hero-card quiet" aria-label="Your next shift">
              <div className="eyebrow muted">Your next shift</div>
              <div className="big">Nothing in the next four weeks</div>
              <div className="muted">{nextLeave ? `You're on leave ${formatRange(nextLeave.start_date, nextLeave.end_date, year)}.` : "Enjoy the time."}</div>
            </section>
          )}

          <div className="actions-row">
            <button type="button" className="action-tile" onClick={() => setSheet("leave")}>
              <span className="tile-icon"><CalendarPlus size={22} aria-hidden="true" /></span>
              <span>Request time off<small>Pick dates, see your balance</small></span>
            </button>
            {next && (
              <button type="button" className="action-tile" onClick={() => setSheet("swap")}>
                <span className="tile-icon"><ArrowLeftRight size={22} aria-hidden="true" /></span>
                <span>Swap a shift<small>Trade with a teammate</small></span>
              </button>
            )}
            {isManager && (
              <Link className="button action-tile" to="/roster">
                <span className="tile-icon"><LayoutGrid size={22} aria-hidden="true" /></span>
                <span>Build the roster<small>Assign people to shifts</small></span>
              </Link>
            )}
          </div>

          {d.balances.some((b) => b.active) && (
            <section aria-label="Leave balances">
              <div className="section-title"><h2>Your leave</h2><Link to="/requests" className="small">Details</Link></div>
              <div className="chips">
                {d.balances.filter((b) => b.active).map((b) => (
                  <span key={b.leave_type_id} className="balance-chip">
                    <span className="n">{formatDays(b.available)}</span>
                    <span>{b.leave_type} left</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {offers.length > 0 && (
            <section aria-label="Swap offers for you">
              <div className="section-title"><h2>Waiting for your answer</h2></div>
              {offers.map((s) => <SwapCard key={s.id} s={s} meId={me.id} year={year} actions={swapActions.buttons(s)} />)}
            </section>
          )}

          {isManager && d.dash && (
            <section aria-label="Needs your decision">
              <div className="section-title">
                <h2>Needs your decision{decisionsCount ? ` (${decisionsCount})` : ""}</h2>
                <Link to="/inbox" className="small">Open inbox</Link>
              </div>
              {decisionsCount === 0 ? <Empty>All caught up. Nothing is waiting for you.</Empty> : (
                <>
                  {d.dash.pending_leave.slice(0, 3).map((r) => (
                    <LeaveCard key={r.id} r={r} year={year} onDecide={(approve) => open({ kind: "leave", item: r, approve })} />
                  ))}
                  {d.dash.pending_swaps.slice(0, 3).map((s) => (
                    <SwapCard key={s.id} s={s} meId={me.id} year={year} onDecide={(approve) => open({ kind: "swap", item: s, approve })} />
                  ))}
                </>
              )}
              <div className="section-title"><h2>Coverage today</h2></div>
              <GapList cells={d.dash.gaps_today} year={year} />
            </section>
          )}

          {(pendingLeave.length > 0 || mySwaps.length > 0) && (
            <section aria-label="Your open requests">
              <div className="section-title"><h2>Your open requests</h2><Link to="/requests" className="small">All requests</Link></div>
              {pendingLeave.slice(0, 3).map((r) => (
                <div key={r.id} className="item-card">
                  <div>
                    <div className="title">{r.leave_type} · {formatRange(r.start_date, r.end_date, year)}</div>
                    <div className="meta">{plural(r.days, "day")} · {leaveStatusText(r, approver)}</div>
                  </div>
                </div>
              ))}
              {mySwaps.slice(0, 3).map((s) => <SwapCard key={s.id} s={s} meId={me.id} year={year} />)}
            </section>
          )}
        </div>
      )}
      {sheet === "leave" && (
        <LeaveSheet onClose={() => setSheet(null)} onDone={(r) => {
          setSheet(null);
          setNotice(`Request sent for ${formatRange(r.start_date, r.end_date, year)} (${plural(r.days, "day")}). ${approver ? `${approver} will decide.` : "It's waiting for approval."}`);
          void data.reload();
        }} />
      )}
      {sheet === "swap" && (
        <SwapSheet onClose={() => setSheet(null)} onDone={(s) => {
          setSheet(null);
          setNotice(`Asked ${s.target_name} to swap. They answer first, then it goes for approval.`);
          void data.reload();
        }} />
      )}
      {dialog}
    </div>
  );
}

/** HR: what needs a decision, where cover is short, and whether the setup is complete. */
function HrHome() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const data = useLoad(async () => {
    const [dash, teams, users] = await Promise.all([api.dashboard(), api.teams(), api.users()]);
    return { dash, teams, users };
  }, []);
  const { open, dialog } = useDecisions(() => void data.reload());
  const d = data.data;
  const noManager = d?.teams.filter((t) => t.manager_id === null) ?? [];
  const noTeam = d?.users.filter((u) => u.role !== "hr_admin" && u.team_id === null) ?? [];
  const decisions = (d?.dash.pending_leave.length ?? 0) + (d?.dash.pending_swaps.length ?? 0);

  return (
    <div className="page">
      <div className="hello">
        <h1>{greeting()}, {firstName(me.name)}</h1>
        <p className="muted">{formatDate(me.today)} {year} · Company overview</p>
      </div>
      <ErrorBox error={data.error} />
      {!d ? <Loading /> : (
        <div className="stack">
          <div className="stat-row">
            <div className={`stat${d.dash.gaps_today.length ? " alert-stat" : ""}`}><span className="value">{d.dash.gaps_today.length}</span><span className="label">Coverage gaps today</span></div>
            <div className="stat"><span className="value">{decisions}</span><span className="label">Waiting for you</span></div>
            <div className="stat"><span className="value">{d.dash.availability.filter((a) => a.status === "on_shift").length}</span><span className="label">On shift today</span></div>
            <div className="stat"><span className="value">{d.dash.availability.filter((a) => a.status === "on_leave").length}</span><span className="label">On leave today</span></div>
          </div>

          <section aria-label="Needs your decision">
            <div className="section-title"><h2>Needs your decision</h2><Link to="/inbox" className="small">Open inbox</Link></div>
            {decisions === 0 ? <Empty>All caught up. Nothing is waiting for you.</Empty> : (
              <>
                {d.dash.pending_leave.slice(0, 4).map((r) => (
                  <LeaveCard key={r.id} r={r} year={year} onDecide={(approve) => open({ kind: "leave", item: r, approve })} />
                ))}
                {d.dash.pending_swaps.slice(0, 4).map((s) => (
                  <SwapCard key={s.id} s={s} meId={me.id} year={year} onDecide={(approve) => open({ kind: "swap", item: s, approve })} />
                ))}
              </>
            )}
          </section>

          <section aria-label="Coverage">
            <div className="section-title"><h2>Coverage gaps, next 7 days</h2><Link to="/calendar" className="small">Open calendar</Link></div>
            <GapList cells={d.dash.upcoming_gaps} year={year} />
          </section>

          <section aria-label="Setup">
            <div className="section-title"><h2>Setup check</h2></div>
            {noManager.length === 0 && noTeam.length === 0 ? (
              <Notice tone="ok">Every team has a manager and everyone is on a team.</Notice>
            ) : (
              <>
                {noManager.length > 0 && (
                  <div className="item-card needs">
                    <div><div className="title">{noManager.length} team{noManager.length === 1 ? " has" : "s have"} no manager</div>
                      <div className="meta">{noManager.map((t) => t.name).join(", ")}. Their leave and swaps can't be approved.</div></div>
                    <Link className="button" to="/settings/teams">Fix in Teams</Link>
                  </div>
                )}
                {noTeam.length > 0 && (
                  <div className="item-card needs">
                    <div><div className="title">{noTeam.length} {noTeam.length === 1 ? "person isn't" : "people aren't"} on a team</div>
                      <div className="meta">{noTeam.map((u) => u.name).join(", ")}</div></div>
                    <Link className="button" to="/settings/users">Fix in Users</Link>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {dialog}
    </div>
  );
}

export default function Home() {
  const me = useMe();
  const role: Role = me.role;
  return role === "hr_admin" ? <HrHome /> : <PeopleHome />;
}
