"""
Shared FastAPI dependencies for authentication.
"""

import uuid

import asyncpg
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_access_token
from app.db.base import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    conn: asyncpg.Connection = Depends(get_db),
) -> asyncpg.Record:
    """
    Extract the Bearer token from the request, decode the JWT,
    and return the corresponding user row as an asyncpg.Record.

    Raises 401 if the token is missing, invalid, expired, or if
    the user no longer exists.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception

    user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_uuid)

    if user is None:
        raise credentials_exception

    return user
