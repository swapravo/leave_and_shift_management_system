import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { formatDate, formatDays, formatRange, isISODate } from "../dates";
import { asApiError, useAction, useLoad } from "../hooks";
import type { LeavePreview, LeaveRequest } from "../types";
import { plural } from "../plain";
import { RangePicker } from "./RangePicker";
import { ErrorBox, Loading, Modal } from "./ui";

/** Request time off in one sheet: pick the dates, see what it costs and who decides, send. */
export function LeaveSheet({ initialStart, onClose, onDone }: {
  initialStart?: string; onClose: () => void; onDone: (r: LeaveRequest) => void;
}) {
  const me = useMe();
  const balances = useLoad(() => api.balances(), []);
  const teams = useLoad(() => api.teams(), []);
  const types = (balances.data ?? []).filter((b) => b.active);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [start, setStart] = useState(initialStart ?? "");
  const [end, setEnd] = useState(initialStart ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const { busy, error, setError, run } = useAction();

  const chosen = typeId ?? types[0]?.leave_type_id ?? null;
  const ready = chosen !== null && isISODate(start) && isISODate(end);
  const approver = me.role === "manager" ? "HR Admin" : teams.data?.find((t) => t.id === me.team_id)?.manager_name ?? null;

  // Live check of every rule the server applies, shortly after each change.
  useEffect(() => {
    setPreview(null);
    if (!ready) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      api.previewLeave({ leave_type_id: chosen, start_date: start, end_date: end })
        .then((p) => alive && setPreview(p))
        .catch((e) => alive && setError(asApiError(e)));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [chosen, start, end, ready, setError]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (chosen === null) return;
    let created: LeaveRequest | null = null;
    const ok = await run(async () => {
      created = await api.applyLeave({ leave_type_id: chosen, start_date: start, end_date: end, reason: note ?? "" });
    });
    if (ok && created) onDone(created);
  }

  const blocked = (preview?.errors.length ?? 0) > 0;
  return (
    <Modal title="Request time off" onClose={onClose} wide>
      {!balances.data ? <Loading /> : types.length === 0 ? <p>No leave types are available to you yet.</p> : (
        <form onSubmit={submit} aria-label="Request time off">
          <div className="type-pills" role="group" aria-label="Leave type">
            {types.map((t) => (
              <button key={t.leave_type_id} type="button" aria-pressed={t.leave_type_id === chosen}
                onClick={() => setTypeId(t.leave_type_id)}>
                {t.leave_type} · {formatDays(t.available)} left
              </button>
            ))}
          </div>
          <RangePicker start={start} end={end} today={me.today} onChange={(s, e) => { setStart(s); setEnd(e); }} />

          {ready && (
            <div className="summary" role="status" aria-live="polite" data-testid="leave-preview">
              <dl>
                <dt>Dates</dt><dd>{formatRange(start, end)}</dd>
                <dt>Working days</dt>
                <dd>{preview ? plural(preview.days, "day") : "checking…"} <span className="muted small">(Mon–Fri)</span></dd>
                {preview?.remaining_after != null && (<><dt>Balance after</dt><dd>{formatDays(preview.remaining_after)} left</dd></>)}
                <dt>Decided by</dt><dd>{approver ?? "Your manager"}</dd>
              </dl>
            </div>
          )}
          {preview && blocked && (
            <div className="alert alert-bad" role="alert">
              <strong>This can't be sent yet:</strong>
              <ul>{preview.errors.map((m) => <li key={m}>{m}</li>)}</ul>
              {preview.violations.length > 1 && (
                <ul>
                  {preview.violations.map((v) => (
                    <li key={`${v.shift_template_id}-${v.date}`}>
                      {v.shift_name} on {formatDate(v.date)}: {v.headcount_without_you} of {v.min_headcount} without you
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {note === null ? (
            <button type="button" className="link" onClick={() => setNote("")}>Add a note</button>
          ) : (
            <div className="field">
              <label htmlFor="leave-note">Note for your approver (optional)</label>
              <input id="leave-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          <ErrorBox error={error} />
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={onClose}>Not now</button>
            <button type="submit" className="primary large" disabled={!ready || busy || blocked}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
