from datetime import datetime
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin

class GeneratedPlanType(str):
    WORKOUT = "workout"
    MEAL = "meal"

class GeneratedPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "generated_plans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    plan_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True) # "workout" or "meal"
    plan_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    
    # Optional: store the preferences used to generate this plan
    preferences: Mapped[str] = mapped_column(String(500), nullable=True)

    # Relationship
    user = relationship("User", back_populates="generated_plans")

    def __repr__(self) -> str:
        return f"<GeneratedPlan {self.plan_type} for user {self.user_id}>"
