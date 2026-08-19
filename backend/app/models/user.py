from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UpdatedAtMixin, UUIDPkMixin
from app.models.enums import ActivityLevel, DietaryPreference, ExperienceLevel, LengthUnit, Sex, WeightUnit
from app.services.age_calculation import calculate_age


class User(Base, UUIDPkMixin, CreatedAtMixin, UpdatedAtMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # Nullable: Google-only accounts (see firebase_uid) never set a password.
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Unique handle, distinct from full_name — the identity communities (once
    # added) reference each other by, so it can't collide across users.
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    # Only ever set by an explicit avatar upload (POST /auth/me/avatar) —
    # takes priority over google_avatar_url when both are present.
    avatar_url: Mapped[str | None] = mapped_column(String(1024))
    # Set only for accounts created/linked via Google Sign-In; null for
    # email/password-only accounts. Unique so a Google identity can't attach
    # to two local accounts.
    firebase_uid: Mapped[str | None] = mapped_column(String(128), unique=True, index=True)
    # Refreshed from the Firebase ID token's `picture` claim on every Google
    # sign-in (see /auth/google) — kept separate from avatar_url so a custom
    # upload always wins and never gets silently clobbered by a stale Google
    # picture on the next login.
    google_avatar_url: Mapped[str | None] = mapped_column(String(1024))

    # Profile fields (step B). No current_weight column here on purpose —
    # current weight is derived from the latest weight_logs row so there is
    # exactly one source of truth for it instead of two that can drift.
    #
    # date_of_birth is the source of truth for new signups; age is derived
    # from it via the property below, never stored independently, so DOB
    # and age can't drift apart the way "add a date_of_birth column but
    # also keep an editable age column" would allow. legacy_age exists only
    # for accounts created before this column existed, whose real
    # birthdate we have no way to recover from just an age integer — kept
    # as a fallback, never written to by new signups (nullable for exactly
    # that reason).
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    legacy_age: Mapped[int | None] = mapped_column(nullable=True)
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
    # Progressive overload: the weight bump suggested after a confirmed PR
    # when no per-exercise override exists (see ExerciseProgression). Purely
    # a default the user configures in Settings — never applied
    # automatically to a PR without their explicit per-PR confirmation.
    default_progression_increment_kg: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("2.5")
    )

    # Null until the post-signup guided flow is finished or skipped. Checked
    # once, right after signup redirects here — not a persistent gate on
    # every future login, so this never blocks a returning user.
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Single on/off switch for the in-app activity notifications (missed-
    # workout nudges, streak reminders, ...) — see app.services.notification_service.
    # Deliberately just one boolean for now rather than a per-type settings
    # matrix (PR/streak/etc split out), per the "don't build a massive
    # notification-settings system in this phase" scope call.
    workout_reminders_enabled: Mapped[bool] = mapped_column(nullable=False, default=True)

    @property
    def has_password(self) -> bool:
        """Whether this account can log in with email/password (false for a
        Google-only account). Exposed to the API as a boolean via
        UserProfile.has_password; the hash itself is never serialized."""
        return self.hashed_password is not None

    @property
    def age(self) -> int | None:
        """Computed, never stored — see date_of_birth's docstring above.
        Only None for a pre-DOB account that also somehow has no
        legacy_age, which shouldn't happen in practice (every account
        predating this column was required to submit an age at signup)."""
        if self.date_of_birth is not None:
            return calculate_age(self.date_of_birth)
        return self.legacy_age

    @property
    def has_completed_onboarding(self) -> bool:
        return self.onboarding_completed_at is not None
