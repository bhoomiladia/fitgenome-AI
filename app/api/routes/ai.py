"""
AI generation routes — workout plans and meal plans.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.ai_plans import GeneratedPlan
from app.models.user import User
from app.schemas.ai_responses import MealPlanResponse, WorkoutPlanResponse
from app.services.ai_orchestrator import AIOrchestrator
from app.services.user_context import build_user_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Generation"])


# ── Request Schemas ───────────────────────────────────────


class GenerateWorkoutRequest(BaseModel):
    preferences: str = Field(
        "",
        max_length=500,
        description="Optional free-text preferences, e.g. 'I prefer dumbbells over barbells'",
    )


class GenerateMealPlanRequest(BaseModel):
    dietary_restrictions: list[str] = Field(
        default_factory=list,
        description="E.g. ['vegetarian', 'no dairy', 'gluten-free']",
    )
    cuisine_preference: str = Field(
        "Indian",
        max_length=100,
        description="Primary cuisine style (defaults to Indian)",
    )


# ── Helpers ───────────────────────────────────────────────


def _ensure_onboarded(user: User) -> None:
    """Raise 400 if the user hasn't completed onboarding."""
    if not user.is_onboarded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "You must complete onboarding before generating plans. "
                "POST /api/v1/onboarding with your biometric data first."
            ),
        )


# ── Endpoints ─────────────────────────────────────────────


@router.post(
    "/generate-workout",
    response_model=WorkoutPlanResponse,
    summary="Generate a personalized weekly workout plan",
    description=(
        "Uses RAG to combine the user's biometrics, recent training history, "
        "and retrieved fitness research to produce a progressive-overload-based "
        "workout plan. Requires the user to be onboarded."
    ),
)
async def generate_workout(
    body: GenerateWorkoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_onboarded(current_user)

    # Build user context from DB
    user_context = await build_user_context(current_user, db)

    # Generate via AI orchestrator
    orchestrator = AIOrchestrator()

    try:
        plan = await orchestrator.generate_workout(
            user_context=user_context,
            preferences=body.preferences,
        )
    except Exception as e:
        logger.error(f"Workout generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI generation failed. Please try again later.",
        )

    # PERSIST: Save to DB (outside try/except so DB errors aren't masked)
    db_plan = GeneratedPlan(
        user_id=current_user.id,
        plan_type="workout",
        plan_data=plan.model_dump(),
        preferences=body.preferences,
    )
    db.add(db_plan)
    await db.flush()  # flush to DB; get_db auto-commits on success

    return plan


@router.get("/latest-workout", response_model=WorkoutPlanResponse)
async def get_latest_workout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch the most recently generated workout plan for the user."""
    stmt = (
        select(GeneratedPlan)
        .where(GeneratedPlan.user_id == current_user.id, GeneratedPlan.plan_type == "workout")
        .order_by(GeneratedPlan.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    db_plan = result.scalar_one_or_none()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="No workout plan found. Generate one first!")
        
    return db_plan.plan_data


@router.post(
    "/generate-meal-plan",
    response_model=MealPlanResponse,
    summary="Generate a personalized Indian-focused meal plan",
    description=(
        "Uses RAG to combine the user's biometrics, TDEE, current diet analysis, "
        "and retrieved nutrition research to produce a macro-balanced meal plan "
        "with Indian cuisine focus. Requires the user to be onboarded."
    ),
)
async def generate_meal_plan(
    body: GenerateMealPlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_onboarded(current_user)

    # Build user context from DB
    user_context = await build_user_context(current_user, db)

    # Generate via AI orchestrator
    orchestrator = AIOrchestrator()

    try:
        plan = await orchestrator.generate_meal_plan(
            user_context=user_context,
            dietary_restrictions=body.dietary_restrictions or None,
            cuisine_preference=body.cuisine_preference,
        )
    except Exception as e:
        logger.error(f"Meal plan generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI generation failed. Please try again later.",
        )

    # PERSIST: Save to DB (outside try/except so DB errors aren't masked)
    db_plan = GeneratedPlan(
        user_id=current_user.id,
        plan_type="meal",
        plan_data=plan.model_dump(),
        preferences=body.cuisine_preference,
    )
    db.add(db_plan)
    await db.flush()  # flush to DB; get_db auto-commits on success

    return plan


@router.get("/latest-meal-plan", response_model=MealPlanResponse)
async def get_latest_meal_plan(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch the most recently generated meal plan for the user."""
    stmt = (
        select(GeneratedPlan)
        .where(GeneratedPlan.user_id == current_user.id, GeneratedPlan.plan_type == "meal")
        .order_by(GeneratedPlan.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    db_plan = result.scalar_one_or_none()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="No meal plan found. Generate one first!")
        
    return db_plan.plan_data


# ── Workout Feedback ──────────────────────────────────────


class WorkoutFeedbackRequest(BaseModel):
    difficulty_rating: int = Field(
        ..., ge=1, le=10, description="Perceived difficulty from 1 (easy) to 10 (maximal)"
    )
    notes: str = Field("", max_length=500, description="Optional feedback notes")


class WorkoutFeedbackResponse(BaseModel):
    status: str = "recorded"
    difficulty_rating: int
    message: str


@router.post(
    "/workout-feedback",
    response_model=WorkoutFeedbackResponse,
    summary="Submit workout difficulty feedback",
    description=(
        "Records the user's perceived difficulty rating (1-10) for adaptive "
        "programming in future workout generation."
    ),
)
async def submit_workout_feedback(
    body: WorkoutFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_onboarded(current_user)

    # Store feedback for future adaptive programming
    # For now, log it — will be used by the AI orchestrator in future iterations
    logger.info(
        f"Workout feedback from user {current_user.id}: "
        f"difficulty={body.difficulty_rating}, notes='{body.notes}'"
    )

    # Determine adaptive message based on rating
    if body.difficulty_rating <= 3:
        message = "Noted! We'll increase intensity in your next workout."
    elif body.difficulty_rating <= 6:
        message = "Great balance! Your current progression is on track."
    elif body.difficulty_rating <= 8:
        message = "Solid effort! We'll maintain this challenge level."
    else:
        message = "That was tough! We'll add extra recovery in your next plan."

    return WorkoutFeedbackResponse(
        difficulty_rating=body.difficulty_rating,
        message=message,
    )
