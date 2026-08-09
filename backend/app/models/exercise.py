from pgvector.sqlalchemy import Vector
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin
from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType, PreviewMediaType

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2's output dimension


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

    # Deferred from step 2's initial schema until there was an actual RAG
    # pipeline to populate and query it — nullable because it's backfilled
    # after insert (see app/db/embed_exercises.py), not set at creation time.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    # --- Visual library: media -------------------------------------------
    # All nullable — no real photography/video pipeline exists yet. The
    # frontend's ExerciseMedia component renders a designed placeholder
    # (gradient + icon, derived from category/muscle) whenever these are
    # null, so an empty column never means a broken image.
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preview_media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preview_media_type: Mapped[PreviewMediaType | None] = mapped_column(
        SQLEnum(PreviewMediaType, name="exercise_preview_media_type_enum"), nullable=True
    )

    # --- Visual library: detail modal content -----------------------------
    # All nullable — the detail modal hides each section when its field is
    # empty rather than requiring every exercise to be fully authored.
    instructions: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    common_mistakes: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    breathing_tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    range_of_motion: Mapped[str | None] = mapped_column(Text, nullable=True)
    tempo: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_sets: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_reps: Mapped[str | None] = mapped_column(Text, nullable=True)
    beginner_tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    advanced_tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    safety_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
