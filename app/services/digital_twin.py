"""
Digital Twin — 30-day predictive weight/muscle trajectory.

Uses a linear regression model based on current adherence rate,
TDEE, calorie intake, and body composition to project future
weight and body composition changes.
"""

import logging
import math
from datetime import date, timedelta

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────
CALORIES_PER_KG_FAT = 7700
MUSCLE_GAIN_EFFICIENCY = 0.3  # 30% of surplus can go to muscle with training
FAT_LOSS_EFFICIENCY = 0.85    # 85% of deficit comes from fat


def predict_trajectory(
    current_weight_kg: float,
    tdee: float,
    avg_daily_calories: float,
    adherence_rate: float,
    fitness_goal: str,
    days: int = 30,
) -> list[dict]:
    """
    Generate a day-by-day weight trajectory prediction.

    Parameters
    ----------
    current_weight_kg : float
    tdee : float
        Total Daily Energy Expenditure.
    avg_daily_calories : float
        Average calories consumed per day (from recent logs).
    adherence_rate : float
        0.0 to 1.0 — how consistently the user follows their plan.
    fitness_goal : str
        One of: lose_weight, build_muscle, maintain, improve_endurance.
    days : int
        Prediction horizon (default 30).

    Returns
    -------
    list[dict]
        Each dict: {day, date, predicted_weight_kg, fat_mass_delta_kg,
                     muscle_mass_delta_kg, confidence}
    """
    daily_balance = avg_daily_calories - tdee  # positive = surplus, negative = deficit
    adjusted_balance = daily_balance * max(adherence_rate, 0.3)

    trajectory = []
    cumulative_weight_delta = 0.0
    cumulative_fat_delta = 0.0
    cumulative_muscle_delta = 0.0

    for day_num in range(1, days + 1):
        # Apply noise reduction as days increase (less confidence)
        confidence = max(0.95 - (day_num * 0.015), 0.40)

        # Daily weight change from calorie balance
        if adjusted_balance < 0:
            # Deficit: mostly fat loss
            daily_fat_loss = (abs(adjusted_balance) * FAT_LOSS_EFFICIENCY) / CALORIES_PER_KG_FAT
            daily_muscle_loss = (abs(adjusted_balance) * (1 - FAT_LOSS_EFFICIENCY)) / CALORIES_PER_KG_FAT
            daily_weight_change = -(daily_fat_loss + daily_muscle_loss)
            cumulative_fat_delta -= daily_fat_loss
            cumulative_muscle_delta -= daily_muscle_loss
        elif adjusted_balance > 0:
            # Surplus: split between fat and muscle
            if fitness_goal == "build_muscle":
                daily_muscle_gain = (adjusted_balance * MUSCLE_GAIN_EFFICIENCY) / CALORIES_PER_KG_FAT
                daily_fat_gain = (adjusted_balance * (1 - MUSCLE_GAIN_EFFICIENCY)) / CALORIES_PER_KG_FAT
            else:
                daily_muscle_gain = (adjusted_balance * 0.1) / CALORIES_PER_KG_FAT
                daily_fat_gain = (adjusted_balance * 0.9) / CALORIES_PER_KG_FAT
            daily_weight_change = daily_muscle_gain + daily_fat_gain
            cumulative_fat_delta += daily_fat_gain
            cumulative_muscle_delta += daily_muscle_gain
        else:
            daily_weight_change = 0.0

        cumulative_weight_delta += daily_weight_change

        target_date = date.today() + timedelta(days=day_num)

        trajectory.append({
            "day": day_num,
            "date": target_date.isoformat(),
            "predicted_weight_kg": round(current_weight_kg + cumulative_weight_delta, 2),
            "weight_delta_kg": round(cumulative_weight_delta, 3),
            "fat_mass_delta_kg": round(cumulative_fat_delta, 3),
            "muscle_mass_delta_kg": round(cumulative_muscle_delta, 3),
            "confidence": round(confidence, 2),
        })

    return trajectory


def generate_digital_twin_summary(trajectory: list[dict], fitness_goal: str, goal_weight_kg: float | None = None) -> dict:
    """
    Summarize the 30-day trajectory into actionable insights.
    """
    if not trajectory:
        return {"summary": "Insufficient data for prediction."}

    final = trajectory[-1]
    mid = trajectory[14] if len(trajectory) > 14 else trajectory[-1]

    total_delta = final["weight_delta_kg"]
    weekly_rate = total_delta / (len(trajectory) / 7)
    predicted_end_weight = final["predicted_weight_kg"]

    # Determine if on track
    if goal_weight_kg:
        # If goal is weight loss
        if fitness_goal == "lose_weight":
            on_track = predicted_end_weight <= goal_weight_kg + 0.5
        elif fitness_goal == "build_muscle":
            on_track = predicted_end_weight >= goal_weight_kg - 0.5
        else:
            on_track = abs(predicted_end_weight - goal_weight_kg) < 1.0
    else:
        if fitness_goal == "lose_weight":
            on_track = total_delta < -0.5
        elif fitness_goal == "build_muscle":
            on_track = total_delta > 0.3
        else:
            on_track = abs(total_delta) < 1.0

    pace = "good"
    if fitness_goal == "lose_weight":
        pace = "good" if -1.0 <= weekly_rate <= -0.3 else ("too fast" if weekly_rate < -1.0 else "slow")
    elif fitness_goal == "build_muscle":
        pace = "good" if 0.1 <= weekly_rate <= 0.5 else ("too fast" if weekly_rate > 0.5 else "slow")

    recommendation = "Keep up the great work! Your adherence is solid."
    if not on_track:
        if fitness_goal == "lose_weight":
            recommendation = "Consider increasing your daily activity or slightly reducing your calorie intake to hit your target."
        elif fitness_goal == "build_muscle":
            recommendation = "You might need a slightly larger calorie surplus and consistent protein intake to meet your muscle goals."

    return {
        "predicted_weight_30d": predicted_end_weight,
        "total_weight_change_kg": round(total_delta, 2),
        "weekly_rate_kg": round(weekly_rate, 2),
        "fat_change_kg": final["fat_mass_delta_kg"],
        "muscle_change_kg": final["muscle_mass_delta_kg"],
        "on_track": on_track,
        "pace": pace,
        "recommendation": recommendation,
        "confidence_end": final["confidence"],
    }
