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
    """Create the schema (idempotent) and switch the database to WAL mode."""
    await conn.executescript(SCHEMA_PATH.read_text())
    await conn.execute("PRAGMA journal_mode = WAL")


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
