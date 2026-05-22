"""
Dashboard route — aggregated daily stats for the mobile home screen.
"""

import logging
from datetime import date, datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.base import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ── Response Schema ───────────────────────────────────────


class GamificationSnapshot(BaseModel):
    total_xp: int = 0
    level: int = 1
    current_streak: int = 0
    longest_streak: int = 0
    xp_to_next_level: int = 100


class DashboardResponse(BaseModel):
    # User
    full_name: str
    fitness_goal: str | None = None

    # Fitness score (0-100)
    fitness_score: int = 0

    # Nutrition — today's actual intake
    calories_consumed: int = 0
    calories_target: int = 0
    protein_g: int = 0
    protein_target_g: int = 0
    carbs_g: int = 0
    carbs_target_g: int = 0
    fat_g: int = 0
    fat_target_g: int = 0

    # Activity
    steps: int = 0
    sleep_hours: float = 0.0
    workouts_this_week: int = 0

    # Gamification
    gamification: GamificationSnapshot = GamificationSnapshot()


# ── Helpers ───────────────────────────────────────────────


def _xp_for_next_level(level: int) -> int:
    """XP threshold for a given level (mirroring gamification service)."""
    return level * 100


def _calculate_fitness_score(
    adherence: float,
    streak: int,
    workouts_this_week: int,
    sleep_hours: float,
) -> int:
    """
    Weighted fitness score (0-100):
      - Nutrition adherence: 40%
      - Streak consistency: 20%
      - Workout frequency:  20%
      - Sleep quality:      20%
    """
    # Adherence score (0-1 → 0-100)
    adherence_score = min(adherence, 1.0) * 100

    # Streak score (cap at 30 days = 100)
    streak_score = min(streak / 30, 1.0) * 100

    # Workout score (target: 5/week = 100)
    workout_score = min(workouts_this_week / 5, 1.0) * 100

    # Sleep score (7-9 hours ideal → 100, <5 or >11 → 0)
    if 7 <= sleep_hours <= 9:
        sleep_score = 100
    elif 6 <= sleep_hours < 7 or 9 < sleep_hours <= 10:
        sleep_score = 75
    elif 5 <= sleep_hours < 6 or 10 < sleep_hours <= 11:
        sleep_score = 50
    else:
        sleep_score = 25 if sleep_hours > 0 else 0

    total = (
        adherence_score * 0.40
        + streak_score * 0.20
        + workout_score * 0.20
        + sleep_score * 0.20
    )
    return max(0, min(100, round(total)))


# ── Endpoint ──────────────────────────────────────────────


@router.get(
    "",
    response_model=DashboardResponse,
    summary="Aggregated dashboard data for the home screen",
)
async def get_dashboard(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    week_start = today_start - timedelta(days=today.weekday())  # Monday

    tdee = current_user["tdee"] or 2000.0
    goal = current_user["fitness_goal"]

    # ── Macro targets from TDEE ──────────────────────────
    protein_target = round((tdee * 0.30) / 4)   # 30% of cals, 4 cal/g
    carbs_target = round((tdee * 0.40) / 4)     # 40% of cals, 4 cal/g
    fat_target = round((tdee * 0.30) / 9)       # 30% of cals, 9 cal/g
    cal_target = round(tdee)

    # ── Today's nutrition totals ─────────────────────────
    nutrition_row = await conn.fetchrow(
        """
        SELECT
            COALESCE(SUM(calories), 0) as cal,
            COALESCE(SUM(protein_g), 0) as protein,
            COALESCE(SUM(carbs_g), 0) as carbs,
            COALESCE(SUM(fat_g), 0) as fat,
            COUNT(id) as meal_count
        FROM nutrition_logs
        WHERE user_id = $1 AND logged_at >= $2
        """,
        current_user["id"],
        today_start,
    )
    cal_consumed = round(nutrition_row["cal"])
    protein_g = round(nutrition_row["protein"])
    carbs_g = round(nutrition_row["carbs"])
    fat_g = round(nutrition_row["fat"])
    meals_today = nutrition_row["meal_count"]

    # ── Workouts this week ───────────────────────────────
    workouts_this_week = await conn.fetchval(
        """
        SELECT COUNT(DISTINCT DATE(logged_at))
        FROM workout_logs
        WHERE user_id = $1 AND logged_at >= $2
        """,
        current_user["id"],
        week_start,
    )

    # ── Daily metric (steps, sleep) ──────────────────────
    dm_row = await conn.fetchrow(
        """
        SELECT steps, sleep_hours
        FROM daily_metrics
        WHERE user_id = $1 AND date = $2
        """,
        current_user["id"],
        today,
    )
    steps = dm_row["steps"] if dm_row else 0
    sleep_hours = dm_row["sleep_hours"] if dm_row else 0.0

    # ── Gamification ─────────────────────────────────────
    streak_row = await conn.fetchrow(
        "SELECT * FROM user_streaks WHERE user_id = $1",
        current_user["id"],
    )

    gam = GamificationSnapshot()
    current_streak = 0
    if streak_row:
        current_streak = streak_row["current_streak"]
        gam = GamificationSnapshot(
            total_xp=streak_row["total_xp"],
            level=streak_row["level"],
            current_streak=streak_row["current_streak"],
            longest_streak=streak_row["longest_streak"],
            xp_to_next_level=max(
                0, _xp_for_next_level(streak_row["level"]) - streak_row["total_xp"]
            ),
        )

    # ── Nutrition adherence (meals_today / 3 expected) ───
    adherence = min(meals_today / 3, 1.0) if meals_today else 0.0

    fitness_score = _calculate_fitness_score(
        adherence=adherence,
        streak=current_streak,
        workouts_this_week=workouts_this_week,
        sleep_hours=sleep_hours,
    )

    return DashboardResponse(
        full_name=current_user["full_name"],
        fitness_goal=goal,
        fitness_score=fitness_score,
        calories_consumed=cal_consumed,
        calories_target=cal_target,
        protein_g=protein_g,
        protein_target_g=protein_target,
        carbs_g=carbs_g,
        carbs_target_g=carbs_target,
        fat_g=fat_g,
        fat_target_g=fat_target,
        steps=steps,
        sleep_hours=round(sleep_hours, 1),
        workouts_this_week=workouts_this_week,
        gamification=gam,
    )
