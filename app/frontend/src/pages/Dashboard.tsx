import { Link } from "react-router";
import { api } from "../api";
import { useMe } from "../auth";
import { LeaveRow, SwapRow, useDecisions } from "../components/decisions";
import { Card, Empty, ErrorBox, Loading, PageHeader, StatusBadge, TableWrap } from "../components/ui";
import { formatDate } from "../dates";
import { useLoad } from "../hooks";
import type { CoverageCell } from "../types";

function GapList({ cells, year, showDate }: { cells: CoverageCell[]; year: number; showDate?: boolean }) {
  if (!cells.length) return <Empty>No coverage gaps.</Empty>;
  return (
    <ul className="list">
      {cells.map((c) => (
        <li key={`${c.shift_template_id}-${c.date}`}>
          <div>
            <div>
              <strong>{c.shift_name}</strong> ({c.start_time}–{c.end_time}){showDate ? ` · ${formatDate(c.date, year)}` : ""}
            </div>
            <div className="meta">{c.team_name}{c.assigned.length ? ` · on it: ${c.assigned
              .filter((p) => !p.leave_status).map((p) => p.user_name).join(", ") || "nobody"}` : " · nobody rostered"}</div>
          </div>
          <span className="badge badge-bad">{c.headcount} of {c.min_headcount}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const { data, error, loading, reload } = useLoad(() => api.dashboard(), []);
  const { open, dialog } = useDecisions(() => void reload());

  const pendingCount = (data?.pending_leave.length ?? 0) + (data?.pending_swaps.length ?? 0);
  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={data ? `${data.teams.map((t) => t.name).join(", ") || "No team"} · ${formatDate(data.today)} ${year}` : undefined}
        actions={<Link className="button" to="/roster">Open roster</Link>}
      />
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <div className="grid cards" style={{ marginBottom: "1rem" }}>
            <div className="card stat"><span className="value">{data.gaps_today.length}</span><span className="label">Coverage gaps today</span></div>
            <div className="card stat"><span className="value">{pendingCount}</span><span className="label">Waiting for your approval</span></div>
            <div className="card stat"><span className="value">{data.availability.filter((a) => a.status === "on_shift").length}</span><span className="label">On shift today</span></div>
            <div className="card stat"><span className="value">{data.availability.filter((a) => a.status === "on_leave").length}</span><span className="label">On leave today</span></div>
          </div>
          <div className="grid two">
            <Card title="Today's coverage gaps">
              <GapList cells={data.gaps_today} year={year} />
            </Card>
            <Card title="Pending approvals" actions={<Link to="/approvals" className="small">All approvals</Link>}>
              <h3>Leave</h3>
              {data.pending_leave.length ? (
                <ul className="list">
                  {data.pending_leave.map((r) => (
                    <LeaveRow key={r.id} r={r} year={year} onDecide={(approve) => open({ kind: "leave", item: r, approve })} />
                  ))}
                </ul>
              ) : <Empty>No leave requests waiting.</Empty>}
              <h3 style={{ marginTop: "0.75rem" }}>Shift swaps</h3>
              {data.pending_swaps.length ? (
                <ul className="list">
                  {data.pending_swaps.map((s) => (
                    <SwapRow key={s.id} s={s} year={year} onDecide={(approve) => open({ kind: "swap", item: s, approve })} />
                  ))}
                </ul>
              ) : <Empty>No swaps waiting.</Empty>}
            </Card>
            <Card title="Gaps in the next 7 days">
              <GapList cells={data.upcoming_gaps} year={year} showDate />
            </Card>
            <Card title="Who's available today">
              <TableWrap label="Availability today">
                <table>
                  <thead><tr><th>Name</th>{data.teams.length > 1 && <th>Team</th>}<th>Status</th><th>Shift</th></tr></thead>
                  <tbody>
                    {data.availability.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        {data.teams.length > 1 && <td>{a.team_name}</td>}
                        <td>
                          <StatusBadge status={a.status} />
                          {a.pending_leave_today && <> <StatusBadge status="pending" label="Leave pending" /></>}
                        </td>
                        <td className="small">{a.shifts.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}
