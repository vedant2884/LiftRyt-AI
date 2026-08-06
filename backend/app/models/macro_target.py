import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum as SQLEnum, ForeignKey, Index, Numeric, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin
from app.models.enums import MacroGoal


class MacroTarget(Base, UUIDPkMixin, CreatedAtMixin):
    __tablename__ = "macro_targets"
    __table_args__ = (
        # Partial unique index: enforces "at most one active target per
        # user" at the database level while still letting history accumulate
        # as goals change over time (is_active=false rows are unrestricted).
        Index(
            "uq_macro_targets_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    bmr: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    tdee: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    goal: Mapped[MacroGoal] = mapped_column(SQLEnum(MacroGoal, name="macro_goal_enum"), nullable=False)
    target_calories: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    target_protein_g: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    target_carbs_g: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    target_fat_g: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
