"""
AI generation routes — workout plans and meal plans.
"""

import json
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.db.base import get_db
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


def _ensure_onboarded(user: asyncpg.Record) -> None:
    """Raise 400 if the user hasn't completed onboarding."""
    if not user["is_onboarded"]:
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
        "Combines the user's biometrics, recent training history, "
        "and AI expertise to produce a progressive-overload-based "
        "workout plan. Requires the user to be onboarded."
    ),
)
async def generate_workout(
    body: GenerateWorkoutRequest,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    _ensure_onboarded(current_user)

    # Build user context from DB
    user_context = await build_user_context(current_user, conn)

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

    # PERSIST: Save to DB
    await conn.execute(
        """
        INSERT INTO generated_plans (user_id, plan_type, plan_data, preferences)
        VALUES ($1, $2, $3::jsonb, $4)
        """,
        current_user["id"],
        "workout",
        json.dumps(plan.model_dump()),
        body.preferences or None,
    )

    return plan


@router.get("/latest-workout", response_model=WorkoutPlanResponse)
async def get_latest_workout(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Fetch the most recently generated workout plan for the user."""
    row = await conn.fetchrow(
        """
        SELECT plan_data FROM generated_plans
        WHERE user_id = $1 AND plan_type = 'workout'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        current_user["id"],
    )

    if not row:
        raise HTTPException(status_code=404, detail="No workout plan found. Generate one first!")

    plan_data = row["plan_data"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    return plan_data


@router.post(
    "/generate-meal-plan",
    response_model=MealPlanResponse,
    summary="Generate a personalized Indian-focused meal plan",
    description=(
        "Combines the user's biometrics, TDEE, current diet analysis, "
        "and AI expertise to produce a macro-balanced meal plan "
        "with Indian cuisine focus. Requires the user to be onboarded."
    ),
)
async def generate_meal_plan(
    body: GenerateMealPlanRequest,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    _ensure_onboarded(current_user)

    # Build user context from DB
    user_context = await build_user_context(current_user, conn)

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

    # PERSIST: Save to DB
    await conn.execute(
        """
        INSERT INTO generated_plans (user_id, plan_type, plan_data, preferences)
        VALUES ($1, $2, $3::jsonb, $4)
        """,
        current_user["id"],
        "meal",
        json.dumps(plan.model_dump()),
        body.cuisine_preference or None,
    )

    return plan


@router.get("/latest-meal-plan", response_model=MealPlanResponse)
async def get_latest_meal_plan(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Fetch the most recently generated meal plan for the user."""
    row = await conn.fetchrow(
        """
        SELECT plan_data FROM generated_plans
        WHERE user_id = $1 AND plan_type = 'meal'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        current_user["id"],
    )

    if not row:
        raise HTTPException(status_code=404, detail="No meal plan found. Generate one first!")

    plan_data = row["plan_data"]
    if isinstance(plan_data, str):
        plan_data = json.loads(plan_data)
    return plan_data


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
    current_user: asyncpg.Record = Depends(get_current_user),
):
    _ensure_onboarded(current_user)

    # Store feedback for future adaptive programming
    logger.info(
        f"Workout feedback from user {current_user['id']}: "
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
