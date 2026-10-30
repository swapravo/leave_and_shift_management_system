import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { api } from "../api";
import { useMe } from "../auth";
import { addDays, formatDate, hasStarted } from "../dates";
import { useAction, useLoad } from "../hooks";
import { swapOptions } from "../swapOptions";
import type { MyShift, Swap } from "../types";
import { Empty, ErrorBox, Loading, Modal } from "./ui";

const when = (s: { start_time: string; end_time: string }) => `${s.start_time}–${s.end_time}`;

/** Swap a shift in two taps: pick which of yours to give, then which teammate shift you'd take instead. */
export function SwapSheet({ initialShiftId, onClose, onDone }: {
  initialShiftId?: number; onClose: () => void; onDone: (s: Swap) => void;
}) {
  const me = useMe();
  const mine = useLoad(() => api.myShifts(), []);
  const cal = useLoad(() => api.calendar(me.today, addDays(me.today, 27)), [me.today]);
  const [giveId, setGiveId] = useState<number | null>(initialShiftId ?? null);
  const [takeId, setTakeId] = useState<number | null>(null);
  const { busy, error, run } = useAction();

  const upcoming = (mine.data ?? []).filter((s) => !hasStarted(s.date, s.start_time, me.today));
  const give: MyShift | undefined = upcoming.find((s) => s.id === giveId);
  const options = useMemo(
    () => give && cal.data ? swapOptions(cal.data.cells, cal.data.leaves, give, me.id, me.today) : [],
    [give, cal.data, me.id, me.today],
  );
  const byDay = useMemo(() => {
    const days = new Map<string, typeof options>();
    for (const o of options) days.set(o.date, [...(days.get(o.date) ?? []), o]);
    return [...days];
  }, [options]);
  const take = options.find((o) => o.assignmentId === takeId);

  return (
    <Modal title="Swap a shift" onClose={onClose} wide>
      <ErrorBox error={mine.error ?? cal.error} />
      {!mine.data || !cal.data ? <Loading /> : upcoming.length === 0 ? (
        <Empty>You have no upcoming shifts to swap.</Empty>
      ) : !give ? (
        <>
          <h3>Which of your shifts do you want to give away?</h3>
          <ul className="list" aria-label="Your upcoming shifts">
            {upcoming.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{formatDate(s.date)}</strong> · {s.shift_name}
                  <div className="meta">{when(s)}</div>
                </div>
                <button type="button" onClick={() => setGiveId(s.id)} aria-label={`Give ${s.shift_name} on ${formatDate(s.date)}`}>
                  Give this one
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="give-take" aria-label="The exchange">
            <div className="box"><small>You give</small><strong>{give.shift_name}</strong><div>{formatDate(give.date)} · {when(give)}</div></div>
            <ArrowLeftRight className="arrow" aria-hidden="true" />
            <div className="box">
              <small>You take</small>
              {take
                ? <><strong>{take.shiftName}</strong><div>{formatDate(take.date)} · {when({ start_time: take.startTime, end_time: take.endTime })}</div></>
                : <span className="muted">Choose below</span>}
            </div>
          </div>
          {byDay.length === 0 ? <Empty>No teammates are rostered in the next four weeks.</Empty> : (
            <div className="swap-days" role="group" aria-label="Teammate shifts you could take">
              {byDay.map(([date, opts]) => (
                <div key={date} className="swap-day">
                  <h4>{formatDate(date)}</h4>
                  {opts.map((o) => (
                    <button key={o.assignmentId} type="button" className={`swap-opt${o.blocked ? " blocked" : ""}`}
                      aria-pressed={o.assignmentId === takeId} disabled={Boolean(o.blocked)}
                      onClick={() => setTakeId(o.assignmentId)}>
                      <span><strong>{o.shiftName}</strong> · {o.startTime}–{o.endTime}</span>
                      <span>{o.person}{o.blocked && <span className="why"><br />{o.blocked}</span>}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          <p className="muted small">Your teammate says yes first, then your approver decides.</p>
          <ErrorBox error={error} title="Swap not possible:" />
          <div className="modal-foot">
            {initialShiftId === undefined && (
              <button type="button" className="ghost" onClick={() => { setGiveId(null); setTakeId(null); }}>Change my shift</button>
            )}
            <button type="button" className="primary large" disabled={busy || takeId === null}
              onClick={async () => {
                let created: Swap | undefined;
                const ok = await run(async () => {
                  created = await api.proposeSwap(give.id, takeId!);
                });
                if (ok && created) onDone(created);
              }}>
              {busy ? "Sending…" : take ? `Ask ${take.person}` : "Send swap request"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
