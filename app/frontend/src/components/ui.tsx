import { X } from "lucide-react";
import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import type { ApiError } from "../api";
import { formatDate } from "../dates";
import type { CoverageViolation } from "../types";

/** Pages shown inside another page (the settings tabs) get an h2, so each screen keeps a single h1. */
export const NestedPage = createContext(false);

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const Heading = useContext(NestedPage) ? "h2" : "h1";
  return (
    <header className="page-header">
      <div>
        <Heading>{title}</Heading>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className = "" }: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  const id = useId();
  return (
    <section className={`card ${className}`} aria-labelledby={title ? id : undefined}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2 id={id}>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  declined: "Declined",
  pending_peer: "Waiting for teammate",
  pending_manager: "Waiting for approval",
  refunded: "Refunded",
  owed: "Owed",
  forfeited: "Forfeited",
  removed: "Removed",
  restored: "Restored",
  not_restored: "Not restored",
  on_shift: "On shift",
  on_leave: "On leave",
  off: "Off",
  active: "Active",
  inactive: "Deactivated",
  archived: "Archived",
  gap: "Below minimum",
  ok: "Covered",
};

const TONES: Record<string, string> = {
  pending: "warn", pending_peer: "warn", pending_manager: "warn", owed: "warn",
  approved: "ok", refunded: "ok", restored: "ok", on_shift: "ok", active: "ok", ok: "ok",
  rejected: "bad", forfeited: "bad", not_restored: "bad", gap: "bad",
  cancelled: "neutral", declined: "neutral", removed: "neutral", off: "neutral", inactive: "neutral", archived: "neutral",
  on_leave: "info",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, " ");
}

/** Status is always shown as text; colour only reinforces it. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge badge-${TONES[status] ?? "neutral"}`}>{label ?? statusLabel(status)}</span>;
}

export function ErrorBox({ error, title }: { error: ApiError | null | undefined; title?: string }) {
  if (!error) return null;
  const violations = error.code === "COVERAGE_VIOLATION" ? (error.details as CoverageViolation[]) : [];
  return (
    <div className="alert alert-bad" role="alert">
      {title && <strong>{title} </strong>}
      {error.message}
      {violations.length > 1 && (
        <ul>
          {violations.map((v) => (
            <li key={`${v.shift_template_id}-${v.date}`}>
              {v.shift_name} on {formatDate(v.date)}: {v.headcount_without_you} of {v.min_headcount} without you
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "ok" | "warn" }) {
  return <div className={`alert alert-${tone}`} role="status">{children}</div>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="muted" role="status">{label}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.modal-close)");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="modal-close ghost" aria-label="Close" onClick={onClose}><X size={22} aria-hidden="true" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, danger, busy, error, onConfirm, onCancel }: {
  title: string; message: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean;
  error?: ApiError | null; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="secondary" onClick={onCancel}>Keep it</button>
          <button type="button" className={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div>{message}</div>
      <ErrorBox error={error} />
    </Modal>
  );
}

/** Ask for a decision comment; required when rejecting. */
export function DecisionDialog({ title, approve, busy, error, onSubmit, onCancel }: {
  title: string; approve: boolean; busy?: boolean; error?: ApiError | null;
  onSubmit: (comment: string) => void; onCancel: () => void;
}) {
  const id = useId();
  return (
    <Modal title={title} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(String(new FormData(e.currentTarget).get("comment") ?? ""));
        }}
      >
        <div className="field">
          <label htmlFor={id}>Comment{approve ? " (optional)" : ""}</label>
          <textarea id={id} name="comment" rows={3} required={!approve} />
        </div>
        <ErrorBox error={error} />
        <div className="modal-foot">
          <button type="button" className="secondary" onClick={onCancel}>Back</button>
          <button type="submit" className={approve ? "primary" : "danger"} disabled={busy}>
            {busy ? "Saving…" : approve ? "Approve" : "Reject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Field({ label, children, hint, htmlFor }: {
  label: string; children: ReactNode; hint?: ReactNode; htmlFor: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function TableWrap({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="table-wrap" role="region" aria-label={label} tabIndex={label ? 0 : undefined}>
      {children}
    </div>
  );
}
