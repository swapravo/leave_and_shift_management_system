"""FastAPI app factory: `uvicorn app.main:create_app --factory` (run from app/backend)."""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import auth, clock, db, errors
from .config import Settings, load_settings
from .routers import api, test_api
from .services import accrual, birthday, leave

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_log = logging.getLogger("lsm")
_HOUSEKEEPING_SECONDS = 3600


async def startup(settings: Settings) -> None:
    """Architecture 4.7: schema, WAL, housekeeping, accrual catch-up."""
    conn = await db.connect()
    try:
        await db.init_db(conn)
        await conn.execute("BEGIN IMMEDIATE")
        await leave.expire_owed_days(conn)
        await accrual.catch_up(conn)
        await birthday.run(conn)
        await conn.commit()
    finally:
        await conn.close()


async def _housekeeping() -> None:
    """Birthdays keep arriving while the server stays up, so look again every hour (idempotent)."""
    while True:
        await asyncio.sleep(_HOUSEKEEPING_SECONDS)
        try:
            async with db.transaction(write=True) as conn:
                await birthday.run(conn)
        except Exception:  # keep the loop alive; the next hour tries again
            _log.exception("Birthday housekeeping failed")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    clock.set_today(settings.today)
    auth.configure(settings.jwt_secret, settings.jwt_hours, settings.cookie_secure, settings.bcrypt_rounds)
    db.configure(settings.db_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await startup(settings)
        task = asyncio.create_task(_housekeeping())
        try:
            yield
        finally:
            task.cancel()

    app = FastAPI(title="Leave & Shift Management System API", version="0.1.0", lifespan=lifespan)
    errors.install(app)

    @app.middleware("http")
    async def json_only_writes(request: Request, call_next):
        # CSRF defence alongside the SameSite=Lax cookie: write requests with a body must be JSON.
        if request.method in _WRITE_METHODS and request.url.path.startswith("/api/"):
            has_body = request.headers.get("content-length", "0") not in ("", "0") or "transfer-encoding" in request.headers
            content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
            if has_body and content_type != "application/json":
                return JSONResponse(
                    errors.error_body("Request body must be JSON (Content-Type: application/json)", "VALIDATION_ERROR"),
                    status_code=415,
                )
        return await call_next(request)

    app.include_router(api)
    if settings.test_mode:
        app.include_router(test_api)

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    async def api_not_found(path: str):
        return JSONResponse(errors.error_body("Not found", "NOT_FOUND"), status_code=404)

    _mount_frontend(app, settings.frontend_dist)
    return app


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve the built SPA, falling back to index.html for client-side routes."""
    index = dist / "index.html"
    if not index.is_file():
        return
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)
