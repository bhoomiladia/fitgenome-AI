"""
Build a rich user-context dictionary from the database.

This context is injected into the LLM prompt so the AI can personalize
workout and meal plans based on the user's biometrics, training history,
dietary patterns, and daily metrics.
"""

from datetime import datetime, timedelta, timezone

import asyncpg


async def build_user_context(user_row: asyncpg.Record, conn: asyncpg.Connection) -> dict:
    """
    Load the authenticated user's profile, recent workout history,
    recent nutrition logs, and daily metrics into a serializable dict.

    Parameters
    ----------
    user_row : asyncpg.Record
        The authenticated user's row from the users table.
    conn : asyncpg.Connection
        Active database connection.

    Returns
    -------
    dict
        A dictionary ready to be interpolated into LLM prompt templates.
    """
    now = datetime.now(timezone.utc)
    user_id = user_row["id"]

    # ── Profile ───────────────────────────────────────────
    profile = {
        "user_id": str(user_id),
        "full_name": user_row["full_name"],
        "age": user_row["age"],
        "gender": user_row["gender"],
        "height_cm": user_row["height_cm"],
        "weight_kg": user_row["weight_kg"],
        "goal_weight_kg": user_row["goal_weight_kg"],
        "activity_level": user_row["activity_level"],
        "fitness_goal": user_row["fitness_goal"],
        "bmr": user_row["bmr"],
        "tdee": user_row["tdee"],
    }

    # ── Recent Workouts (last 14 days) ────────────────────
    workout_cutoff = now - timedelta(days=14)
    workout_rows = await conn.fetch(
        """
        SELECT exercise_name, sets, reps, weight_kg, duration_minutes, logged_at
        FROM workout_logs
        WHERE user_id = $1 AND logged_at >= $2
        ORDER BY logged_at DESC
        LIMIT 50
        """,
        user_id,
        workout_cutoff,
    )
    recent_workouts = [
        {
            "exercise": w["exercise_name"],
            "sets": w["sets"],
            "reps": w["reps"],
            "weight_kg": w["weight_kg"],
            "duration_minutes": w["duration_minutes"],
            "date": w["logged_at"].strftime("%Y-%m-%d"),
        }
        for w in workout_rows
    ]

    # ── Recent Nutrition (last 7 days) ────────────────────
    nutrition_cutoff = now - timedelta(days=7)
    nutrition_rows = await conn.fetch(
        """
        SELECT calories, protein_g, carbs_g, fat_g, logged_at
        FROM nutrition_logs
        WHERE user_id = $1 AND logged_at >= $2
        ORDER BY logged_at DESC
        LIMIT 50
        """,
        user_id,
        nutrition_cutoff,
    )

    if nutrition_rows:
        # Calculate daily averages
        days_with_data = len(
            set(n["logged_at"].strftime("%Y-%m-%d") for n in nutrition_rows)
        )
        days_with_data = max(days_with_data, 1)
        avg_nutrition = {
            "avg_daily_calories": round(
                sum(n["calories"] for n in nutrition_rows) / days_with_data, 1
            ),
            "avg_daily_protein_g": round(
                sum(n["protein_g"] for n in nutrition_rows) / days_with_data, 1
            ),
            "avg_daily_carbs_g": round(
                sum(n["carbs_g"] for n in nutrition_rows) / days_with_data, 1
            ),
            "avg_daily_fat_g": round(
                sum(n["fat_g"] for n in nutrition_rows) / days_with_data, 1
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
    metrics_rows = await conn.fetch(
        """
        SELECT steps, sleep_hours
        FROM daily_metrics
        WHERE user_id = $1 AND date >= $2
        ORDER BY date DESC
        LIMIT 7
        """,
        user_id,
        metrics_cutoff,
    )

    if metrics_rows:
        daily_metrics = {
            "avg_steps": round(
                sum(m["steps"] for m in metrics_rows) / len(metrics_rows)
            ),
            "avg_sleep_hours": round(
                sum(m["sleep_hours"] for m in metrics_rows) / len(metrics_rows), 1
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
