import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UpdatedAtMixin, UUIDPkMixin


class ExerciseProgression(Base, UUIDPkMixin, CreatedAtMixin, UpdatedAtMixin):
    """A user's progressive-overload state for one official exercise —
    scoped to real Exercise rows only, not custom exercises, because PR
    detection itself (workout_analytics.is_new_pr) is already official-
    exercise-only, so progression can never actually trigger for a custom
    exercise. Created lazily on first use (a confirmed "increase next
    weight?", a custom increment, or a disable), one row per (user,
    exercise).

    next_suggested_weight_kg is set only when the user explicitly confirms
    a PR-triggered increase (see POST /exercises/progressions/confirm) —
    never written automatically. It's a one-shot "next time you log this"
    value: consumed (cleared) once it's been prefilled into a new workout,
    not a persistent target that could go stale after weeks.
    """

    __tablename__ = "exercise_progressions"
    __table_args__ = (UniqueConstraint("user_id", "exercise_id", name="uq_exercise_progression_user_exercise"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Null = use the user's default_progression_increment_kg.
    increment_kg: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    next_suggested_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    # Lets a user opt an exercise out of PR-increase prompts entirely
    # (machine with fixed increments, intentionally training at a plateau,
    # ...) without having to dismiss "Not now" every single time.
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
