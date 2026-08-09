import uuid

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin, UpdatedAtMixin
from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType


class CustomExercise(Base, UUIDPkMixin, CreatedAtMixin, UpdatedAtMixin):
    """A user's own gym-specific exercise (machine names, home equipment,
    etc.) that doesn't exist in the shared exercise library.

    Deliberately a separate table, never merged into `exercises` — that
    table is a shared, curated library; this one is private per-user data.
    The split generator treats rows from both tables as candidates when
    building a plan (see app/services/split_generator.py's ExerciseLike),
    which is "using" a custom exercise, not merging the databases.
    """

    __tablename__ = "custom_exercises"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_custom_exercise_user_name"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    primary_muscles: Mapped[list[str]] = mapped_column(ARRAY(String(50)), nullable=False)
    secondary_muscles: Mapped[list[str]] = mapped_column(ARRAY(String(50)), nullable=False, default=list)
    equipment: Mapped[str] = mapped_column(String(50), nullable=False)

    # Own Postgres enum type names — sharing a name across tables makes
    # Alembic try to CREATE TYPE it twice and fail on the second (same note
    # as models/exercise.py's difficulty column and generated_split.py).
    movement_type: Mapped[MovementType] = mapped_column(
        SQLEnum(MovementType, name="custom_exercise_movement_type_enum"), nullable=False
    )
    category: Mapped[ExerciseCategory] = mapped_column(
        SQLEnum(ExerciseCategory, name="custom_exercise_category_enum"), nullable=False
    )
    difficulty: Mapped[ExperienceLevel] = mapped_column(
        SQLEnum(ExperienceLevel, name="custom_exercise_difficulty_enum"), nullable=False
    )
