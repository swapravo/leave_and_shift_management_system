"""Settings from environment variables (TRD 3.7)."""

import logging
import os
import secrets
from dataclasses import dataclass
from datetime import date
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
log = logging.getLogger("lsm")


@dataclass(frozen=True)
class Settings:
    db_path: str
    jwt_secret: str
    jwt_hours: int
    cookie_secure: bool
    today: date | None
    test_mode: bool
    bcrypt_rounds: int
    frontend_dist: Path


def _flag(name: str) -> bool:
    return os.environ.get(name, "0").strip() in ("1", "true", "yes")


def load_settings() -> Settings:
    secret = os.environ.get("LSM_JWT_SECRET", "")
    if not secret:
        secret = secrets.token_urlsafe(32)
        log.warning("LSM_JWT_SECRET is not set: using a random secret, so sign-ins end when the server restarts")
    today = os.environ.get("LSM_TODAY")
    return Settings(
        db_path=os.environ.get("LSM_DB_PATH", str(BACKEND_DIR / "data" / "app.db")),
        jwt_secret=secret,
        jwt_hours=int(os.environ.get("LSM_JWT_HOURS", "8")),
        cookie_secure=_flag("LSM_COOKIE_SECURE"),
        today=date.fromisoformat(today) if today else None,
        test_mode=_flag("LSM_TEST_MODE"),
        bcrypt_rounds=int(os.environ.get("LSM_BCRYPT_ROUNDS", "12")),
        frontend_dist=Path(os.environ.get("LSM_FRONTEND_DIST", str(BACKEND_DIR.parent / "frontend" / "dist"))),
    )
