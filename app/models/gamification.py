"""
Gamification models — XP ledger and streak tracking.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin


class XPLedger(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual XP transaction record."""

    __tablename__ = "xp_ledger"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    xp_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="e.g. workout_complete, streak_bonus, meal_logged, scan_food",
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", backref="xp_entries")

    def __repr__(self) -> str:
        return f"<XP +{self.xp_amount} source={self.source}>"


class UserStreak(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks per-user consistency streaks."""

    __tablename__ = "user_streaks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)

    user = relationship("User", backref="streak", uselist=False)

    def __repr__(self) -> str:
        return f"<Streak user={self.user_id} current={self.current_streak} lvl={self.level}>"
