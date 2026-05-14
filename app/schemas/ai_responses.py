"""
Structured output schemas for AI-generated workout and meal plans.

These Pydantic models are used with LangChain's `with_structured_output()`
to force the LLM to return valid JSON matching the exact schema.
"""

from pydantic import BaseModel, Field


# ── Workout Plan ──────────────────────────────────────────


class Exercise(BaseModel):
    """A single exercise within a workout day."""

    name: str = Field(..., description="Exercise name, e.g. 'Barbell Bench Press'")
    sets: int = Field(..., ge=1, description="Number of sets")
    reps: str = Field(
        ..., description="Rep target or range, e.g. '8-12' or '5'"
    )
    weight_kg: float | None = Field(
        None,
        description="Suggested weight in kg (null for bodyweight exercises)",
    )
    rest_seconds: int = Field(
        60, ge=0, description="Rest period between sets in seconds"
    )
    notes: str = Field(
        "",
        description="Progressive overload cue or coaching note",
    )


class WorkoutDay(BaseModel):
    """A single day within the weekly workout schedule."""

    day: str = Field(..., description="Day label, e.g. 'Day 1 — Push'")
    focus: str = Field(
        ..., description="Muscle groups targeted, e.g. 'Chest, Shoulders, Triceps'"
    )
    exercises: list[Exercise] = Field(
        ..., min_length=0, description="Ordered list of exercises (empty for rest days)"
    )
    estimated_duration_min: int = Field(
        ..., ge=0, description="Estimated session duration in minutes (0 for rest days)"
    )


class WorkoutPlanResponse(BaseModel):
    """Complete weekly workout plan returned by the AI."""

    plan_name: str = Field(
        ..., description="Descriptive plan title, e.g. 'Hypertrophy Push/Pull/Legs'"
    )
    goal: str = Field(
        ..., description="Primary training goal aligned to the user's profile"
    )
    weekly_schedule: list[WorkoutDay] = Field(
        ..., min_length=1, description="Day-by-day training schedule"
    )
    progressive_overload_strategy: str = Field(
        ...,
        description="Explanation of how to progress weights/reps week-over-week",
    )
    notes: str = Field(
        "",
        description="General coaching notes, warm-up reminders, deload advice",
    )


# ── Meal Plan ─────────────────────────────────────────────


class FoodItem(BaseModel):
    """A single food item within a meal."""

    name: str = Field(..., description="Food name, e.g. 'Paneer Bhurji'")
    portion: str = Field(..., description="Serving size, e.g. '200g' or '2 rotis'")
    calories: float = Field(..., ge=0, description="Calories in kcal")
    protein_g: float = Field(..., ge=0, description="Protein in grams")
    carbs_g: float = Field(..., ge=0, description="Carbohydrates in grams")
    fat_g: float = Field(..., ge=0, description="Fat in grams")


class Meal(BaseModel):
    """A single meal within a day."""

    meal_type: str = Field(
        ..., description="One of: breakfast, lunch, dinner, snack"
    )
    time_suggestion: str = Field(
        ..., description="Suggested time, e.g. '8:00 AM'"
    )
    items: list[FoodItem] = Field(
        ..., min_length=1, description="Foods included in this meal"
    )


class DayMealPlan(BaseModel):
    """Complete nutrition for one day."""

    day: str = Field(..., description="Day label, e.g. 'Day 1 — Monday'")
    meals: list[Meal] = Field(
        ..., min_length=1, description="All meals for the day"
    )
    total_calories: float = Field(..., ge=0, description="Day total kcal")
    total_protein_g: float = Field(..., ge=0, description="Day total protein (g)")
    total_carbs_g: float = Field(..., ge=0, description="Day total carbs (g)")
    total_fat_g: float = Field(..., ge=0, description="Day total fat (g)")


class MealPlanResponse(BaseModel):
    """Complete multi-day meal plan returned by the AI."""

    plan_name: str = Field(
        ..., description="Descriptive plan title, e.g. 'Indian High-Protein Muscle Gain'"
    )
    daily_calorie_target: float = Field(
        ..., ge=0, description="Target daily calories based on TDEE and goal"
    )
    macro_split: str = Field(
        ...,
        description="Macro ratio string, e.g. '40C/30P/30F'",
    )
    cuisine_focus: str = Field(
        "Indian", description="Primary cuisine style"
    )
    days: list[DayMealPlan] = Field(
        ..., min_length=1, description="Day-by-day meal plans"
    )
    notes: str = Field(
        "",
        description="General dietary advice, hydration tips, supplement suggestions",
    )
