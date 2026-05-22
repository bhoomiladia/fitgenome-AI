"""
Admin Analytics Dashboard — Retention metrics (D1/D7/D30).
"""

import logging
from datetime import datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.base import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/analytics", tags=["Admin Analytics"])


class RetentionMetrics(BaseModel):
    total_users: int
    onboarded_users: int
    day_1_retention: float
    day_7_retention: float
    day_30_retention: float
    active_today: int
    active_this_week: int
    avg_streak: float
    top_level: int
    total_workouts_logged: int
    total_meals_logged: int
    avg_xp_per_user: float


@router.get(
    "/retention",
    response_model=RetentionMetrics,
    summary="Admin retention and engagement metrics",
)
async def get_retention_metrics(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    day_1_cutoff = now - timedelta(days=1)
    day_7_cutoff = now - timedelta(days=7)
    day_30_cutoff = now - timedelta(days=30)

    # Total users
    total_users = await conn.fetchval("SELECT COUNT(id) FROM users")
    onboarded = await conn.fetchval(
        "SELECT COUNT(id) FROM users WHERE is_onboarded = TRUE"
    )

    if total_users == 0:
        return RetentionMetrics(
            total_users=0, onboarded_users=0,
            day_1_retention=0, day_7_retention=0, day_30_retention=0,
            active_today=0, active_this_week=0,
            avg_streak=0, top_level=0,
            total_workouts_logged=0, total_meals_logged=0, avg_xp_per_user=0,
        )

    # D1 retention: users who logged anything within 24h
    d1_retained = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM nutrition_logs WHERE logged_at >= $1",
        day_1_cutoff,
    )

    # D7 retention
    d7_retained = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM nutrition_logs WHERE logged_at >= $1",
        day_7_cutoff,
    )

    # D30 retention
    d30_retained = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM nutrition_logs WHERE logged_at >= $1",
        day_30_cutoff,
    )

    # Active today (nutrition or workout)
    active_today_nutrition = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM nutrition_logs WHERE logged_at >= $1",
        day_1_cutoff,
    )
    active_today_workout = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM workout_logs WHERE logged_at >= $1",
        day_1_cutoff,
    )
    active_today = max(active_today_nutrition, active_today_workout)

    # Active this week
    active_week = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM nutrition_logs WHERE logged_at >= $1",
        day_7_cutoff,
    )

    # Streak stats
    avg_streak_val = await conn.fetchval(
        "SELECT COALESCE(AVG(current_streak), 0) FROM user_streaks"
    )

    top_level_val = await conn.fetchval(
        "SELECT COALESCE(MAX(level), 0) FROM user_streaks"
    )

    # Total logs
    total_workouts = await conn.fetchval("SELECT COUNT(id) FROM workout_logs")
    total_meals = await conn.fetchval("SELECT COUNT(id) FROM nutrition_logs")

    # Avg XP
    avg_xp = await conn.fetchval(
        "SELECT COALESCE(AVG(total_xp), 0) FROM user_streaks"
    )

    return RetentionMetrics(
        total_users=total_users,
        onboarded_users=onboarded,
        day_1_retention=round(d1_retained / total_users * 100, 1),
        day_7_retention=round(d7_retained / total_users * 100, 1),
        day_30_retention=round(d30_retained / total_users * 100, 1),
        active_today=active_today,
        active_this_week=active_week,
        avg_streak=round(float(avg_streak_val), 1),
        top_level=int(top_level_val),
        total_workouts_logged=total_workouts,
        total_meals_logged=total_meals,
        avg_xp_per_user=round(float(avg_xp), 0),
    )
