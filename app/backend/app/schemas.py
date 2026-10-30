"""Request bodies. Types only: business rules (lengths, ranges, formats) are checked in the services, which
answer 400 VALIDATION_ERROR. A body of the wrong shape gets FastAPI's 422."""

from datetime import date

from pydantic import BaseModel, ConfigDict


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid")

    def sent(self, *nullable: str) -> dict:
        """Only the fields present in the request (PATCH semantics). An explicit null is kept for the fields named
        in `nullable` (e.g. team_id, manager_id) and ignored for the rest."""
        return {
            k: getattr(self, k) for k in self.model_fields_set if getattr(self, k) is not None or k in nullable
        }


class LoginRequest(Body):
    email: str
    password: str


class UserCreate(Body):
    name: str
    email: str
    role: str
    password: str
    team_id: int | None = None
    join_date: date | None = None
    date_of_birth: date | None = None


class UserUpdate(Body):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    team_id: int | None = None
    date_of_birth: date | None = None
    password: str | None = None


class TeamCreate(Body):
    name: str
    department: str = ""
    manager_id: int | None = None


class TeamUpdate(Body):
    name: str | None = None
    department: str | None = None
    manager_id: int | None = None


class LeaveTypeCreate(Body):
    name: str
    annual_entitlement: float
    carry_forward_cap: float


class LeaveTypeUpdate(Body):
    name: str | None = None
    annual_entitlement: float | None = None
    carry_forward_cap: float | None = None
    active: bool | None = None


class ShiftTemplateCreate(Body):
    team_id: int
    name: str
    start_time: str
    end_time: str
    days_of_week: list[int]
    min_headcount: int


class ShiftTemplateUpdate(Body):
    name: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    days_of_week: list[int] | None = None
    min_headcount: int | None = None
    active: bool | None = None


class AccrualMonthly(Body):
    year: int
    month: int


class AccrualYearEnd(Body):
    closing_year: int


class BalanceAdjustment(Body):
    user_id: int
    leave_type_id: int
    amount: float
    reason: str
    year: int | None = None


class LeaveRequestCreate(Body):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: str = ""


class Decision(Body):
    approve: bool
    comment: str = ""


class AssignmentCreate(Body):
    shift_template_id: int
    user_id: int
    date: date


class CopyWeek(Body):
    team_id: int
    week_start: date


class SwapCreate(Body):
    my_assignment_id: int
    their_assignment_id: int


class SwapRespond(Body):
    accept: bool
