import {
  addDays, addMonths, daysBetween, formatDate, formatDays, formatRange, formatTimestamp, hasStarted, isISODate, istTimeNow, monthEnd,
  monthStart, overlaps, range, weekday, weekStart, workingDays,
} from "./dates";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("uses Monday = 0 like the backend", () => {
    expect(weekday("2026-06-15")).toBe(0); // Monday
    expect(weekday("2026-06-10")).toBe(2); // Wednesday
    expect(weekday("2026-06-14")).toBe(6); // Sunday
  });

  it("finds the week start (Monday)", () => {
    expect(weekStart("2026-06-10")).toBe("2026-06-08");
    expect(weekStart("2026-06-14")).toBe("2026-06-08");
    expect(weekStart("2026-06-15")).toBe("2026-06-15");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });

  it("finds month starts and ends, including leap years", () => {
    expect(monthStart("2026-06-10")).toBe("2026-06-01");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(monthEnd("2026-12-05")).toBe("2026-12-31");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("counts Mon–Fri working days like the backend", () => {
    expect(workingDays("2026-06-12", "2026-06-15")).toBe(2); // Fri..Mon
    expect(workingDays("2026-06-13", "2026-06-14")).toBe(0); // weekend
    expect(workingDays("2026-06-15", "2026-06-28")).toBe(10);
    expect(workingDays("2026-06-16", "2026-06-15")).toBe(0);
  });

  it("lists ranges and measures them", () => {
    expect(range("2026-06-29", "2026-07-02")).toEqual(["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"]);
    expect(daysBetween("2026-06-01", "2026-07-13")).toBe(42);
    expect(overlaps("2026-06-01", "2026-06-05", "2026-06-05", "2026-06-09")).toBe(true);
    expect(overlaps("2026-06-01", "2026-06-04", "2026-06-05", "2026-06-09")).toBe(false);
  });

  it("validates ISO dates", () => {
    expect(isISODate("2026-06-10")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("10/06/2026")).toBe(false);
    expect(isISODate("")).toBe(false);
  });

  it("formats dates and quantities", () => {
    expect(formatDate("2026-06-15")).toBe("Mon 15 Jun");
    expect(formatDate("2027-01-04", 2026)).toBe("Mon 04 Jan 2027");
    expect(formatRange("2026-06-15", "2026-06-16")).toBe("Mon 15 Jun – Tue 16 Jun");
    expect(formatRange("2026-06-15", "2026-06-15")).toBe("Mon 15 Jun");
    expect(formatTimestamp("2026-10-28T10:15:00+05:30")).toBe("28 Oct 2026, 10:15");
    expect(formatDays(1.5)).toBe("1.5");
    expect(formatDays(2)).toBe("2");
    expect(formatDays(1.6666)).toBe("1.67");
  });

  it("tells whether a shift has started, in IST", () => {
    const at = new Date("2026-06-10T04:00:00Z"); // 09:30 IST
    expect(istTimeNow(at)).toBe("09:30");
    expect(hasStarted("2026-06-10", "09:00", "2026-06-10", at)).toBe(true);
    expect(hasStarted("2026-06-10", "22:00", "2026-06-10", at)).toBe(false);
    expect(hasStarted("2026-06-09", "22:00", "2026-06-10", at)).toBe(true);
    expect(hasStarted("2026-06-11", "06:00", "2026-06-10", at)).toBe(false);
  });
});
