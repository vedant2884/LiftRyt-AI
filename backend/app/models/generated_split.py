import uuid

from sqlalchemy import Boolean, Enum as SQLEnum, ForeignKey, Index, Integer, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin
from app.models.enums import ExperienceLevel, TrainingGoal


class GeneratedSplit(Base, UUIDPkMixin, CreatedAtMixin):
    """A persisted workout split — either generated from the Splits page or
    by the AI coach's generate_workout_split tool, both go through the same
    app.services.split_service so "the active split" means the same thing
    either way. Only one split is active per user at a time (same
    deactivate-then-insert pattern as MacroTarget), and completions
    (split_day_completions) reference whichever split was active when the
    user checked a day off.

    The plan itself (days, exercises, sets/reps, reasons) is stored as JSONB
    rather than normalized into child tables — it's already a clean nested
    structure returned by split_generator.generate_split(), and this app
    already stores comparable structured tool output the same way
    (chat_messages.tool_payload).
    """

    __tablename__ = "generated_splits"
    __table_args__ = (
        Index(
            "uq_generated_splits_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    split_type: Mapped[str] = mapped_column(nullable=False)
    days_per_week: Mapped[int] = mapped_column(Integer, nullable=False)
    # Own Postgres enum type name (not "training_experience_enum" /
    # "exercise_difficulty_enum") — sharing a type name across tables makes
    # Alembic try to CREATE TYPE it twice and fail on the second (see
    # models/exercise.py's difficulty column for the same note).
    experience_level: Mapped[ExperienceLevel] = mapped_column(
        SQLEnum(ExperienceLevel, name="split_experience_level_enum"), nullable=False
    )
    goal: Mapped[TrainingGoal] = mapped_column(SQLEnum(TrainingGoal, name="training_goal_enum"), nullable=False)
    plan: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
