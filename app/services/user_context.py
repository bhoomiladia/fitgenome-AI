"""
Build a rich user-context dictionary from the database.

This context is injected into the LLM prompt so the AI can personalize
workout and meal plans based on the user's biometrics, training history,
dietary patterns, and daily metrics.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_metric import DailyMetric
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.models.workout_log import WorkoutLog


async def build_user_context(user: User, db: AsyncSession) -> dict:
    """
    Load the authenticated user's profile, recent workout history,
    recent nutrition logs, and daily metrics into a serializable dict.

    Parameters
    ----------
    user : User
        The authenticated SQLAlchemy User ORM instance.
    db : AsyncSession
        Active database session.

    Returns
    -------
    dict
        A dictionary ready to be interpolated into LLM prompt templates.
    """
    now = datetime.now(timezone.utc)

    # ── Profile ───────────────────────────────────────────
    profile = {
        "user_id": str(user.id),
        "full_name": user.full_name,
        "age": user.age,
        "gender": user.gender.value if user.gender else None,
        "height_cm": user.height_cm,
        "weight_kg": user.weight_kg,
        "goal_weight_kg": user.goal_weight_kg,
        "activity_level": user.activity_level.value if user.activity_level else None,
        "fitness_goal": user.fitness_goal.value if user.fitness_goal else None,
        "bmr": user.bmr,
        "tdee": user.tdee,
    }

    # ── Recent Workouts (last 14 days) ────────────────────
    workout_cutoff = now - timedelta(days=14)
    workout_result = await db.execute(
        select(WorkoutLog)
        .where(
            WorkoutLog.user_id == user.id,
            WorkoutLog.logged_at >= workout_cutoff,
        )
        .order_by(WorkoutLog.logged_at.desc())
        .limit(50)
    )
    recent_workouts = [
        {
            "exercise": w.exercise_name,
            "sets": w.sets,
            "reps": w.reps,
            "weight_kg": w.weight_kg,
            "duration_minutes": w.duration_minutes,
            "date": w.logged_at.strftime("%Y-%m-%d"),
        }
        for w in workout_result.scalars().all()
    ]

    # ── Recent Nutrition (last 7 days) ────────────────────
    nutrition_cutoff = now - timedelta(days=7)
    nutrition_result = await db.execute(
        select(NutritionLog)
        .where(
            NutritionLog.user_id == user.id,
            NutritionLog.logged_at >= nutrition_cutoff,
        )
        .order_by(NutritionLog.logged_at.desc())
        .limit(50)
    )
    nutrition_logs = nutrition_result.scalars().all()

    if nutrition_logs:
        # Calculate daily averages
        days_with_data = len(
            set(n.logged_at.strftime("%Y-%m-%d") for n in nutrition_logs)
        )
        days_with_data = max(days_with_data, 1)
        avg_nutrition = {
            "avg_daily_calories": round(
                sum(n.calories for n in nutrition_logs) / days_with_data, 1
            ),
            "avg_daily_protein_g": round(
                sum(n.protein_g for n in nutrition_logs) / days_with_data, 1
            ),
            "avg_daily_carbs_g": round(
                sum(n.carbs_g for n in nutrition_logs) / days_with_data, 1
            ),
            "avg_daily_fat_g": round(
                sum(n.fat_g for n in nutrition_logs) / days_with_data, 1
            ),
        }
    else:
        avg_nutrition = {
            "avg_daily_calories": None,
            "avg_daily_protein_g": None,
            "avg_daily_carbs_g": None,
            "avg_daily_fat_g": None,
        }

    # ── Daily Metrics (last 7 days) ───────────────────────
    metrics_cutoff = (now - timedelta(days=7)).date()
    metrics_result = await db.execute(
        select(DailyMetric)
        .where(
            DailyMetric.user_id == user.id,
            DailyMetric.date >= metrics_cutoff,
        )
        .order_by(DailyMetric.date.desc())
        .limit(7)
    )
    metrics_rows = metrics_result.scalars().all()

    if metrics_rows:
        daily_metrics = {
            "avg_steps": round(
                sum(m.steps for m in metrics_rows) / len(metrics_rows)
            ),
            "avg_sleep_hours": round(
                sum(m.sleep_hours for m in metrics_rows) / len(metrics_rows), 1
            ),
        }
    else:
        daily_metrics = {"avg_steps": None, "avg_sleep_hours": None}

    return {
        "profile": profile,
        "recent_workouts": recent_workouts,
        "avg_nutrition": avg_nutrition,
        "daily_metrics": daily_metrics,
    }
