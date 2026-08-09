import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin, UpdatedAtMixin


class ChatSession(Base, UUIDPkMixin, CreatedAtMixin, UpdatedAtMixin):
    """A single conversation thread with the AI coach.

    Messages belong to a session (not just a user) so a "New chat" starts a
    genuinely fresh context: history sent to the LLM is scoped to session_id,
    not the user's entire lifetime of messages. updated_at is bumped
    explicitly (not via ORM auto-diffing) whenever a message is appended, so
    the sidebar can sort by most-recently-active.
    """

    __tablename__ = "chat_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Null until the first message is in: auto-generated from it (see
    # app/services/agent.py's _generate_title), like ChatGPT/Claude do.
    title: Mapped[str | None] = mapped_column(String(255))
