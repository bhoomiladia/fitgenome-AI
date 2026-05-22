"""
Progress routes — Digital Twin 30-day trajectory prediction.
"""

import logging
from datetime import datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.base import get_db
from app.services.digital_twin import predict_trajectory, generate_digital_twin_summary

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
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    if not current_user["is_onboarded"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete onboarding first.",
        )

    weight = current_user["weight_kg"] or 70.0
    tdee = current_user["tdee"] or 2000.0
    goal = current_user["fitness_goal"] if current_user["fitness_goal"] else "maintain"

    # Calculate average daily calories from last 7 days
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    result = await conn.fetchrow(
        """
        SELECT COALESCE(SUM(calories), 0) as total_cal,
               COUNT(id) as log_count
        FROM nutrition_logs
        WHERE user_id = $1 AND logged_at >= $2
        """,
        current_user["id"],
        seven_days_ago,
    )
    total_cal_7d = result["total_cal"]
    log_count = result["log_count"]

    avg_daily_cal = total_cal_7d / 7 if total_cal_7d > 0 else tdee * 0.85
    adherence = min(log_count / 21, 1.0)  # 3 meals × 7 days

    trajectory = predict_trajectory(
        current_weight_kg=weight,
        tdee=tdee,
        avg_daily_calories=avg_daily_cal,
        adherence_rate=adherence,
        fitness_goal=goal,
        days=30,
    )

    summary = generate_digital_twin_summary(trajectory, goal, current_user["goal_weight_kg"])

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
