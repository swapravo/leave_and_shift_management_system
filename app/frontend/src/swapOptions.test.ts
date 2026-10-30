import { swapOptions } from "./swapOptions";
import type { CalendarLeave, CoverageCell } from "./types";

const cell = (over: Partial<CoverageCell> & Pick<CoverageCell, "date" | "shift_template_id">, people: [number, string, "pending" | "approved" | null][]): CoverageCell => ({
  shift_name: over.shift_template_id === 1 ? "Morning" : "Evening", team_id: 1, team_name: "Support", start_time: over.shift_template_id === 1 ? "06:00" : "14:00",
  end_time: over.shift_template_id === 1 ? "14:00" : "22:00", min_headcount: 1, headcount: people.length, gap: false,
  assigned: people.map(([user_id, user_name, leave_status], i) => ({ assignment_id: over.shift_template_id * 100 + i, user_id, user_name, leave_status })),
  ...over,
});
const leave = (user_id: number, start: string, end = start): CalendarLeave => ({
  id: user_id, user_id, user_name: `u${user_id}`, team_id: 1, leave_type: "Casual", start_date: start, end_date: end, days: 1, status: "approved",
});

const mine = { shift_template_id: 2, date: "2026-10-30" };
const cells = [
  cell({ date: "2026-10-30", shift_template_id: 2 }, [[3, "Arjun", null], [4, "Priya", null]]),
  cell({ date: "2026-10-31", shift_template_id: 1 }, [[3, "Arjun", null], [5, "Karan", null], [6, "Neha", "approved"]]),
  cell({ date: "2026-10-29", shift_template_id: 1 }, [[5, "Karan", null]]),
];
const NOON = new Date("2026-10-30T06:30:00Z"); // 12:00 IST

describe("swapOptions", () => {
  const opts = (leaves: CalendarLeave[] = []) => swapOptions(cells, leaves, mine, 3, "2026-10-30", NOON);

  it("never offers your own shifts, and drops shifts that have already started", () => {
    const names = opts().map((o) => o.person);
    expect(names).not.toContain("Arjun");
    expect(opts().some((o) => o.date === "2026-10-29")).toBe(false);
  });

  it("skips a teammate on the very same shift, since swapping with them changes nothing", () => {
    expect(opts().map((o) => o.person)).toEqual(["Karan", "Neha"]);
  });

  it("blocks a teammate who is on leave that day, with the reason", () => {
    const neha = opts().find((o) => o.person === "Neha")!;
    expect(neha.blocked).toBe("Neha is on leave that day");
  });

  it("blocks days you are on leave, and teammates on leave on your shift's day", () => {
    expect(opts([leave(3, "2026-10-31")]).find((o) => o.person === "Karan")!.blocked).toMatch(/You're on leave on Sat 31 Oct/);
    expect(opts([leave(5, "2026-10-30")]).find((o) => o.person === "Karan")!.blocked).toMatch(/Karan is on leave on Fri 30 Oct/);
  });

  it("leaves everything else open", () => {
    expect(opts().find((o) => o.person === "Karan")!.blocked).toBeNull();
  });
});
