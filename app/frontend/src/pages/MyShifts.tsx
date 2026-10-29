import { useMemo, useState } from "react";
import { api } from "../api";
import { useMe } from "../auth";
import { SwapSummary } from "../components/decisions";
import { Card, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, StatusBadge } from "../components/ui";
import { addDays, formatDate, hasStarted } from "../dates";
import { useAction, useLoad } from "../hooks";
import type { MyShift, Swap } from "../types";

interface Option {
  assignmentId: number;
  label: string;
  date: string;
}

function ProposeDialog({ mine, year, today, meId, onClose, onDone }: {
  mine: MyShift; year: number; today: string; meId: number; onClose: () => void; onDone: (s: Swap) => void;
}) {
  const cal = useLoad(() => api.calendar(today, addDays(today, 27)), [today]);
  const [choice, setChoice] = useState<number | "">("");
  const { busy, error, run } = useAction();

  const options: Option[] = useMemo(() => {
    if (!cal.data) return [];
    const out: Option[] = [];
    for (const c of cal.data.cells) {
      if (hasStarted(c.date, c.start_time, today)) continue;
      for (const p of c.assigned) {
        if (p.user_id === meId) continue;
        if (c.shift_template_id === mine.shift_template_id && c.date === mine.date) continue; // same shift: nothing to swap
        out.push({
          assignmentId: p.assignment_id,
          date: c.date,
          label: `${formatDate(c.date, year)} · ${c.shift_name} ${c.start_time}–${c.end_time} · ${p.user_name}`,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  }, [cal.data, meId, year, today, mine.shift_template_id, mine.date]);

  return (
    <Modal title="Propose a shift swap" onClose={onClose}>
      <p>You give: <strong>{mine.shift_name} {formatDate(mine.date, year)}</strong> ({mine.start_time}–{mine.end_time})</p>
      <ErrorBox error={cal.error} />
      {!cal.data ? <Loading /> : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            let created: Swap | undefined;
            const ok = await run(async () => {
              created = await api.proposeSwap(mine.id, Number(choice));
            });
            if (ok && created) onDone(created);
          }}
        >
          <Field label="You take (a teammate's shift)" htmlFor="their-shift" hint="Your teammate accepts first, then the approver decides.">
            <select id="their-shift" value={choice} required onChange={(e) => setChoice(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose a shift…</option>
              {options.map((o) => <option key={o.assignmentId} value={o.assignmentId}>{o.label}</option>)}
            </select>
          </Field>
          <ErrorBox error={error} title="Swap not possible:" />
          <div className="modal-foot">
            <button type="button" className="secondary" onClick={onClose}>Back</button>
            <button type="submit" className="primary" disabled={busy || choice === ""}>{busy ? "Sending…" : "Propose swap"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function MyShifts() {
  const me = useMe();
  const year = Number(me.today.slice(0, 4));
  const shifts = useLoad(() => api.myShifts(), []);
  const swaps = useLoad(() => api.swaps(), []);
  const [proposing, setProposing] = useState<MyShift | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const act = useAction();

  const refresh = () => Promise.all([shifts.reload(), swaps.reload()]);
  const mySwaps = swaps.data?.filter((s) => s.requester_id === me.id || s.target_id === me.id) ?? [];
  const open = mySwaps.filter((s) => s.status === "pending_peer" || s.status === "pending_manager");
  const closed = mySwaps.filter((s) => s.status !== "pending_peer" && s.status !== "pending_manager").slice(0, 15);

  async function respond(s: Swap, accept: boolean) {
    if (await act.run(() => api.respondSwap(s.id, accept))) {
      setNotice(accept ? "Swap accepted. It now needs approval." : "Swap declined.");
      void refresh();
    }
  }

  async function cancel(s: Swap) {
    if (await act.run(() => api.cancelSwap(s.id))) {
      setNotice("Swap cancelled.");
      void refresh();
    }
  }

  return (
    <div className="page">
      <PageHeader title="My shifts & swaps" subtitle="Your shifts for the next four weeks" />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <ErrorBox error={act.error} />
      <div className="grid two">
        <Card title="Upcoming shifts">
          <ErrorBox error={shifts.error} />
          {!shifts.data ? <Loading /> : shifts.data.length === 0 ? <Empty>You aren't rostered in the next four weeks.</Empty> : (
            <ul className="list" aria-label="My upcoming shifts">
              {shifts.data.map((s) => (
                <li key={s.id}>
                  <div>
                    <div><strong>{formatDate(s.date, year)}</strong> · {s.shift_name}</div>
                    <div className="meta">{s.start_time}–{s.end_time}{s.end_time <= s.start_time ? " (ends next day)" : ""} · {s.team_name}</div>
                  </div>
                  {!hasStarted(s.date, s.start_time, me.today) && (
                    <button type="button" className="small" onClick={() => setProposing(s)}
                      aria-label={`Propose swap for ${s.shift_name} on ${formatDate(s.date, year)}`}>Propose swap</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Open swaps">
          <ErrorBox error={swaps.error} />
          {!swaps.data ? <Loading /> : open.length === 0 ? <Empty>No open swaps.</Empty> : (
            <ul className="list" aria-label="Open swaps">
              {open.map((s) => (
                <li key={s.id}>
                  <div>
                    <div><SwapSummary s={s} year={year} /></div>
                    <div className="meta"><StatusBadge status={s.status} /></div>
                  </div>
                  <div className="row-actions">
                    {s.can_respond && (
                      <>
                        <button type="button" className="primary small" disabled={act.busy} onClick={() => respond(s, true)}>Accept</button>
                        <button type="button" className="small" disabled={act.busy} onClick={() => respond(s, false)}>Decline</button>
                      </>
                    )}
                    {s.can_cancel && <button type="button" className="small" disabled={act.busy} onClick={() => cancel(s)}>Cancel swap</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {closed.length > 0 && (
            <>
              <h3 style={{ marginTop: "0.75rem" }}>Recent</h3>
              <ul className="list">
                {closed.map((s) => (
                  <li key={s.id}>
                    <div><SwapSummary s={s} year={year} />{s.decision_comment ? <div className="meta">“{s.decision_comment}”</div> : null}</div>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
      {proposing && (
        <ProposeDialog
          mine={proposing}
          year={year}
          today={me.today}
          meId={me.id}
          onClose={() => setProposing(null)}
          onDone={(s) => {
            setProposing(null);
            setNotice(`Swap proposed to ${s.target_name}. They need to accept it first.`);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
