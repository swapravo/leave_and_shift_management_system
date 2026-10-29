import { api } from "../api";
import { useMe } from "../auth";
import { LeaveRow, SwapRow, useDecisions } from "../components/decisions";
import { Card, Empty, ErrorBox, Loading, PageHeader } from "../components/ui";
import { useLoad } from "../hooks";

export default function Approvals() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const { data, error, loading, reload } = useLoad(async () => {
    const [pending, decided, swaps] = await Promise.all([
      api.leaveRequests("pending"), api.leaveRequests("decided"), api.swaps(),
    ]);
    return { pending, decided, swaps };
  }, []);
  const { open, dialog } = useDecisions(() => void reload());

  const pendingSwaps = data?.swaps.filter((s) => s.status === "pending_manager" && s.can_decide) ?? [];
  const decidedSwaps = data?.swaps.filter((s) => s.status === "approved" || s.status === "rejected") ?? [];
  const waitingPeer = data?.swaps.filter((s) => s.status === "pending_peer") ?? [];

  return (
    <div className="page">
      <PageHeader title="Approvals" subtitle={me.role === "hr_admin" ? "Managers' leave, and swaps where a manager is involved" : "Your team's leave and shift swaps"} />
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && (
        <div className="grid two">
          <Card title={`Leave waiting for you (${data.pending.length})`}>
            {data.pending.length ? (
              <ul className="list">
                {data.pending.map((r) => (
                  <LeaveRow key={r.id} r={r} year={year} onDecide={(approve) => open({ kind: "leave", item: r, approve })} />
                ))}
              </ul>
            ) : <Empty>Nothing waiting.</Empty>}
          </Card>
          <Card title={`Swaps waiting for you (${pendingSwaps.length})`}>
            {pendingSwaps.length ? (
              <ul className="list">
                {pendingSwaps.map((s) => (
                  <SwapRow key={s.id} s={s} year={year} onDecide={(approve) => open({ kind: "swap", item: s, approve })} />
                ))}
              </ul>
            ) : <Empty>Nothing waiting.</Empty>}
            {waitingPeer.length > 0 && (
              <>
                <h3 style={{ marginTop: "0.75rem" }}>Waiting for the teammate to accept</h3>
                <ul className="list">{waitingPeer.map((s) => <SwapRow key={s.id} s={s} year={year} />)}</ul>
              </>
            )}
          </Card>
          <Card title="Leave you decided recently">
            {data.decided.length ? (
              <ul className="list">{data.decided.map((r) => <LeaveRow key={r.id} r={r} year={year} />)}</ul>
            ) : <Empty>None yet.</Empty>}
          </Card>
          <Card title="Decided swaps">
            {decidedSwaps.length ? (
              <ul className="list">{decidedSwaps.slice(0, 30).map((s) => <SwapRow key={s.id} s={s} year={year} />)}</ul>
            ) : <Empty>None yet.</Empty>}
          </Card>
        </div>
      )}
      {dialog}
    </div>
  );
}
