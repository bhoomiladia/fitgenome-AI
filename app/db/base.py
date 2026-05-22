"""
Async PostgreSQL connection pool using asyncpg.

Provides:
    - init_pool()  / close_pool()  — lifecycle management
    - get_db()                     — FastAPI dependency yielding a connection
"""

import asyncpg

from app.core.config import settings

pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """Create the global asyncpg connection pool."""
    global pool
    pool = await asyncpg.create_pool(
        settings.DATABASE_URL,
        min_size=5,
        max_size=20,
    )


async def close_pool() -> None:
    """Gracefully close the connection pool."""
    global pool
    if pool:
        await pool.close()
        pool = None


async def get_db():
    """
    FastAPI dependency that yields an asyncpg connection.

    Usage in routes:
        async def my_route(conn = Depends(get_db)):
            row = await conn.fetchrow("SELECT ...")
    """
    if pool is None:
        raise RuntimeError("Database pool is not initialized")

    async with pool.acquire() as conn:
        yield conn
