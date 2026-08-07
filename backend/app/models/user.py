from decimal import Decimal

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UpdatedAtMixin, UUIDPkMixin
from app.models.enums import ActivityLevel, DietaryPreference, ExperienceLevel, LengthUnit, Sex, WeightUnit


class User(Base, UUIDPkMixin, CreatedAtMixin, UpdatedAtMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile fields (step B). No current_weight column here on purpose —
    # current weight is derived from the latest weight_logs row so there is
    # exactly one source of truth for it instead of two that can drift.
    age: Mapped[int] = mapped_column(nullable=False)
    sex: Mapped[Sex] = mapped_column(SQLEnum(Sex, name="sex_enum"), nullable=False)
    height_cm: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    goal_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    activity_level: Mapped[ActivityLevel] = mapped_column(
        SQLEnum(ActivityLevel, name="activity_level_enum"),
        nullable=False,
        default=ActivityLevel.MODERATE,
    )
    training_experience: Mapped[ExperienceLevel] = mapped_column(
        SQLEnum(ExperienceLevel, name="training_experience_enum"),
        nullable=False,
        default=ExperienceLevel.BEGINNER,
    )
    dietary_preference: Mapped[DietaryPreference] = mapped_column(
        SQLEnum(DietaryPreference, name="dietary_preference_enum"),
        nullable=False,
        default=DietaryPreference.NONE,
    )

    # Settings (step B).
    unit_weight: Mapped[WeightUnit] = mapped_column(
        SQLEnum(WeightUnit, name="weight_unit_enum"), nullable=False, default=WeightUnit.KG
    )
    unit_length: Mapped[LengthUnit] = mapped_column(
        SQLEnum(LengthUnit, name="length_unit_enum"), nullable=False, default=LengthUnit.CM
    )
    theme: Mapped[str] = mapped_column(String(30), nullable=False, default="dark")
    # Separate from theme (light/dark mode) — accent is an orthogonal color
    # choice that applies in either mode, added in step 11 alongside the
    # actual theme system that uses it.
    accent_color: Mapped[str] = mapped_column(String(30), nullable=False, default="violet")
