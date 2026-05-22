"""
Gamification routes — XP, streaks, leaderboard.
"""

import logging

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.db.base import get_db
from app.services.gamification import award_xp, _xp_for_next_level

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gamification", tags=["Gamification"])


class XPStatusResponse(BaseModel):
    total_xp: int
    level: int
    current_streak: int
    longest_streak: int
    xp_to_next_level: int
    recent_xp: list[dict] = []


class AwardXPRequest(BaseModel):
    source: str = Field(..., description="XP source: workout_complete, meal_logged, scan_food, plan_generated")
    description: str = Field("", max_length=200)


class AwardXPResponse(BaseModel):
    xp_awarded: int
    total_xp: int
    level: int
    current_streak: int
    longest_streak: int
    leveled_up: bool
    xp_to_next_level: int


@router.get("/status", response_model=XPStatusResponse, summary="Get XP and streak status")
async def get_xp_status(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    streak = await conn.fetchrow(
        "SELECT * FROM user_streaks WHERE user_id = $1",
        current_user["id"],
    )

    if not streak:
        return XPStatusResponse(
            total_xp=0, level=1, current_streak=0, longest_streak=0,
            xp_to_next_level=100, recent_xp=[],
        )

    recent = await conn.fetch(
        """
        SELECT xp_amount, source, description
        FROM xp_ledger
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 10
        """,
        current_user["id"],
    )
    recent_entries = [
        {"xp": e["xp_amount"], "source": e["source"], "description": e["description"] or ""}
        for e in recent
    ]

    return XPStatusResponse(
        total_xp=streak["total_xp"],
        level=streak["level"],
        current_streak=streak["current_streak"],
        longest_streak=streak["longest_streak"],
        xp_to_next_level=_xp_for_next_level(streak["level"]) - streak["total_xp"],
        recent_xp=recent_entries,
    )


@router.post("/award", response_model=AwardXPResponse, summary="Award XP for an action")
async def award_xp_endpoint(
    body: AwardXPRequest,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    result = await award_xp(conn, current_user["id"], body.source, body.description)
    return AwardXPResponse(**result)
