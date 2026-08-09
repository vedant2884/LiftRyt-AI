import uuid
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin


class WorkoutSet(Base, UUIDPkMixin, CreatedAtMixin):
    """A logged set against either an official `Exercise` or one of the
    user's own `CustomExercise` rows, never both — same
    exactly-one-source pattern as `FavoriteExercise`, added so custom
    exercises (already fully supported everywhere else) can actually be
    logged in a workout."""

    __tablename__ = "workout_sets"
    __table_args__ = (
        CheckConstraint(
            "(exercise_id IS NOT NULL) != (custom_exercise_id IS NOT NULL)",
            name="ck_workout_set_exactly_one_source",
        ),
    )

    workout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # No ondelete cascade to exercises/custom_exercises: a retired exercise
    # (or a deleted custom exercise) shouldn't silently delete a user's
    # historical set data.
    exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id"), index=True
    )
    custom_exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("custom_exercises.id"), index=True
    )

    # Scoped to (workout_id, exercise_id/custom_exercise_id) — restarts at 1
    # for every exercise in the workout, not a single counter across the
    # whole workout (see add_set in the router for how this is computed).
    set_number: Mapped[int] = mapped_column(nullable=False)
    reps: Mapped[int] = mapped_column(nullable=False)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    rpe: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    is_warmup: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
