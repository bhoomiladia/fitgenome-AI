"""
User-related Pydantic schemas for request validation and response serialization.
"""

import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.user import ActivityLevel, FitnessGoal, Gender, BloodGroup


# ── Auth ──────────────────────────────────────────────────


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=120)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ── Onboarding ────────────────────────────────────────────


class UserOnboardingRequest(BaseModel):
    age: int = Field(..., gt=0, le=150)
    gender: Gender
    height_cm: float = Field(..., gt=0, le=300)
    weight_kg: float = Field(..., gt=0, le=500)
    activity_level: ActivityLevel
    fitness_goal: FitnessGoal
    goal_weight_kg: Optional[float] = Field(None, gt=0, le=500)
    blood_group: Optional[BloodGroup] = None


class UserOnboardingResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    age: int
    gender: Gender
    height_cm: float
    weight_kg: float
    goal_weight_kg: Optional[float] = None
    activity_level: ActivityLevel
    fitness_goal: FitnessGoal
    blood_group: Optional[BloodGroup] = None
    bmr: float
    tdee: float
    is_onboarded: bool

    model_config = {"from_attributes": True}


# ── General Response ──────────────────────────────────────


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    activity_level: Optional[ActivityLevel] = None
    fitness_goal: Optional[FitnessGoal] = None
    blood_group: Optional[BloodGroup] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    age: Optional[int] = None
    gender: Optional[Gender] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    activity_level: Optional[ActivityLevel] = None
    fitness_goal: Optional[FitnessGoal] = None
    blood_group: Optional[BloodGroup] = None
    bmr: Optional[float] = None
    tdee: Optional[float] = None
    is_onboarded: bool = False

    model_config = {"from_attributes": True}
