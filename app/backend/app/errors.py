"""P3 Errors: domain exceptions rendered as {"detail", "code", "details"} (LLD 2.0)."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class DomainError(Exception):
    status = 400
    default_code = "VALIDATION_ERROR"

    def __init__(self, message: str, code: str | None = None, details: list | None = None):
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code
        self.details = details or []


class ValidationFailed(DomainError):
    status = 400
    default_code = "VALIDATION_ERROR"


class Unauthorized(DomainError):
    status = 401
    default_code = "NOT_AUTHENTICATED"


class Forbidden(DomainError):
    status = 403
    default_code = "FORBIDDEN"


class NotFound(DomainError):
    status = 404
    default_code = "NOT_FOUND"


class Conflict(DomainError):
    status = 409
    default_code = "INVALID_STATE"


def error_body(message: str, code: str, details: list | None = None) -> dict:
    return {"detail": message, "code": code, "details": details or []}


_HTTP_CODES = {401: "NOT_AUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "VALIDATION_ERROR"}


def install(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError):
        return JSONResponse(error_body(exc.message, exc.code, exc.details), status_code=exc.status)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = _HTTP_CODES.get(exc.status_code, "VALIDATION_ERROR")
        return JSONResponse(error_body(str(exc.detail), code), status_code=exc.status_code)
