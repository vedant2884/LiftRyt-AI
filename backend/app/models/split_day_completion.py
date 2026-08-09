import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin


class SplitDayCompletion(Base, UUIDPkMixin, CreatedAtMixin):
    """One tap of "mark complete" for one planned day of a split. No set,
    rep, or weight data — just a binary done/not-done record, append-only.

    Weekly adherence ("3/4 planned workouts this week") is derived by
    counting distinct day_index values with a completion since the start of
    the current week for the user's active split, not by counting rows
    directly — tapping the same day twice in one week still only covers
    that one planned day.
    """

    __tablename__ = "split_day_completions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    split_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generated_splits.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_index: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
