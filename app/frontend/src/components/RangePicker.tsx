import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, formatDate, isWeekend, monthEnd, monthLabel, monthStart, range, weekStart } from "../dates";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Pick a first and last day on a month grid: tap a day, then tap the last day (tap the same day again for one day). */
export function RangePicker({ start, end, today, onChange }: {
  start: string; end: string; today: string; onChange: (start: string, end: string) => void;
}) {
  const [month, setMonth] = useState(monthStart(start || today));
  const [anchor, setAnchor] = useState<string | null>(null);
  const days = range(weekStart(month), addDays(weekStart(monthEnd(month)), 6));

  function pick(d: string) {
    if (anchor === null) {
      setAnchor(d);
      onChange(d, d);
    } else {
      onChange(d < anchor ? d : anchor, d < anchor ? anchor : d);
      setAnchor(null);
    }
  }

  return (
    <div className="picker">
      <div className="picker-head">
        <button type="button" className="ghost small" aria-label="Previous month" disabled={month <= monthStart(today)}
          onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={20} aria-hidden="true" /></button>
        <span aria-live="polite">{monthLabel(month)}</span>
        <button type="button" className="ghost small" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <div className="picker-grid" role="group" aria-label="Choose your leave dates">
        {DOW.map((d) => <div key={d} className="dow" aria-hidden="true">{d}</div>)}
        {days.map((d) => {
          const outside = d.slice(0, 7) !== month.slice(0, 7);
          if (outside) return <span key={d} aria-hidden="true" />;
          const edge = d === start || d === end;
          const inside = Boolean(start && end && d > start && d < end);
          return (
            <button
              key={d}
              type="button"
              disabled={d < today}
              aria-pressed={edge || inside}
              aria-label={formatDate(d)}
              className={`pick-day${isWeekend(d) ? " weekend" : ""}${d === today ? " today" : ""}${edge ? " edge" : inside ? " in-range" : ""}`}
              onClick={() => pick(d)}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: "0.5rem 0 0" }}>
        {anchor ? "Now tap the last day, or tap the same day again for a single day."
          : start ? "Tap any day to start over. Weekends aren't deducted." : "Tap the first day. Weekends aren't deducted."}
      </p>
    </div>
  );
}
