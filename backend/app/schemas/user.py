import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import ActivityLevel, DietaryPreference, ExperienceLevel, LengthUnit, Sex, WeightUnit
from app.services.age_calculation import validate_date_of_birth

ThemeMode = Literal["light", "dark", "system"]
AccentColor = Literal["violet", "emerald"]

# Shared between signup, profile updates, and Google-signup profile
# completion so the uniqueness/shape rule lives in exactly one place.
USERNAME_PATTERN = r"^[a-zA-Z0-9_]{3,30}$"


class UserProfile(BaseModel):
    """API-facing view of a user. Deliberately excludes hashed_password."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    username: str
    avatar_url: str | None = None
    google_avatar_url: str | None = None
    has_password: bool
    has_completed_onboarding: bool
    # date_of_birth is null only for accounts that predate this field (see
    # User.date_of_birth's docstring) — age is always populated for them
    # via the legacy_age fallback, so it stays a required int here.
    date_of_birth: date | None = None
    age: int
    sex: Sex
    height_cm: float
    goal_weight_kg: float | None = None
    activity_level: ActivityLevel
    training_experience: ExperienceLevel
    dietary_preference: DietaryPreference
    unit_weight: WeightUnit
    unit_length: LengthUnit
    theme: ThemeMode
    accent_color: AccentColor
    default_progression_increment_kg: float
    workout_reminders_enabled: bool
    created_at: datetime


class UserProfileUpdate(BaseModel):
    """All fields optional: only the ones the client actually sends get
    applied (see exclude_unset in the PATCH /auth/me handler)."""

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    username: str | None = Field(default=None, pattern=USERNAME_PATTERN)
    avatar_url: str | None = Field(default=None, max_length=1024)
    # No separate age field — age is always derived from date_of_birth (see
    # User.age), so there's no way for a client to set them inconsistently.
    date_of_birth: date | None = None
    sex: Sex | None = None
    height_cm: float | None = Field(default=None, gt=0, le=300)
    goal_weight_kg: float | None = Field(default=None, gt=0, le=500)
    activity_level: ActivityLevel | None = None
    training_experience: ExperienceLevel | None = None
    dietary_preference: DietaryPreference | None = None
    unit_weight: WeightUnit | None = None
    unit_length: LengthUnit | None = None
    theme: ThemeMode | None = None
    accent_color: AccentColor | None = None
    default_progression_increment_kg: float | None = Field(default=None, gt=0, le=50)
    workout_reminders_enabled: bool | None = None

    @field_validator("date_of_birth")
    @classmethod
    def _validate_date_of_birth(cls, value: date | None) -> date | None:
        if value is not None:
            validate_date_of_birth(value)
        return value
