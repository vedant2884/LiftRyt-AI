import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin
from app.models.enums import ChatRole
from app.models.exercise import EMBEDDING_DIM


class ChatMessage(Base, UUIDPkMixin, CreatedAtMixin):
    __tablename__ = "chat_messages"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The conversation thread this message belongs to. History sent to the
    # LLM is scoped to this, not to every message the user has ever sent, so
    # a fresh "New chat" doesn't drag old, unrelated tool calls into context.
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[ChatRole] = mapped_column(SQLEnum(ChatRole, name="chat_role_enum"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Populated in step 10 when the agent loop calls the split generator or
    # macro calculator, so the transcript shows what was actually invoked
    # rather than just the LLM's prose about it.
    tool_name: Mapped[str | None] = mapped_column(String(50))
    tool_payload: Mapped[dict | None] = mapped_column(JSONB)

    # Embedded on write (see app/services/agent.py) so the coach can later
    # pull a handful of relevant older messages by meaning, across sessions,
    # instead of only ever seeing the current session's recent turns.
    # Nullable: messages that existed before this feature was added, and
    # only the assistant's final text has meaningful content to embed, not
    # every persisted field.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
