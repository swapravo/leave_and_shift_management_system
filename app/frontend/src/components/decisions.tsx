// Approve / reject controls shared by the dashboard and the approvals page.
import { useState } from "react";
import { api } from "../api";
import { formatDate, formatDays, formatRange } from "../dates";
import { useAction } from "../hooks";
import type { LeaveRequest, Swap } from "../types";
import { DecisionDialog, StatusBadge } from "./ui";

type Pending = { kind: "leave"; item: LeaveRequest; approve: boolean } | { kind: "swap"; item: Swap; approve: boolean };

export function useDecisions(onDone: () => void) {
  const [pending, setPending] = useState<Pending | null>(null);
  const { busy, error, setError, run } = useAction();

  const open = (p: Pending) => {
    setError(null);
    setPending(p);
  };
  const dialog = pending && (
    <DecisionDialog
      title={`${pending.approve ? "Approve" : "Reject"} ${pending.kind === "leave" ? "leave request" : "shift swap"}`}
      approve={pending.approve}
      busy={busy}
      error={error}
      onCancel={() => setPending(null)}
      onSubmit={async (comment) => {
        const ok = await run(() =>
          pending.kind === "leave"
            ? api.decideLeave(pending.item.id, pending.approve, comment)
            : api.decideSwap(pending.item.id, pending.approve, comment),
        );
        if (ok) {
          setPending(null);
          onDone();
        }
      }}
    />
  );
  return { open, dialog };
}

export function LeaveRow({ r, year, onDecide }: {
  r: LeaveRequest; year: number; onDecide?: (approve: boolean) => void;
}) {
  return (
    <li>
      <div>
        <div><strong>{r.user_name}</strong> · {r.leave_type} · {formatDays(r.days)} day{r.days === 1 ? "" : "s"}</div>
        <div className="meta">{formatRange(r.start_date, r.end_date, year)}{r.reason ? ` — “${r.reason}”` : ""}</div>
        {r.status !== "pending" && (
          <div className="meta">
            <StatusBadge status={r.status} /> {r.decided_by_name ? `by ${r.decided_by_name}` : ""}
            {r.decision_comment ? ` — ${r.decision_comment}` : ""}
          </div>
        )}
      </div>
      {onDecide && r.can_decide && (
        <div className="row-actions">
          <button type="button" className="primary small" onClick={() => onDecide(true)}
            aria-label={`Approve leave for ${r.user_name}`}>Approve</button>
          <button type="button" className="small" onClick={() => onDecide(false)}
            aria-label={`Reject leave for ${r.user_name}`}>Reject</button>
        </div>
      )}
    </li>
  );
}

export function SwapSummary({ s, year }: { s: Swap; year: number }) {
  return (
    <span>
      <strong>{s.requester_name}</strong> gives {s.requester_shift_name} {formatDate(s.requester_date, year)}
      {" "}({s.requester_start_time}–{s.requester_end_time}) ⇄ <strong>{s.target_name}</strong> gives{" "}
      {s.target_shift_name} {formatDate(s.target_date, year)} ({s.target_start_time}–{s.target_end_time})
    </span>
  );
}

export function SwapRow({ s, year, onDecide }: { s: Swap; year: number; onDecide?: (approve: boolean) => void }) {
  return (
    <li>
      <div>
        <div><SwapSummary s={s} year={year} /></div>
        <div className="meta">
          <StatusBadge status={s.status} /> {s.decided_by_name ? `by ${s.decided_by_name}` : ""}
          {s.decision_comment ? ` — ${s.decision_comment}` : ""}
        </div>
      </div>
      {onDecide && s.can_decide && (
        <div className="row-actions">
          <button type="button" className="primary small" onClick={() => onDecide(true)}
            aria-label={`Approve swap between ${s.requester_name} and ${s.target_name}`}>Approve</button>
          <button type="button" className="small" onClick={() => onDecide(false)}
            aria-label={`Reject swap between ${s.requester_name} and ${s.target_name}`}>Reject</button>
        </div>
      )}
    </li>
  );
}
