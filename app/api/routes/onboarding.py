"""
User Onboarding route — accepts biometric data and calculates BMR / TDEE.
"""

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.db.base import get_db
from app.schemas.user import UserOnboardingRequest, UserOnboardingResponse
from app.services.biometrics import calculate_bmr, calculate_tdee

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.post(
    "",
    response_model=UserOnboardingResponse,
    summary="Submit biometric data and receive BMR/TDEE baseline",
)
async def onboard_user(
    body: UserOnboardingRequest,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    Accept the authenticated user's biometric profile, compute their
    Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE),
    persist everything, and return the enriched profile.

    Can be called again to update biometric data (re-onboarding).
    """
    # Calculate BMR & TDEE
    bmr = calculate_bmr(
        weight_kg=body.weight_kg,
        height_cm=body.height_cm,
        age=body.age,
        gender=body.gender,
    )
    tdee = calculate_tdee(bmr=bmr, activity_level=body.activity_level)

    # Update user record
    row = await conn.fetchrow(
        """
        UPDATE users SET
            age = $1,
            gender = $2,
            height_cm = $3,
            weight_kg = $4,
            activity_level = $5,
            fitness_goal = $6,
            goal_weight_kg = $7,
            blood_group = $8,
            bmr = $9,
            tdee = $10,
            is_onboarded = TRUE,
            updated_at = NOW()
        WHERE id = $11
        RETURNING *
        """,
        body.age,
        body.gender.value,
        body.height_cm,
        body.weight_kg,
        body.activity_level.value,
        body.fitness_goal.value,
        body.goal_weight_kg,
        body.blood_group.value if body.blood_group else None,
        bmr,
        tdee,
        current_user["id"],
    )

    return dict(row)
