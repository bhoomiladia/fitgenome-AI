"""
User model — stores account credentials, biometrics, and fitness goals.
"""

import enum

from sqlalchemy import Boolean, Enum, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class ActivityLevel(str, enum.Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"


class FitnessGoal(str, enum.Enum):
    lose_weight = "lose_weight"
    maintain = "maintain"
    build_muscle = "build_muscle"
    improve_endurance = "improve_endurance"


class BloodGroup(str, enum.Enum):
    A_pos = "A+"
    A_neg = "A-"
    B_pos = "B+"
    B_neg = "B-"
    AB_pos = "AB+"
    AB_neg = "AB-"
    O_pos = "O+"
    O_neg = "O-"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # ── Account ───────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)

    # ── Biometrics ────────────────────────────────────────
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[Gender | None] = mapped_column(
        Enum(Gender, name="gender_enum"), nullable=True
    )
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    goal_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    blood_group: Mapped[BloodGroup | None] = mapped_column(
        Enum(BloodGroup, name="blood_group_enum"), nullable=True
    )

    # ── Goals & Activity ──────────────────────────────────
    activity_level: Mapped[ActivityLevel | None] = mapped_column(
        Enum(ActivityLevel, name="activity_level_enum"), nullable=True
    )
    fitness_goal: Mapped[FitnessGoal | None] = mapped_column(
        Enum(FitnessGoal, name="fitness_goal_enum"), nullable=True
    )

    # ── Calculated fields ─────────────────────────────────
    bmr: Mapped[float | None] = mapped_column(Float, nullable=True)
    tdee: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_onboarded: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Relationships ─────────────────────────────────────
    workout_logs = relationship("WorkoutLog", back_populates="user", lazy="selectin")
    nutrition_logs = relationship("NutritionLog", back_populates="user", lazy="selectin")
    daily_metrics = relationship("DailyMetric", back_populates="user", lazy="selectin")
    generated_plans = relationship("GeneratedPlan", back_populates="user", lazy="selectin")
    chat_messages = relationship("ChatMessage", back_populates="user", lazy="selectin", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User {self.email}>"
