"""
Pure-function helpers for BMR and TDEE calculations.

Uses the **Mifflin-St Jeor** equation — widely considered the most
accurate for estimating resting metabolic rate in healthy adults.
"""

from app.models.user import ActivityLevel, Gender

# Multipliers sourced from the American College of Sports Medicine
ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    ActivityLevel.sedentary: 1.2,
    ActivityLevel.light: 1.375,
    ActivityLevel.moderate: 1.55,
    ActivityLevel.active: 1.725,
    ActivityLevel.very_active: 1.9,
}


def calculate_bmr(
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: Gender,
) -> float:
    """
    Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.

    Male  : BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
    Female: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
    Other : average of male and female formulas
    """
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age

    if gender == Gender.male:
        return round(base + 5, 2)
    elif gender == Gender.female:
        return round(base - 161, 2)
    else:
        # Non-binary / other — use midpoint of male & female
        return round(base + (5 + (-161)) / 2, 2)


def calculate_tdee(bmr: float, activity_level: ActivityLevel) -> float:
    """
    Calculate Total Daily Energy Expenditure.

    TDEE = BMR × activity multiplier
    """
    multiplier = ACTIVITY_MULTIPLIERS[activity_level]
    return round(bmr * multiplier, 2)
