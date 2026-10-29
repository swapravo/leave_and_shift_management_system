// Pure date helpers on ISO strings (YYYY-MM-DD). Dates are IST calendar dates; "today" always comes from the
// server (Me.today), never the browser clock. Maths is done in UTC so the browser's time zone can't shift a day.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
  "October", "November", "December"];

function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s;
}

export function addDays(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * DAY_MS);
}

/** 0 = Monday ... 6 = Sunday (the backend's convention). */
export function weekday(iso: string): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7;
}

export function isWeekend(iso: string): boolean {
  return weekday(iso) >= 5;
}

export function weekStart(iso: string): string {
  return addDays(iso, -weekday(iso));
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return fromUTC(Date.UTC(y, m, 0));
}

export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Every date from start to end inclusive. */
export function range(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = toUTC(start); t <= toUTC(end); t += DAY_MS) out.push(fromUTC(t));
  return out;
}

export function daysBetween(start: string, end: string): number {
  return Math.round((toUTC(end) - toUTC(start)) / DAY_MS);
}

/** Mon-Fri dates in [start, end]: what a leave request deducts. */
export function workingDays(start: string, end: string): number {
  if (end < start) return 0;
  return range(start, end).filter((d) => !isWeekend(d)).length;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekday(iso)];
}

/** "Mon 15 Jun" (or "Mon 15 Jun 2027" when the year differs from `year`). */
export function formatDate(iso: string, year?: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = `${weekdayName(iso)} ${String(d).padStart(2, "0")} ${MONTHS[m - 1]}`;
  return year !== undefined && year !== y ? `${base} ${y}` : base;
}

export function formatRange(start: string, end: string, year?: number): string {
  return start === end ? formatDate(start, year) : `${formatDate(start, year)} – ${formatDate(end, year)}`;
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "28 Oct 2026, 10:15" from an ISO timestamp with offset, shown in IST. */
export function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  const date = ts.slice(0, 10);
  const time = ts.slice(11, 16);
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}, ${time}`;
}

/** Current time of day in IST ("HH:MM"). The server pins only the date, so this matches its "has it started?". */
export function istTimeNow(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(now);
}

/** Has a shift starting on `date` at `start` (HH:MM) begun, given the server's today? */
export function hasStarted(date: string, start: string, today: string, now: Date = new Date()): boolean {
  return date < today || (date === today && start <= istTimeNow(now));
}

/** Leave quantities: up to 2 decimals, no trailing zeros ("1.5", "2", "1.67"). */
export function formatDays(n: number): string {
  return String(Math.round(n * 100) / 100);
}
