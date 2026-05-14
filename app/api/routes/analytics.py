"""
Admin Analytics Dashboard — Retention metrics (D1/D7/D30).
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.models.nutrition_log import NutritionLog
from app.models.gamification import UserStreak

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Simple admin check (in prod, use role-based auth)
    # For now, any authenticated user can access

    now = datetime.now(timezone.utc)
    day_1_cutoff = now - timedelta(days=1)
    day_7_cutoff = now - timedelta(days=7)
    day_30_cutoff = now - timedelta(days=30)

    # Total users
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    onboarded = (await db.execute(
        select(func.count(User.id)).where(User.is_onboarded == True)  # noqa
    )).scalar_one()

    if total_users == 0:
        return RetentionMetrics(
            total_users=0, onboarded_users=0,
            day_1_retention=0, day_7_retention=0, day_30_retention=0,
            active_today=0, active_this_week=0,
            avg_streak=0, top_level=0,
            total_workouts_logged=0, total_meals_logged=0, avg_xp_per_user=0,
        )

    # D1 retention: users who logged anything within 24h of signup
    d1_retained = (await db.execute(
        select(func.count(func.distinct(NutritionLog.user_id))).where(
            NutritionLog.logged_at >= day_1_cutoff,
        )
    )).scalar_one()

    # D7 retention: active in last 7 days
    d7_retained = (await db.execute(
        select(func.count(func.distinct(NutritionLog.user_id))).where(
            NutritionLog.logged_at >= day_7_cutoff,
        )
    )).scalar_one()

    # D30 retention: active in last 30 days
    d30_retained = (await db.execute(
        select(func.count(func.distinct(NutritionLog.user_id))).where(
            NutritionLog.logged_at >= day_30_cutoff,
        )
    )).scalar_one()

    # Active today (workout or nutrition log)
    active_today_nutrition = (await db.execute(
        select(func.count(func.distinct(NutritionLog.user_id))).where(
            NutritionLog.logged_at >= day_1_cutoff,
        )
    )).scalar_one()
    active_today_workout = (await db.execute(
        select(func.count(func.distinct(WorkoutLog.user_id))).where(
            WorkoutLog.logged_at >= day_1_cutoff,
        )
    )).scalar_one()
    active_today = max(active_today_nutrition, active_today_workout)

    # Active this week
    active_week = (await db.execute(
        select(func.count(func.distinct(NutritionLog.user_id))).where(
            NutritionLog.logged_at >= day_7_cutoff,
        )
    )).scalar_one()

    # Streak stats
    avg_streak_val = (await db.execute(
        select(func.avg(UserStreak.current_streak))
    )).scalar_one() or 0

    top_level_val = (await db.execute(
        select(func.max(UserStreak.level))
    )).scalar_one() or 0

    # Total logs
    total_workouts = (await db.execute(
        select(func.count(WorkoutLog.id))
    )).scalar_one()
    total_meals = (await db.execute(
        select(func.count(NutritionLog.id))
    )).scalar_one()

    # Avg XP
    avg_xp = (await db.execute(
        select(func.avg(UserStreak.total_xp))
    )).scalar_one() or 0

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
