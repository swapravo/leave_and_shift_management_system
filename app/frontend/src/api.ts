// One API client for the whole app: same-origin fetch with the auth cookie, JSON in and out,
// and every error turned into an ApiError carrying the backend's stable `code`.
import type {
  Assignment, AuditPage, Balance, CalendarView, CopyWeekResult, Dashboard, LeavePreview, LeaveRequest,
  LeaveRequestDetail, LeaveType, LedgerEntry, Me, MyShift, NotificationList, Role, RosterView, ShiftTemplate,
  Swap, Team, User,
} from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Turn any error body into an ApiError: our {detail, code, details} shape or FastAPI's 422 list. */
export function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object" && "detail" in body) {
    const b = body as { detail: unknown; code?: unknown; details?: unknown };
    if (typeof b.detail === "string") {
      return new ApiError(status, typeof b.code === "string" ? b.code : codeFor(status), b.detail,
        Array.isArray(b.details) ? b.details : []);
    }
    if (Array.isArray(b.detail)) {
      const parts = b.detail.map((item) => {
        const it = item as { loc?: unknown[]; msg?: string };
        const field = Array.isArray(it.loc) ? it.loc.filter((p) => p !== "body").join(".") : "";
        return field ? `${field}: ${it.msg ?? "invalid"}` : (it.msg ?? "invalid");
      });
      return new ApiError(status, "VALIDATION_ERROR", parts.join("; ") || "The request was not valid", b.detail);
    }
  }
  return new ApiError(status, codeFor(status), status >= 500 ? "Something went wrong on the server" : "Request failed");
}

function codeFor(status: number): string {
  return ({ 400: "VALIDATION_ERROR", 401: "NOT_AUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND" } as Record<number, string>)[status]
    ?? (status === 409 ? "INVALID_STATE" : "ERROR");
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

let onUnauthorized: (() => void) | null = null;
/** Called when any request (other than login) answers 401, so the app can return to the login page. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  let res: Response;
  try {
    res = await fetch(withQuery(`/api${path}`, query), {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = toApiError(res.status, data);
    if (res.status === 401 && path !== "/auth/login" && onUnauthorized) onUnauthorized();
    throw err;
  }
  return data as T;
}

const get = <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

export const api = {
  // auth
  login: (email: string, password: string) => post<Me>("/auth/login", { email, password }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => get<Me>("/auth/me"),
  // users & teams
  users: (q: { include_inactive?: boolean; team_id?: number } = {}) => get<User[]>("/users", q),
  createUser: (b: { name: string; email: string; role: Role; team_id: number | null; password: string; join_date?: string;
    date_of_birth?: string }) =>
    post<User>("/users", b),
  updateUser: (id: number, b: Partial<{ name: string; email: string; role: Role; team_id: number | null; password: string;
    date_of_birth: string | null }>) =>
    patch<User>(`/users/${id}`, b),
  deactivateUser: (id: number) => del<User>(`/users/${id}`),
  teams: () => get<Team[]>("/teams"),
  createTeam: (b: { name: string; department: string; manager_id: number | null }) => post<Team>("/teams", b),
  updateTeam: (id: number, b: Partial<{ name: string; department: string; manager_id: number | null }>) =>
    patch<Team>(`/teams/${id}`, b),
  // configuration
  leaveTypes: (include_inactive = false) => get<LeaveType[]>("/leave-types", { include_inactive }),
  createLeaveType: (b: { name: string; annual_entitlement: number; carry_forward_cap: number }) =>
    post<LeaveType>("/leave-types", b),
  updateLeaveType: (id: number, b: Partial<Omit<LeaveType, "id">>) => patch<LeaveType>(`/leave-types/${id}`, b),
  shiftTemplates: (q: { team_id?: number; include_inactive?: boolean } = {}) => get<ShiftTemplate[]>("/shift-templates", q),
  createShiftTemplate: (b: Omit<ShiftTemplate, "id" | "team_name" | "active">) => post<ShiftTemplate>("/shift-templates", b),
  updateShiftTemplate: (id: number, b: Partial<Omit<ShiftTemplate, "id" | "team_id" | "team_name">>) =>
    patch<ShiftTemplate>(`/shift-templates/${id}`, b),
  // accrual & balances
  runMonthly: (year: number, month: number) => post<{ entries_created: number }>("/accrual/monthly", { year, month }),
  runYearEnd: (closing_year: number) => post<{ balances_closed: number }>("/accrual/year-end", { closing_year }),
  balances: (q: { user_id?: number; year?: number } = {}) => get<Balance[]>("/balances", q),
  ledger: (q: { user_id?: number; year?: number } = {}) => get<LedgerEntry[]>("/balances/ledger", q),
  adjustBalance: (b: { user_id: number; leave_type_id: number; amount: number; reason: string; year?: number }) =>
    post<Balance[]>("/balances/adjustments", b),
  // leave
  leaveRequests: (scope: "mine" | "pending" | "decided") => get<LeaveRequest[]>("/leave-requests", { scope }),
  leaveRequest: (id: number) => get<LeaveRequestDetail>(`/leave-requests/${id}`),
  previewLeave: (b: { leave_type_id: number; start_date: string; end_date: string }) =>
    post<LeavePreview>("/leave-requests/preview", b),
  applyLeave: (b: { leave_type_id: number; start_date: string; end_date: string; reason: string }) =>
    post<LeaveRequest>("/leave-requests", b),
  decideLeave: (id: number, approve: boolean, comment = "") =>
    post<LeaveRequest>(`/leave-requests/${id}/decision`, { approve, comment }),
  cancelLeave: (id: number) => post<LeaveRequestDetail>(`/leave-requests/${id}/cancel`),
  // roster
  roster: (team_id: number, start: string, end: string) => get<RosterView>("/roster", { team_id, start, end }),
  assign: (shift_template_id: number, user_id: number, date: string) =>
    post<Assignment>("/roster/assignments", { shift_template_id, user_id, date }),
  unassign: (id: number) => del<void>(`/roster/assignments/${id}`),
  copyWeek: (team_id: number, week_start: string) => post<CopyWeekResult>("/roster/copy-week", { team_id, week_start }),
  myShifts: (q: { start?: string; end?: string } = {}) => get<MyShift[]>("/roster/mine", q),
  // swaps
  swaps: () => get<Swap[]>("/swaps"),
  proposeSwap: (my_assignment_id: number, their_assignment_id: number) =>
    post<Swap>("/swaps", { my_assignment_id, their_assignment_id }),
  respondSwap: (id: number, accept: boolean) => post<Swap>(`/swaps/${id}/respond`, { accept }),
  cancelSwap: (id: number) => post<Swap>(`/swaps/${id}/cancel`),
  decideSwap: (id: number, approve: boolean, comment = "") => post<Swap>(`/swaps/${id}/decision`, { approve, comment }),
  // views
  calendar: (start: string, end: string, team_id?: number) => get<CalendarView>("/calendar", { start, end, team_id }),
  dashboard: () => get<Dashboard>("/dashboard"),
  // audit & notifications
  audit: (q: { actor_id?: number; entity_type?: string; start?: string; end?: string; limit?: number; offset?: number }) =>
    get<AuditPage>("/audit", q),
  notifications: (unread_only = false) => get<NotificationList>("/notifications", { unread_only }),
  readNotification: (id: number) => post<void>(`/notifications/${id}/read`),
  readAllNotifications: () => post<void>("/notifications/read-all"),
};
