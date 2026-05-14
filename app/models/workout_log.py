"""
WorkoutLog model — tracks individual exercise entries.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkoutLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workout_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    exercise_name: Mapped[str] = mapped_column(String(200), nullable=False)
    sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationship ──────────────────────────────────────
    user = relationship("User", back_populates="workout_logs")

    def __repr__(self) -> str:
        return f"<WorkoutLog {self.exercise_name} user={self.user_id}>"
