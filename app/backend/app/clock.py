"""P2 Clock: the only source of "today" and "now" (IST). Nothing else calls date.today() or datetime.now().

`set_today` pins the date (tests, demos via LSM_TODAY); the time of day still comes from the real clock unless
`set_time` pins it too.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

_today: date | None = None
_time: time | None = None


def set_today(value: date | None) -> None:
    global _today
    _today = value


def set_time(value: time | None) -> None:
    global _time
    _time = value


def now() -> datetime:
    real = datetime.now(IST)
    day = _today or real.date()
    moment = _time or real.time().replace(tzinfo=None)
    return datetime.combine(day, moment, IST).replace(microsecond=0)


def today() -> date:
    return now().date()


def now_iso() -> str:
    return now().isoformat(timespec="seconds")


def real_now() -> datetime:
    """The real wall clock, never pinned. Used for security timestamps (token iat, password_changed_at)."""
    return datetime.now(IST).replace(microsecond=0)


def days(start: date, end: date):
    """Every date from start to end, inclusive."""
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)
