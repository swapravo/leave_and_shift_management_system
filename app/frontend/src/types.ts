// Types mirroring docs/openapi.yaml. Hand-written (TRD 3.6); keep them in step with the contract.

export type Role = "employee" | "manager" | "hr_admin";
export type ISODate = string; // YYYY-MM-DD, IST calendar date

export interface Me {
  id: number;
  name: string;
  email: string;
  role: Role;
  team_id: number | null;
  team_name: string | null;
  managed_team_id: number | null;
  today: ISODate;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  team_id: number | null;
  team_name: string | null;
  join_date: ISODate;
  active: boolean;
  created_at: string;
  deactivated_at: string | null;
}

export interface Team {
  id: number;
  name: string;
  department: string;
  manager_id: number | null;
  manager_name: string | null;
  member_count: number;
  created_at: string;
}

export interface LeaveType {
  id: number;
  name: string;
  annual_entitlement: number;
  carry_forward_cap: number;
  active: boolean;
}

export interface ShiftTemplate {
  id: number;
  team_id: number;
  team_name: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  min_headcount: number;
  active: boolean;
}

export interface Balance {
  leave_type_id: number;
  leave_type: string;
  active: boolean;
  year: number;
  annual_entitlement: number;
  carry_forward_cap: number;
  accrued: number;
  carried_forward: number;
  adjustments: number;
  used: number;
  balance: number;
  pending: number;
  available: number;
}

export type LedgerKind = "accrual" | "carry_forward" | "year_end_close" | "leave_taken" | "leave_refund" | "adjustment";

export interface LedgerEntry {
  id: number;
  leave_type_id: number;
  leave_type: string;
  year: number;
  kind: LedgerKind;
  amount: number;
  period: string | null;
  leave_request_id: number | null;
  reason: string;
  created_by_name: string | null;
  created_at: string;
}

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: number;
  user_id: number;
  user_name: string;
  team_id: number | null;
  leave_type_id: number;
  leave_type: string;
  start_date: ISODate;
  end_date: ISODate;
  days: number;
  reason: string;
  status: LeaveStatus;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  cancelled_at: string | null;
  created_at: string;
  can_cancel: boolean;
  can_decide: boolean;
}

export interface RemovedShift {
  id: number;
  shift_template_id: number;
  shift_name: string;
  date: ISODate;
  status: "removed" | "restored" | "not_restored";
  note: string | null;
}

export interface RefundDay {
  date: ISODate;
  shifts_removed: number;
  status: "refunded" | "owed" | "forfeited";
  resolved_at: string | null;
}

export interface LeaveRequestDetail extends LeaveRequest {
  removed_shifts: RemovedShift[];
  refund_days: RefundDay[];
}

export interface CoverageViolation {
  date: ISODate;
  shift_template_id: number;
  shift_name: string;
  min_headcount: number;
  headcount_without_you: number;
}

export interface LeavePreview {
  days: number;
  available: number | null;
  remaining_after: number | null;
  violations: CoverageViolation[];
  errors: string[];
}

export interface Assignment {
  id: number;
  user_id: number;
  user_name: string;
  shift_template_id: number;
  shift_name: string;
  team_id: number;
  date: ISODate;
}

export interface MyShift {
  id: number;
  date: ISODate;
  shift_template_id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  team_id: number;
  team_name: string;
}

export interface CellPerson {
  assignment_id: number;
  user_id: number;
  user_name: string;
  leave_status: "pending" | "approved" | null;
}

export interface CoverageCell {
  shift_template_id: number;
  shift_name: string;
  team_id: number;
  team_name: string;
  date: ISODate;
  start_time: string;
  end_time: string;
  min_headcount: number;
  headcount: number;
  gap: boolean;
  assigned: CellPerson[];
}

export interface Member {
  id: number;
  name: string;
  role: Role;
  team_id: number;
}

export interface CalendarLeave {
  id: number;
  user_id: number;
  user_name: string;
  team_id: number;
  leave_type: string;
  start_date: ISODate;
  end_date: ISODate;
  days: number;
  status: "pending" | "approved";
}

export interface RosterView {
  team: Team;
  start: ISODate;
  end: ISODate;
  members: Member[];
  templates: ShiftTemplate[];
  leaves: CalendarLeave[];
  cells: CoverageCell[];
}

export interface CalendarView {
  start: ISODate;
  end: ISODate;
  teams: { id: number; name: string; department: string }[];
  members: Member[];
  leaves: CalendarLeave[];
  cells: CoverageCell[];
}

export interface CopyWeekResult {
  copied: number;
  skipped: string[];
}

export type SwapStatus = "pending_peer" | "pending_manager" | "approved" | "rejected" | "declined" | "cancelled";

export interface Swap {
  id: number;
  team_id: number;
  team_name: string;
  requester_id: number;
  requester_name: string;
  target_id: number;
  target_name: string;
  requester_shift_name: string;
  requester_date: ISODate;
  requester_start_time: string;
  requester_end_time: string;
  target_shift_name: string;
  target_date: ISODate;
  target_start_time: string;
  target_end_time: string;
  status: SwapStatus;
  decided_by_name: string | null;
  decision_comment: string | null;
  created_at: string;
  can_respond: boolean;
  can_cancel: boolean;
  can_decide: boolean;
}

export interface Availability {
  id: number;
  name: string;
  team_id: number;
  team_name: string;
  status: "on_shift" | "on_leave" | "off";
  shifts: string[];
  pending_leave_today: boolean;
}

export interface Dashboard {
  today: ISODate;
  teams: { id: number; name: string }[];
  pending_leave: LeaveRequest[];
  pending_swaps: Swap[];
  gaps_today: CoverageCell[];
  upcoming_gaps: CoverageCell[];
  availability: Availability[];
}

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  team_id: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
}

export interface Notification {
  id: number;
  kind: "approval" | "leave" | "swap" | "roster" | "coverage";
  message: string;
  link: string;
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  notifications: Notification[];
  unread: number;
}
