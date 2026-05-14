import uuid
from sqlalchemy import Column, ForeignKey, String, Text, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, TimestampMixin, UUIDPrimaryKeyMixin

class ChatMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "chat_messages"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    role: Mapped[str] = mapped_column(String(10), nullable=False) # "user" or "coach"
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship
    user = relationship("User", back_populates="chat_messages")

    def __repr__(self) -> str:
        return f"<ChatMessage {self.role} for user {self.user_id}>"
