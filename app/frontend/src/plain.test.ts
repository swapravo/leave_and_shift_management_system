import { leaveStatusText, plural, swapSteps } from "./plain";
import type { LeaveRequest, Swap } from "./types";

const swap = (status: Swap["status"], over: Partial<Swap> = {}): Swap => ({
  id: 1, team_id: 1, team_name: "Support", requester_id: 3, requester_name: "Arjun", target_id: 4, target_name: "Priya",
  requester_shift_name: "Evening", requester_date: "2026-10-30", requester_start_time: "14:00", requester_end_time: "22:00",
  target_shift_name: "Morning", target_date: "2026-10-31", target_start_time: "06:00", target_end_time: "14:00", status,
  decided_by_name: null, decision_comment: null, created_at: "", can_respond: false, can_cancel: false, can_decide: false, ...over,
});

describe("swapSteps", () => {
  it("shows the teammate's answer as the current step first", () => {
    const steps = swapSteps(swap("pending_peer"), 3);
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "todo"]);
    expect(steps[0].label).toBe("You offered");
    expect(steps[1].label).toBe("Priya accepts");
  });

  it("moves to the approver once the teammate has accepted", () => {
    expect(swapSteps(swap("pending_manager"), 3).map((s) => s.state)).toEqual(["done", "done", "current"]);
  });

  it("completes when approved and names who approved", () => {
    const steps = swapSteps(swap("approved", { decided_by_name: "Meera" }), 4);
    expect(steps.every((s) => s.state === "done")).toBe(true);
    expect(steps[2].label).toBe("Approved by Meera");
  });

  it("stops in red where it was declined or rejected", () => {
    expect(swapSteps(swap("declined"), 3)[1]).toEqual({ label: "Priya declined", state: "stopped" });
    expect(swapSteps(swap("rejected", { decided_by_name: "Meera" }), 3)[2]).toEqual({ label: "Not approved by Meera", state: "stopped" });
  });

  it("speaks to the target in the second person", () => {
    expect(swapSteps(swap("pending_peer"), 4)[1].label).toBe("You accept");
  });
});

describe("leaveStatusText", () => {
  const req = (status: LeaveRequest["status"], by: string | null = null) => ({ status, decided_by_name: by }) as LeaveRequest;
  it("names who it is waiting for or who decided", () => {
    expect(leaveStatusText(req("pending"), "Meera")).toBe("Waiting for Meera");
    expect(leaveStatusText(req("pending"), null)).toBe("Waiting for approval");
    expect(leaveStatusText(req("approved", "Meera"), "Meera")).toBe("Approved by Meera");
    expect(leaveStatusText(req("rejected", "Meera"), "Meera")).toBe("Not approved by Meera");
  });

  it("calls the automatic birthday day what it is, with no approver to name", () => {
    const birthday = { status: "approved", decided_by_name: null, reason: "Birthday leave" } as LeaveRequest;
    expect(leaveStatusText(birthday, "Meera")).toBe("Birthday bonus, added for you");
  });
});

describe("plural", () => {
  it("pluralises and trims decimals", () => {
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(1.5, "day")).toBe("1.5 days");
  });
});
