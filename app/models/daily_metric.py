"""
DailyMetric model — aggregated daily health metrics (steps, sleep, etc.).
"""

import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DailyMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "daily_metrics"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    date: Mapped[date] = mapped_column(Date, nullable=False)
    steps: Mapped[int] = mapped_column(Integer, default=0)
    sleep_hours: Mapped[float] = mapped_column(Float, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_ml: Mapped[float | None] = mapped_column(Float, nullable=True)
    resting_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Relationship ──────────────────────────────────────
    user = relationship("User", back_populates="daily_metrics")

    def __repr__(self) -> str:
        return f"<DailyMetric {self.date} user={self.user_id}>"
