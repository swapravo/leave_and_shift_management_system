"""P1 DB layer: aiosqlite connections, one transaction per request, small query helpers.

Connections run in autocommit mode (`isolation_level=None`) and transactions are opened explicitly:
`BEGIN` for reads, `BEGIN IMMEDIATE` for writes, so the write lock is held before any check runs.
"""

import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Iterable

import aiosqlite

SCHEMA_PATH = Path(__file__).with_name("schema.sql")

_db_path: str = ""


def configure(path: str) -> None:
    global _db_path
    _db_path = path
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)


async def connect(path: str | None = None) -> aiosqlite.Connection:
    conn = await aiosqlite.connect(path or _db_path, isolation_level=None)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    await conn.execute("PRAGMA busy_timeout = 5000")
    return conn


async def init_db(conn: aiosqlite.Connection) -> None:
    """Create the schema (idempotent), bring an older database up to date, and switch to WAL mode."""
    await conn.executescript(SCHEMA_PATH.read_text())
    await upgrade(conn)
    await conn.execute("PRAGMA journal_mode = WAL")


_OLD_APPROVAL_CHECK = "decided_by IS NOT NULL AND decided_at IS NOT NULL"


async def upgrade(conn: aiosqlite.Connection) -> None:
    """Schema 1 -> 2 (birthday leave) for a database created before it. A no-op on a current database.

    CREATE TABLE IF NOT EXISTS leaves existing tables as they were, so the two changes to existing tables are made
    here: users.date_of_birth (a plain column), and leave_requests, whose CHECK now lets the system's birthday grant
    be approved without a human approver (SQLite can't alter a CHECK, so the table is rebuilt, rows intact).
    """
    cols = {r["name"] for r in await fetch_all(conn, "PRAGMA table_info(users)")}
    if "date_of_birth" not in cols:
        await conn.execute(
            "ALTER TABLE users ADD COLUMN date_of_birth TEXT "
            "CHECK (date_of_birth IS NULL OR date(date_of_birth) IS date_of_birth)"
        )
    table_sql = await fetch_value(conn, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'leave_requests'")
    if table_sql and _OLD_APPROVAL_CHECK in table_sql:
        create = re.search(r"CREATE TABLE IF NOT EXISTS leave_requests \(.*?\) STRICT;", SCHEMA_PATH.read_text(), re.S)
        assert create, "leave_requests definition not found in schema.sql"
        fresh = create.group(0).replace("CREATE TABLE IF NOT EXISTS leave_requests", "CREATE TABLE leave_requests_new")
        # The documented 12-step rebuild: foreign keys off, copy, drop, rename. Child tables keep pointing at the name.
        await conn.executescript(
            f"PRAGMA foreign_keys = OFF; BEGIN; {fresh} "
            "INSERT INTO leave_requests_new SELECT * FROM leave_requests; "
            "DROP TABLE leave_requests; ALTER TABLE leave_requests_new RENAME TO leave_requests; COMMIT; "
            "PRAGMA foreign_keys = ON;"
        )
        await conn.executescript(SCHEMA_PATH.read_text())  # recreate the indexes the drop took with it
        broken = await fetch_all(conn, "PRAGMA foreign_key_check")
        assert not broken, f"foreign keys broken by the leave_requests rebuild: {broken}"
    await conn.execute("UPDATE schema_meta SET value = '2' WHERE key = 'schema_version' AND value < '2'")


def audit_trigger_statements() -> list[str]:
    """The CREATE TRIGGER statements from schema.sql, for the test reset (P5)."""
    return re.findall(r"CREATE TRIGGER.*?\bEND;", SCHEMA_PATH.read_text(), flags=re.S)


@asynccontextmanager
async def transaction(write: bool) -> AsyncIterator[aiosqlite.Connection]:
    conn = await connect()
    try:
        await conn.execute("BEGIN IMMEDIATE" if write else "BEGIN")
        try:
            yield conn
        except BaseException:
            await conn.rollback()
            raise
        else:
            await conn.commit()
    finally:
        await conn.close()


# --------------------------------------------------------------------------------------------------- helpers
async def fetch_one(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> dict | None:
    async with conn.execute(sql, params) as cur:
        row = await cur.fetchone()
    return dict(row) if row is not None else None


async def fetch_all(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> list[dict]:
    async with conn.execute(sql, params) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def fetch_value(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> Any:
    async with conn.execute(sql, params) as cur:
        row = await cur.fetchone()
    return row[0] if row is not None else None


async def execute(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> int:
    """Run a write; returns lastrowid for INSERTs, rowcount otherwise."""
    async with conn.execute(sql, params) as cur:
        return cur.lastrowid if sql.lstrip().upper().startswith("INSERT") else cur.rowcount


async def changes(conn: aiosqlite.Connection, sql: str, params: Iterable[Any] | dict = ()) -> int:
    """Run a write; returns the number of rows changed."""
    async with conn.execute(sql, params) as cur:
        return cur.rowcount


def placeholders(values: list) -> str:
    return ",".join("?" for _ in values) or "NULL"
