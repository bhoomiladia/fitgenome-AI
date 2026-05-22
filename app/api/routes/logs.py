"""
Logging routes — manual workout and nutrition logging.
"""

import logging
from datetime import date, datetime
from typing import List

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.db.base import get_db
from app.schemas.logs import (
    WorkoutLogCreate, WorkoutLogResponse,
    NutritionLogCreate, NutritionLogResponse,
    WeightLogCreate, WeightLogResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/logs", tags=["Logging"])


# ── Workout Logging ───────────────────────────────────────

@router.post(
    "/workout",
    response_model=WorkoutLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually log a workout entry"
)
async def log_workout(
    body: WorkoutLogCreate,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(
        """
        INSERT INTO workout_logs (user_id, exercise_name, sets, reps, weight_kg, duration_minutes, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        """,
        current_user["id"],
        body.exercise_name,
        body.sets,
        body.reps,
        body.weight_kg,
        body.duration_minutes,
        body.notes,
    )
    return dict(row)


@router.get(
    "/workout",
    response_model=List[WorkoutLogResponse],
    summary="Get user workout logs"
)
async def get_workout_logs(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    rows = await conn.fetch(
        """
        SELECT * FROM workout_logs
        WHERE user_id = $1
        ORDER BY logged_at DESC
        """,
        current_user["id"],
    )
    return [dict(r) for r in rows]


# ── Nutrition Logging ─────────────────────────────────────

@router.post(
    "/nutrition",
    response_model=NutritionLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually log a nutrition entry"
)
async def log_nutrition(
    body: NutritionLogCreate,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(
        """
        INSERT INTO nutrition_logs (user_id, food_item, calories, protein_g, carbs_g, fat_g, meal_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        """,
        current_user["id"],
        body.food_item,
        body.calories,
        body.protein_g,
        body.carbs_g,
        body.fat_g,
        body.meal_type.value,
    )
    return dict(row)


@router.get(
    "/nutrition",
    response_model=List[NutritionLogResponse],
    summary="Get user nutrition logs"
)
async def get_nutrition_logs(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    rows = await conn.fetch(
        """
        SELECT * FROM nutrition_logs
        WHERE user_id = $1
        ORDER BY logged_at DESC
        """,
        current_user["id"],
    )
    return [dict(r) for r in rows]


# ── Weight Logging ────────────────────────────────────────

@router.post(
    "/weight",
    response_model=WeightLogResponse,
    status_code=status.HTTP_200_OK,
    summary="Log daily weight"
)
async def log_weight(
    body: WeightLogCreate,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    # Update current user weight
    await conn.execute(
        "UPDATE users SET weight_kg = $1, updated_at = NOW() WHERE id = $2",
        body.weight_kg,
        current_user["id"],
    )

    # Update or create DailyMetric for today
    today = date.today()
    existing = await conn.fetchrow(
        "SELECT id FROM daily_metrics WHERE user_id = $1 AND date = $2",
        current_user["id"],
        today,
    )

    if existing:
        await conn.execute(
            "UPDATE daily_metrics SET weight_kg = $1, updated_at = NOW() WHERE id = $2",
            body.weight_kg,
            existing["id"],
        )
    else:
        await conn.execute(
            """
            INSERT INTO daily_metrics (user_id, date, weight_kg, sleep_hours)
            VALUES ($1, $2, $3, 0)
            """,
            current_user["id"],
            today,
            body.weight_kg,
        )

    return {"weight_kg": body.weight_kg, "logged_at": datetime.now()}


@router.get(
    "/weight",
    response_model=List[WeightLogResponse],
    summary="Get weight history"
)
async def get_weight_history(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    rows = await conn.fetch(
        """
        SELECT weight_kg, date
        FROM daily_metrics
        WHERE user_id = $1 AND weight_kg IS NOT NULL
        ORDER BY date DESC
        """,
        current_user["id"],
    )
    return [
        {
            "weight_kg": m["weight_kg"],
            "logged_at": datetime.combine(m["date"], datetime.min.time())
        }
        for m in rows
    ]
