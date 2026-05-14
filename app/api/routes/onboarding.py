"""
User Onboarding route — accepts biometric data and calculates BMR / TDEE.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.user import User
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
    current_user.age = body.age
    current_user.gender = body.gender
    current_user.height_cm = body.height_cm
    current_user.weight_kg = body.weight_kg
    current_user.activity_level = body.activity_level
    current_user.fitness_goal = body.fitness_goal
    current_user.goal_weight_kg = body.goal_weight_kg
    current_user.blood_group = body.blood_group
    current_user.bmr = bmr
    current_user.tdee = tdee
    current_user.is_onboarded = True

    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)

    return current_user
