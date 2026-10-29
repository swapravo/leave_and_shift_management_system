"""C1 Identity & Access: password hashing, JWT cookie, the per-request context and role checks."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated, AsyncIterator

import aiosqlite
import anyio
import bcrypt
import jwt
from fastapi import Depends, Request, Response

from . import clock, db
from .errors import Forbidden, Unauthorized

COOKIE = "lsm_token"
ROLES = ("employee", "manager", "hr_admin")

_secret = ""
_hours = 8
_secure = False
_rounds = 12


def configure(secret: str, hours: int, secure: bool, rounds: int) -> None:
    global _secret, _hours, _secure, _rounds
    _secret, _hours, _secure, _rounds = secret, hours, secure, rounds


# --------------------------------------------------------------------------------------------------- passwords
def hash_password_sync(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=_rounds)).decode()


async def hash_password(password: str) -> str:
    return await anyio.to_thread.run_sync(hash_password_sync, password)


async def verify_password(password: str, hashed: str) -> bool:
    def check() -> bool:
        try:
            return bcrypt.checkpw(password.encode(), hashed.encode())
        except ValueError:
            return False

    return await anyio.to_thread.run_sync(check)


# A real hash to compare against when the email is unknown, so both cases take the same time.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=4)).decode()


# --------------------------------------------------------------------------------------------------- tokens
def issue_token(user_id: int) -> str:
    iat = clock.real_now()
    payload = {"sub": str(user_id), "iat": int(iat.timestamp()), "exp": int((iat + timedelta(hours=_hours)).timestamp())}
    return jwt.encode(payload, _secret, algorithm="HS256")


def set_cookie(response: Response, token: str) -> None:
    response.set_cookie(COOKIE, token, max_age=_hours * 3600, httponly=True, samesite="lax", path="/", secure=_secure)


def clear_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="lax", secure=_secure)


async def load_user(conn: aiosqlite.Connection, user_id: int) -> dict | None:
    return await db.fetch_one(
        conn,
        """SELECT u.id, u.name, u.email, u.role, u.team_id, u.active, u.join_date, u.password_changed_at,
                  t.name AS team_name,
                  (SELECT m.id FROM teams m WHERE m.manager_id = u.id) AS managed_team_id
             FROM users u LEFT JOIN teams t ON t.id = u.team_id
            WHERE u.id = ?""",
        (user_id,),
    )


async def user_from_token(conn: aiosqlite.Connection, token: str | None) -> dict:
    if not token:
        raise Unauthorized("Not signed in")
    try:
        claims = jwt.decode(token, _secret, algorithms=["HS256"], options={"require": ["sub", "iat", "exp"]})
        user_id = int(claims["sub"])
    except (jwt.PyJWTError, ValueError):
        raise Unauthorized("Your session has expired. Please sign in again.")
    user = await load_user(conn, user_id)
    if user is None or not user["active"]:
        raise Unauthorized("Your session has expired. Please sign in again.")
    changed = int(datetime.fromisoformat(user["password_changed_at"]).timestamp())
    if claims["iat"] < changed:
        raise Unauthorized("Your password was changed. Please sign in again.")
    return user


def me(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "team_id": user["team_id"],
        "team_name": user["team_name"],
        "managed_team_id": user["managed_team_id"],
        "today": clock.today().isoformat(),
    }


# --------------------------------------------------------------------------------------------------- request context
@dataclass
class Ctx:
    conn: aiosqlite.Connection
    user: dict

    @property
    def is_hr(self) -> bool:
        return self.user["role"] == "hr_admin"


async def _read_ctx(request: Request) -> AsyncIterator[Ctx]:
    async with db.transaction(write=False) as conn:
        yield Ctx(conn, await user_from_token(conn, request.cookies.get(COOKIE)))


async def _write_ctx(request: Request) -> AsyncIterator[Ctx]:
    async with db.transaction(write=True) as conn:
        yield Ctx(conn, await user_from_token(conn, request.cookies.get(COOKIE)))


async def _write_conn() -> AsyncIterator[aiosqlite.Connection]:
    async with db.transaction(write=True) as conn:
        yield conn


# scope="function": the transaction commits before the response is sent.
ReadCtx = Annotated[Ctx, Depends(_read_ctx, scope="function")]
WriteCtx = Annotated[Ctx, Depends(_write_ctx, scope="function")]
PublicWriteConn = Annotated[aiosqlite.Connection, Depends(_write_conn, scope="function")]


def require_roles(user: dict, *roles: str) -> None:
    if user["role"] not in roles:
        raise Forbidden("You don't have access to this")
