"""
Progress routes — Digital Twin 30-day trajectory prediction.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.services.digital_twin import predict_trajectory, generate_digital_twin_summary

from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress", tags=["Progress"])


class DigitalTwinResponse(BaseModel):
    trajectory: list[dict]
    summary: dict
    input_params: dict


@router.get(
    "/digital-twin",
    response_model=DigitalTwinResponse,
    summary="30-day weight/body composition prediction",
)
async def get_digital_twin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_onboarded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete onboarding first.",
        )

    weight = current_user.weight_kg or 70.0
    tdee = current_user.tdee or 2000.0
    goal = current_user.fitness_goal.value if current_user.fitness_goal else "maintain"

    # Calculate average daily calories from last 7 days
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(
        select(func.sum(NutritionLog.calories)).where(
            NutritionLog.user_id == current_user.id,
            NutritionLog.logged_at >= seven_days_ago,
        )
    )
    total_cal_7d = result.scalar_one() or 0
    avg_daily_cal = total_cal_7d / 7 if total_cal_7d > 0 else tdee * 0.85

    # Calculate adherence (logs / expected)
    log_count_result = await db.execute(
        select(func.count(NutritionLog.id)).where(
            NutritionLog.user_id == current_user.id,
            NutritionLog.logged_at >= seven_days_ago,
        )
    )
    log_count = log_count_result.scalar_one()
    adherence = min(log_count / 21, 1.0)  # 3 meals × 7 days

    trajectory = predict_trajectory(
        current_weight_kg=weight,
        tdee=tdee,
        avg_daily_calories=avg_daily_cal,
        adherence_rate=adherence,
        fitness_goal=goal,
        days=30,
    )

    summary = generate_digital_twin_summary(trajectory, goal, current_user.goal_weight_kg)

    return DigitalTwinResponse(
        trajectory=trajectory,
        summary=summary,
        input_params={
            "current_weight_kg": weight,
            "tdee": tdee,
            "avg_daily_calories": round(avg_daily_cal),
            "adherence_rate": round(adherence, 2),
            "fitness_goal": goal,
        },
    )
