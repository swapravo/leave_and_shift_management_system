// Plain-language wording for statuses, and the step lists behind the progress lines.
import { formatDays } from "./dates";
import type { LeaveRequest, Swap } from "./types";

/** The reason the backend gives the leave it books on someone's birthday. */
export const BIRTHDAY_LEAVE_REASON = "Birthday leave";

export type StepState = "done" | "current" | "todo" | "stopped";
export interface Step {
  label: string;
  state: StepState;
}

const who = (name: string, meId: number, id: number) => (id === meId ? "You" : name);

/** "You offered → Priya accepts → Manager approves", with where it has got to. */
export function swapSteps(s: Swap, meId: number): Step[] {
  const first = `${who(s.requester_name, meId, s.requester_id)} ${s.requester_id === meId ? "offered" : "offers"}`;
  const second = `${who(s.target_name, meId, s.target_id)} ${s.target_id === meId ? "accept" : "accepts"}`;
  const third = s.status === "approved" ? `Approved${s.decided_by_name ? ` by ${s.decided_by_name}` : ""}` : "Manager approves";
  switch (s.status) {
    case "pending_peer":
      return [{ label: first, state: "done" }, { label: second, state: "current" }, { label: third, state: "todo" }];
    case "pending_manager":
      return [{ label: first, state: "done" }, { label: `${second.replace(/ accepts?$/, "")} accepted`, state: "done" },
        { label: third, state: "current" }];
    case "approved":
      return [{ label: first, state: "done" }, { label: `${s.target_name} accepted`, state: "done" }, { label: third, state: "done" }];
    case "declined":
      return [{ label: first, state: "done" }, { label: `${s.target_name} declined`, state: "stopped" }, { label: third, state: "todo" }];
    case "rejected":
      return [{ label: first, state: "done" }, { label: `${s.target_name} accepted`, state: "done" },
        { label: `Not approved${s.decided_by_name ? ` by ${s.decided_by_name}` : ""}`, state: "stopped" }];
    default:
      return [{ label: first, state: "done" }, { label: "Cancelled", state: "stopped" }];
  }
}

/** One line for a leave request: who it is waiting for, or who decided. */
export function leaveStatusText(r: LeaveRequest, approver: string | null): string {
  if (r.reason === BIRTHDAY_LEAVE_REASON && r.status === "approved") return "Birthday bonus, added for you";
  switch (r.status) {
    case "pending":
      return approver ? `Waiting for ${approver}` : "Waiting for approval";
    case "approved":
      return r.decided_by_name ? `Approved by ${r.decided_by_name}` : "Approved";
    case "rejected":
      return `Not approved${r.decided_by_name ? ` by ${r.decided_by_name}` : ""}`;
    default:
      return "Cancelled";
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatDays(n)} ${n === 1 ? one : many}`;
}
