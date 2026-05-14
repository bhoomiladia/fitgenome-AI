"""
Logging routes — manual workout and nutrition logging.
"""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.models.nutrition_log import NutritionLog
from app.models.daily_metric import DailyMetric
from datetime import date, datetime
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log_entry = WorkoutLog(
        user_id=current_user.id,
        exercise_name=body.exercise_name,
        sets=body.sets,
        reps=body.reps,
        weight_kg=body.weight_kg,
        duration_minutes=body.duration_minutes,
        notes=body.notes
    )
    db.add(log_entry)
    await db.flush()
    await db.refresh(log_entry)
    return log_entry


@router.get(
    "/workout",
    response_model=List[WorkoutLogResponse],
    summary="Get user workout logs"
)
async def get_workout_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutLog)
        .where(WorkoutLog.user_id == current_user.id)
        .order_by(WorkoutLog.logged_at.desc())
    )
    return result.scalars().all()


# ── Nutrition Logging ─────────────────────────────────────

@router.post(
    "/nutrition",
    response_model=NutritionLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually log a nutrition entry"
)
async def log_nutrition(
    body: NutritionLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log_entry = NutritionLog(
        user_id=current_user.id,
        food_item=body.food_item,
        calories=body.calories,
        protein_g=body.protein_g,
        carbs_g=body.carbs_g,
        fat_g=body.fat_g,
        meal_type=body.meal_type
    )
    db.add(log_entry)
    await db.flush()
    await db.refresh(log_entry)
    return log_entry


@router.get(
    "/nutrition",
    response_model=List[NutritionLogResponse],
    summary="Get user nutrition logs"
)
async def get_nutrition_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NutritionLog)
        .where(NutritionLog.user_id == current_user.id)
        .order_by(NutritionLog.logged_at.desc())
    )
    return result.scalars().all()


# ── Weight Logging ────────────────────────────────────────

@router.post(
    "/weight",
    response_model=WeightLogResponse,
    status_code=status.HTTP_200_OK,
    summary="Log daily weight"
)
async def log_weight(
    body: WeightLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Update current user weight
    current_user.weight_kg = body.weight_kg
    
    # Update or create DailyMetric for today
    today = date.today()
    result = await db.execute(
        select(DailyMetric).where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.date == today
        )
    )
    metric = result.scalar_one_or_none()
    
    if metric:
        metric.weight_kg = body.weight_kg
    else:
        metric = DailyMetric(
            user_id=current_user.id,
            date=today,
            weight_kg=body.weight_kg,
            sleep_hours=0  # Default or pull from previous? 0 for now.
        )
        db.add(metric)
    
    await db.flush()
    return {"weight_kg": body.weight_kg, "logged_at": datetime.now()}


@router.get(
    "/weight",
    response_model=List[WeightLogResponse],
    summary="Get weight history"
)
async def get_weight_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DailyMetric)
        .where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.weight_kg.is_not(None)
        )
        .order_by(DailyMetric.date.desc())
    )
    metrics = result.scalars().all()
    return [
        {
            "weight_kg": m.weight_kg,
            "logged_at": datetime.combine(m.date, datetime.min.time())
        }
        for m in metrics
    ]
