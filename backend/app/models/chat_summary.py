import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin
from app.models.exercise import EMBEDDING_DIM


class ChatSummary(Base, UUIDPkMixin, CreatedAtMixin):
    """Periodic summaries of a user's conversation with the AI coach,
    embedded for retrieval by meaning.

    Schema lands here in step 9 alongside the rest of the RAG
    infrastructure, but rows aren't written until step 10's agent loop
    exists to actually produce a summary from an LLM — summarization isn't
    something a rule can do, unlike the exercise embeddings this same
    step populates immediately from real seeded data.
    """

    __tablename__ = "chat_summaries"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)
