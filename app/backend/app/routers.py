"""HTTP routers. Thin: parse and validate the request, call one service function, return its result.
Routers hold no SQL and no business rules (architecture 4.3)."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Query, Response

from . import auth, clock, db, seed
from .auth import PublicWriteConn, ReadCtx, WriteCtx
from .errors import Unauthorized
from .schemas import (
    AccrualMonthly, AccrualYearEnd, AssignmentCreate, BalanceAdjustment, CopyWeek, Decision, LeaveRequestCreate,
    LeaveTypeCreate, LeaveTypeUpdate, LoginRequest, ShiftTemplateCreate, ShiftTemplateUpdate, SwapCreate,
    SwapRespond, TeamCreate, TeamUpdate, UserCreate, UserUpdate,
)
from .services import (
    accrual, audit, leave, leave_types, notify, org, roster, shift_templates, swaps, views,
)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["auth"])
async def health() -> dict:
    return {"ok": True}


# ------------------------------------------------------------------------------------------------- auth (C1)
@api.post("/auth/login", tags=["auth"])
async def login(body: LoginRequest, response: Response, conn: PublicWriteConn) -> dict:
    email = body.email.strip().lower()
    user = await db.fetch_one(conn, "SELECT id, password_hash, active FROM users WHERE email = ?", (email,))
    ok = await auth.verify_password(body.password, user["password_hash"] if user else auth._DUMMY_HASH)
    if not user or not user["active"] or not ok:
        raise Unauthorized("Invalid email or password")
    full = await auth.load_user(conn, user["id"])
    await audit.record(conn, full, "user.login", "user", full["id"], team_id=full["team_id"])
    auth.set_cookie(response, auth.issue_token(full["id"]))
    return auth.me(full)


@api.post("/auth/logout", tags=["auth"], status_code=204)
async def logout(response: Response) -> None:
    auth.clear_cookie(response)


@api.get("/auth/me", tags=["auth"])
async def get_me(ctx: ReadCtx) -> dict:
    return auth.me(ctx.user)


# ------------------------------------------------------------------------------------------------- users, teams (C2)
@api.get("/users", tags=["users"])
async def list_users(ctx: ReadCtx, include_inactive: bool = False, team_id: int | None = None) -> list[dict]:
    return await org.list_users(ctx, include_inactive, team_id)


@api.post("/users", tags=["users"], status_code=201)
async def create_user(body: UserCreate, ctx: WriteCtx) -> dict:
    return await org.create_user(ctx, body.name, body.email, body.role, body.team_id, body.password, body.join_date,
                                 body.date_of_birth)


@api.patch("/users/{user_id}", tags=["users"])
async def update_user(user_id: int, body: UserUpdate, ctx: WriteCtx) -> dict:
    return await org.update_user(ctx, user_id, body.sent("team_id", "date_of_birth"))


@api.delete("/users/{user_id}", tags=["users"])
async def deactivate_user(user_id: int, ctx: WriteCtx) -> dict:
    return await org.deactivate_user(ctx, user_id)


@api.get("/teams", tags=["teams"])
async def list_teams(ctx: ReadCtx) -> list[dict]:
    return await org.list_teams(ctx)


@api.post("/teams", tags=["teams"], status_code=201)
async def create_team(body: TeamCreate, ctx: WriteCtx) -> dict:
    return await org.create_team(ctx, body.name, body.department, body.manager_id)


@api.patch("/teams/{team_id}", tags=["teams"])
async def update_team(team_id: int, body: TeamUpdate, ctx: WriteCtx) -> dict:
    return await org.update_team(ctx, team_id, body.sent("manager_id"))


# ------------------------------------------------------------------------------------------------- leave types (C3)
@api.get("/leave-types", tags=["leave-types"])
async def list_leave_types(ctx: ReadCtx, include_inactive: bool = False) -> list[dict]:
    return await leave_types.list_types(ctx, include_inactive)


@api.post("/leave-types", tags=["leave-types"], status_code=201)
async def create_leave_type(body: LeaveTypeCreate, ctx: WriteCtx) -> dict:
    return await leave_types.create_type(ctx, body.name, body.annual_entitlement, body.carry_forward_cap)


@api.patch("/leave-types/{leave_type_id}", tags=["leave-types"])
async def update_leave_type(leave_type_id: int, body: LeaveTypeUpdate, ctx: WriteCtx) -> dict:
    return await leave_types.update_type(ctx, leave_type_id, body.sent())


# ------------------------------------------------------------------------------------------------- shift templates (C4)
@api.get("/shift-templates", tags=["shift-templates"])
async def list_shift_templates(ctx: ReadCtx, team_id: int | None = None, include_inactive: bool = False) -> list[dict]:
    return await shift_templates.list_templates(ctx, team_id, include_inactive)


@api.post("/shift-templates", tags=["shift-templates"], status_code=201)
async def create_shift_template(body: ShiftTemplateCreate, ctx: WriteCtx) -> dict:
    return await shift_templates.create_template(
        ctx, body.team_id, body.name, body.start_time, body.end_time, body.days_of_week, body.min_headcount
    )


@api.patch("/shift-templates/{template_id}", tags=["shift-templates"])
async def update_shift_template(template_id: int, body: ShiftTemplateUpdate, ctx: WriteCtx) -> dict:
    return await shift_templates.update_template(ctx, template_id, body.sent())


# ------------------------------------------------------------------------------------------------- accrual, balances (C5)
@api.post("/accrual/monthly", tags=["accrual"])
async def run_monthly(body: AccrualMonthly, ctx: WriteCtx) -> dict:
    return {"entries_created": await accrual.run_monthly_manual(ctx, body.year, body.month)}


@api.post("/accrual/year-end", tags=["accrual"])
async def run_year_end(body: AccrualYearEnd, ctx: WriteCtx) -> dict:
    return {"balances_closed": await accrual.run_year_end_manual(ctx, body.closing_year)}


@api.get("/balances", tags=["balances"])
async def get_balances(ctx: ReadCtx, user_id: int | None = None, year: int | None = None) -> list[dict]:
    return await accrual.get_balances(ctx, user_id, year)


@api.get("/balances/ledger", tags=["balances"])
async def get_ledger(ctx: ReadCtx, user_id: int | None = None, year: int | None = None) -> list[dict]:
    return await accrual.get_ledger(ctx, user_id, year)


@api.post("/balances/adjustments", tags=["balances"])
async def adjust_balance(body: BalanceAdjustment, ctx: WriteCtx) -> list[dict]:
    return await accrual.adjust(ctx, body.user_id, body.leave_type_id, body.amount, body.reason, body.year)


# ------------------------------------------------------------------------------------------------- leave (C6)
@api.get("/leave-requests", tags=["leave"])
async def list_leave(ctx: ReadCtx, scope: Literal["mine", "pending", "decided"] = Query()) -> list[dict]:
    return await leave.list_requests(ctx, scope)


@api.post("/leave-requests", tags=["leave"], status_code=201)
async def apply_leave(body: LeaveRequestCreate, ctx: WriteCtx) -> dict:
    return await leave.apply(ctx, body.leave_type_id, body.start_date, body.end_date, body.reason)


@api.post("/leave-requests/preview", tags=["leave"])
async def preview_leave(body: LeaveRequestCreate, ctx: ReadCtx) -> dict:
    return await leave.preview(ctx, body.leave_type_id, body.start_date, body.end_date)


@api.get("/leave-requests/{leave_id}", tags=["leave"])
async def get_leave(leave_id: int, ctx: ReadCtx) -> dict:
    return await leave.get_request(ctx, leave_id)


@api.post("/leave-requests/{leave_id}/decision", tags=["leave"])
async def decide_leave(leave_id: int, body: Decision, ctx: WriteCtx) -> dict:
    return await leave.decide(ctx, leave_id, body.approve, body.comment)


@api.post("/leave-requests/{leave_id}/cancel", tags=["leave"])
async def cancel_leave(leave_id: int, ctx: WriteCtx) -> dict:
    return await leave.cancel(ctx, leave_id)


# ------------------------------------------------------------------------------------------------- roster (C7)
@api.get("/roster", tags=["roster"])
async def get_roster(ctx: ReadCtx, team_id: int, start: date, end: date) -> dict:
    return await roster.roster_view(ctx, team_id, start, end)


@api.post("/roster/assignments", tags=["roster"], status_code=201)
async def assign(body: AssignmentCreate, ctx: WriteCtx) -> dict:
    return await roster.assign(ctx, body.shift_template_id, body.user_id, body.date)


@api.delete("/roster/assignments/{assignment_id}", tags=["roster"], status_code=204)
async def unassign(assignment_id: int, ctx: WriteCtx) -> None:
    await roster.unassign(ctx, assignment_id)


@api.post("/roster/copy-week", tags=["roster"])
async def copy_week(body: CopyWeek, ctx: WriteCtx) -> dict:
    return await roster.copy_week(ctx, body.team_id, body.week_start)


@api.get("/roster/mine", tags=["roster"])
async def my_shifts(ctx: ReadCtx, start: date | None = None, end: date | None = None) -> list[dict]:
    return await roster.my_shifts(ctx, start, end)


# ------------------------------------------------------------------------------------------------- swaps (C8)
@api.get("/swaps", tags=["swaps"])
async def list_swaps(ctx: ReadCtx) -> list[dict]:
    return await swaps.list_swaps(ctx)


@api.post("/swaps", tags=["swaps"], status_code=201)
async def propose_swap(body: SwapCreate, ctx: WriteCtx) -> dict:
    return await swaps.propose(ctx, body.my_assignment_id, body.their_assignment_id)


@api.post("/swaps/{swap_id}/respond", tags=["swaps"])
async def respond_swap(swap_id: int, body: SwapRespond, ctx: WriteCtx) -> dict:
    return await swaps.respond(ctx, swap_id, body.accept)


@api.post("/swaps/{swap_id}/cancel", tags=["swaps"])
async def cancel_swap(swap_id: int, ctx: WriteCtx) -> dict:
    return await swaps.cancel(ctx, swap_id)


@api.post("/swaps/{swap_id}/decision", tags=["swaps"])
async def decide_swap(swap_id: int, body: Decision, ctx: WriteCtx) -> dict:
    return await swaps.decide(ctx, swap_id, body.approve, body.comment)


# ------------------------------------------------------------------------------------------------- views (C10)
@api.get("/calendar", tags=["views"])
async def get_calendar(ctx: ReadCtx, start: date, end: date, team_id: int | None = None) -> dict:
    return await views.calendar(ctx, start, end, team_id)


@api.get("/dashboard", tags=["views"])
async def get_dashboard(ctx: ReadCtx) -> dict:
    return await views.dashboard(ctx)


# ------------------------------------------------------------------------------------------------- audit (C11)
@api.get("/audit", tags=["audit"])
async def get_audit(
    ctx: ReadCtx,
    actor_id: int | None = None,
    entity_type: str | None = None,
    start: date | None = None,
    end: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    return await audit.list_entries(ctx, actor_id, entity_type, start, end, limit, offset)


# ------------------------------------------------------------------------------------------------- notifications (C12)
@api.get("/notifications", tags=["notifications"])
async def list_notifications(ctx: ReadCtx, unread_only: bool = False) -> dict:
    return await notify.list_mine(ctx, unread_only)


@api.post("/notifications/read-all", tags=["notifications"], status_code=204)
async def read_all(ctx: WriteCtx) -> None:
    await notify.mark_all_read(ctx)


@api.post("/notifications/{notification_id}/read", tags=["notifications"], status_code=204)
async def read_one(notification_id: int, ctx: WriteCtx) -> None:
    await notify.mark_read(ctx, notification_id)


# ------------------------------------------------------------------------------------------------- test support (P5)
test_api = APIRouter(prefix="/api/test", tags=["test"])


@test_api.post("/reset")
async def reset(conn: PublicWriteConn) -> dict:
    """Only registered when LSM_TEST_MODE=1: wipe everything and reload the deterministic seed."""
    await seed.reset(conn)
    return {"today": clock.today().isoformat()}
