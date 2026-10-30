// Leave and swap cards, and the approve / reject dialog, shared by Home and the Inbox.
import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { api } from "../api";
import { formatDate, formatRange } from "../dates";
import { useAction } from "../hooks";
import { plural, swapSteps } from "../plain";
import type { LeaveRequest, Swap } from "../types";
import { Timeline } from "./Timeline";
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

function DecideButtons({ subject, onDecide }: { subject: string; onDecide: (approve: boolean) => void }) {
  return (
    <div className="row-actions">
      <button type="button" className="primary" onClick={() => onDecide(true)} aria-label={`Approve ${subject}`}>
        <Check size={18} aria-hidden="true" />Approve
      </button>
      <button type="button" onClick={() => onDecide(false)} aria-label={`Reject ${subject}`}>
        <X size={18} aria-hidden="true" />Reject
      </button>
    </div>
  );
}

export function LeaveCard({ r, year, onDecide, extra }: {
  r: LeaveRequest; year: number; onDecide?: (approve: boolean) => void; extra?: ReactNode;
}) {
  const open = Boolean(onDecide && r.can_decide);
  return (
    <div className={`item-card${open ? " needs" : ""}`}>
      <div>
        <div className="title">{r.user_name} · {r.leave_type}</div>
        <div className="meta">{formatRange(r.start_date, r.end_date, year)} · {plural(r.days, "day")}{r.reason ? ` · “${r.reason}”` : ""}</div>
        {extra}
        {r.status !== "pending" && (
          <div className="meta">
            <StatusBadge status={r.status} /> {r.decided_by_name ? `by ${r.decided_by_name}` : ""}
            {r.decision_comment ? ` — ${r.decision_comment}` : ""}
          </div>
        )}
      </div>
      {open && <DecideButtons subject={`leave for ${r.user_name}`} onDecide={onDecide!} />}
    </div>
  );
}

export function SwapSummary({ s, year }: { s: Swap; year: number }) {
  return (
    <span>
      {s.requester_shift_name} {formatDate(s.requester_date, year)} ({s.requester_start_time}–{s.requester_end_time}) for{" "}
      {s.target_shift_name} {formatDate(s.target_date, year)} ({s.target_start_time}–{s.target_end_time})
    </span>
  );
}

export function SwapCard({ s, meId, year, onDecide, actions }: {
  s: Swap; meId: number; year: number; onDecide?: (approve: boolean) => void; actions?: ReactNode;
}) {
  const open = Boolean(onDecide && s.can_decide);
  return (
    <div className={`item-card${open || (actions && s.can_respond) ? " needs" : ""}`}>
      <div style={{ flex: "1 1 18rem" }}>
        <div className="title">{s.requester_name} ⇄ {s.target_name}</div>
        <div className="meta"><SwapSummary s={s} year={year} /></div>
        {s.decision_comment && <div className="meta">“{s.decision_comment}”</div>}
        <Timeline steps={swapSteps(s, meId)} label={`Progress of the swap between ${s.requester_name} and ${s.target_name}`} />
      </div>
      {open && <DecideButtons subject={`swap between ${s.requester_name} and ${s.target_name}`} onDecide={onDecide!} />}
      {actions}
    </div>
  );
}
