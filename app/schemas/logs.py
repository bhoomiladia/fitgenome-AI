"""
Schemas for manual workout and nutrition logging.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.nutrition_log import MealType


# ── Workout Logs ──────────────────────────────────────────

class WorkoutLogCreate(BaseModel):
    exercise_name: str = Field(..., min_length=1, max_length=200)
    sets: int = Field(..., gt=0)
    reps: int = Field(..., gt=0)
    weight_kg: Optional[float] = Field(None, ge=0)
    duration_minutes: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None

class WorkoutLogResponse(BaseModel):
    id: uuid.UUID
    exercise_name: str
    sets: int
    reps: int
    weight_kg: Optional[float]
    duration_minutes: Optional[float]
    notes: Optional[str]
    logged_at: datetime

    model_config = {"from_attributes": True}


# ── Nutrition Logs ────────────────────────────────────────

class NutritionLogCreate(BaseModel):
    food_item: str = Field(..., min_length=1, max_length=300)
    calories: float = Field(..., ge=0)
    protein_g: float = Field(..., ge=0)
    carbs_g: float = Field(..., ge=0)
    fat_g: float = Field(..., ge=0)
    meal_type: MealType

class NutritionLogResponse(BaseModel):
    id: uuid.UUID
    food_item: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    meal_type: MealType
    logged_at: datetime

    model_config = {"from_attributes": True}
    

# ── Weight Logs ───────────────────────────────────────────

class WeightLogCreate(BaseModel):
    weight_kg: float = Field(..., gt=0, le=500)

class WeightLogResponse(BaseModel):
    weight_kg: float
    logged_at: datetime

    model_config = {"from_attributes": True}
