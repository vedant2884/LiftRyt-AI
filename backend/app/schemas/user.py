import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ActivityLevel, DietaryPreference, ExperienceLevel, LengthUnit, Sex, WeightUnit

ThemeMode = Literal["light", "dark"]
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
    created_at: datetime


class UserProfileUpdate(BaseModel):
    """All fields optional: only the ones the client actually sends get
    applied (see exclude_unset in the PATCH /auth/me handler)."""

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    username: str | None = Field(default=None, pattern=USERNAME_PATTERN)
    avatar_url: str | None = Field(default=None, max_length=1024)
    age: int | None = Field(default=None, ge=13, le=120)
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
