import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin


class FavoriteExercise(Base, UUIDPkMixin, CreatedAtMixin):
    """A user's favorited exercise — either an official `Exercise` or one of
    their own `CustomExercise` rows, never both (see the check constraint).
    `position` drives manual reordering in the Favorites UI; the split
    generator also reads favorites to prefer them when picking exercises
    for a category (see split_generator.py), so this table is the single
    source of truth for both the UI list and the AI's preference signal.
    """

    __tablename__ = "favorite_exercises"
    __table_args__ = (
        CheckConstraint(
            "(exercise_id IS NOT NULL) != (custom_exercise_id IS NOT NULL)",
            name="ck_favorite_exercise_exactly_one_source",
        ),
        # Postgres treats NULLs as distinct in a unique constraint, so each
        # of these only actually constrains the rows where that column is
        # non-null — exactly the rows it's meant to dedupe.
        UniqueConstraint("user_id", "exercise_id", name="uq_favorite_user_exercise"),
        UniqueConstraint("user_id", "custom_exercise_id", name="uq_favorite_user_custom_exercise"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="CASCADE")
    )
    custom_exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("custom_exercises.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
