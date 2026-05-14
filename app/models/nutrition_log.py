"""
NutritionLog model — tracks food intake and macronutrient breakdown.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class NutritionLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "nutrition_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    food_item: Mapped[str] = mapped_column(String(300), nullable=False)
    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    meal_type: Mapped[MealType] = mapped_column(
        Enum(MealType, name="meal_type_enum"), nullable=False
    )

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationship ──────────────────────────────────────
    user = relationship("User", back_populates="nutrition_logs")

    def __repr__(self) -> str:
        return f"<NutritionLog {self.food_item} ({self.calories} kcal)>"
