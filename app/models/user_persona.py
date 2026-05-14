"""
UserPersona model — adaptive training parameters tracked by the
Behavioral Pivot Engine.

Updated automatically every 7 days based on adherence and weight trends.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserPersona(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_personas"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    # ── Adaptive Training Parameters ──────────────────────
    workout_volume_modifier: Mapped[float] = mapped_column(
        Float, default=1.0, nullable=False,
        comment="1.0 = normal, 0.6 = deload, 1.2 = overreach",
    )

    target_calories: Mapped[float] = mapped_column(
        Float, nullable=True,
        comment="Overridden calorie target (replaces TDEE-based calculation)",
    )

    deload_until: Mapped[date | None] = mapped_column(
        Date, nullable=True,
        comment="Deload mode active until this date",
    )

    # ── Pivot Tracking ────────────────────────────────────
    last_pivot_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="When the engine last analyzed this user",
    )

    pivot_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="What the engine changed and why",
    )

    # ── Relationship ──────────────────────────────────────
    user = relationship("User", backref="persona", uselist=False)

    def __repr__(self) -> str:
        return (
            f"<UserPersona user={self.user_id} "
            f"vol={self.workout_volume_modifier} "
            f"cal={self.target_calories}>"
        )
