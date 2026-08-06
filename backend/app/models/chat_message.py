import uuid

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin
from app.models.enums import ChatRole


class ChatMessage(Base, UUIDPkMixin, CreatedAtMixin):
    __tablename__ = "chat_messages"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[ChatRole] = mapped_column(SQLEnum(ChatRole, name="chat_role_enum"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Populated in step 10 when the agent loop calls the split generator or
    # macro calculator, so the transcript shows what was actually invoked
    # rather than just the LLM's prose about it.
    tool_name: Mapped[str | None] = mapped_column(String(50))
    tool_payload: Mapped[dict | None] = mapped_column(JSONB)
