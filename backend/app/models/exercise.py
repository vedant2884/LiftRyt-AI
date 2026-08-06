from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin
from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType


class Exercise(Base, UUIDPkMixin, CreatedAtMixin):
    __tablename__ = "exercises"
    __table_args__ = (
        # GIN indexes make "which exercises hit this muscle" (ANY / && queries)
        # fast without a separate exercise_muscles join table.
        Index("ix_exercises_primary_muscles", "primary_muscles", postgresql_using="gin"),
        Index("ix_exercises_secondary_muscles", "secondary_muscles", postgresql_using="gin"),
    )

    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    primary_muscles: Mapped[list[str]] = mapped_column(ARRAY(String(50)), nullable=False)
    secondary_muscles: Mapped[list[str]] = mapped_column(ARRAY(String(50)), nullable=False, default=list)

    equipment: Mapped[str] = mapped_column(String(50), nullable=False)
    movement_type: Mapped[MovementType] = mapped_column(
        SQLEnum(MovementType, name="movement_type_enum"), nullable=False
    )
    category: Mapped[ExerciseCategory] = mapped_column(
        SQLEnum(ExerciseCategory, name="exercise_category_enum"), nullable=False
    )
    # Reuses the ExperienceLevel enum values but gets its own Postgres enum
    # type name — sharing a type name across two tables would make Alembic
    # try to CREATE TYPE it twice (once per column) and fail on the second.
    difficulty: Mapped[ExperienceLevel] = mapped_column(
        SQLEnum(ExperienceLevel, name="exercise_difficulty_enum"), nullable=False
    )
