"""
Authentication routes — register, login, and profile retrieval.
"""

import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import get_db
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
async def register(body: UserCreate, conn: asyncpg.Connection = Depends(get_db)):
    # Check for duplicate email
    existing = await conn.fetchrow(
        "SELECT id FROM users WHERE email = $1", body.email
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    row = await conn.fetchrow(
        """
        INSERT INTO users (email, hashed_password, full_name)
        VALUES ($1, $2, $3)
        RETURNING *
        """,
        body.email,
        hash_password(body.password),
        body.full_name,
    )
    return dict(row)


@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate and receive a JWT access token",
)
async def login(body: UserLogin, conn: asyncpg.Connection = Depends(get_db)):
    user = await conn.fetchrow(
        "SELECT * FROM users WHERE email = $1", body.email
    )

    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(subject=str(user["id"]))
    return Token(access_token=access_token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve the authenticated user's profile",
)
async def get_me(current_user: asyncpg.Record = Depends(get_current_user)):
    return dict(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update the authenticated user's profile",
)
async def patch_me(
    body: UserUpdate,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return dict(current_user)

    set_clauses = []
    values = []
    for i, (key, value) in enumerate(update_data.items(), start=1):
        # Convert enum values to strings for DB storage
        if hasattr(value, "value"):
            value = value.value
        set_clauses.append(f"{key} = ${i}")
        values.append(value)

    values.append(current_user["id"])
    query = f"""
        UPDATE users SET {', '.join(set_clauses)}, updated_at = NOW()
        WHERE id = ${len(values)}
        RETURNING *
    """
    row = await conn.fetchrow(query, *values)
    return dict(row)
