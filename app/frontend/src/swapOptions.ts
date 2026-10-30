// Which teammate shifts can be offered in exchange for one of mine, and why not when one can't. Only the reasons
// visible in the calendar data are checked here; the server still applies every rule when the swap is proposed.
import { formatDate, hasStarted, overlaps } from "./dates";
import type { CalendarLeave, CoverageCell, ISODate } from "./types";

export interface SwapOption {
  assignmentId: number;
  date: ISODate;
  shiftName: string;
  startTime: string;
  endTime: string;
  person: string;
  /** Plain-language reason this shift can't be taken, or null when it can. */
  blocked: string | null;
}

export interface MyShiftRef {
  shift_template_id: number;
  date: ISODate;
}

function onLeave(leaves: CalendarLeave[], userId: number, date: ISODate): boolean {
  return leaves.some((l) => l.user_id === userId && overlaps(l.start_date, l.end_date, date, date));
}

export function swapOptions(
  cells: CoverageCell[], leaves: CalendarLeave[], mine: MyShiftRef, meId: number, today: ISODate, now?: Date,
): SwapOption[] {
  const out: SwapOption[] = [];
  for (const c of cells) {
    if (hasStarted(c.date, c.start_time, today, now)) continue;
    if (c.shift_template_id === mine.shift_template_id && c.date === mine.date) continue;
    for (const p of c.assigned) {
      if (p.user_id === meId) continue;
      let blocked: string | null = null;
      if (p.leave_status) blocked = `${p.user_name} is on leave that day`;
      else if (onLeave(leaves, meId, c.date)) blocked = `You're on leave on ${formatDate(c.date)}`;
      else if (onLeave(leaves, p.user_id, mine.date)) blocked = `${p.user_name} is on leave on ${formatDate(mine.date)}`;
      out.push({
        assignmentId: p.assignment_id, date: c.date, shiftName: c.shift_name, startTime: c.start_time, endTime: c.end_time,
        person: p.user_name, blocked,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.person.localeCompare(b.person));
}
