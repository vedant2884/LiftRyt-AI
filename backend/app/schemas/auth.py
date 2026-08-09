from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ActivityLevel, DietaryPreference, ExperienceLevel, Sex
from app.schemas.user import USERNAME_PATTERN, UserProfile


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)
    username: str = Field(pattern=USERNAME_PATTERN)
    age: int = Field(ge=13, le=120)
    sex: Sex
    height_cm: float = Field(gt=0, le=300)
    # Required: the coach and dashboard are pitched as grounded in "your
    # goal," which doesn't hold if this is left empty by default.
    goal_weight_kg: float = Field(gt=0, le=500)
    # Optional: if provided, seeds the very first weight_logs row so the
    # dashboard has something to chart immediately after signup.
    starting_weight_kg: float | None = Field(default=None, gt=0, le=500)
    activity_level: ActivityLevel = ActivityLevel.MODERATE
    training_experience: ExperienceLevel = ExperienceLevel.BEGINNER
    dietary_preference: DietaryPreference = DietaryPreference.NONE


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(TokenResponse):
    user: UserProfile


class GoogleAuthRequest(BaseModel):
    id_token: str


class GoogleAuthResponse(BaseModel):
    """Either a normal sign-in (needs_profile=False, tokens+user set) or a
    brand-new Google identity that still needs age/sex/height before an
    account can be created (needs_profile=True, google_token set instead)."""

    needs_profile: bool
    google_token: str | None = None
    email: EmailStr | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"
    user: UserProfile | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    detail: str
    # Dev-only stand-in for actually emailing the link (no email provider is
    # configured yet, see app/services/email.py). Always None in production.
    dev_reset_link: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=72)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class GoogleCompleteProfileRequest(BaseModel):
    google_token: str
    username: str = Field(pattern=USERNAME_PATTERN)
    age: int = Field(ge=13, le=120)
    sex: Sex
    height_cm: float = Field(gt=0, le=300)
    goal_weight_kg: float = Field(gt=0, le=500)
    starting_weight_kg: float | None = Field(default=None, gt=0, le=500)
    activity_level: ActivityLevel = ActivityLevel.MODERATE
    training_experience: ExperienceLevel = ExperienceLevel.BEGINNER
    dietary_preference: DietaryPreference = DietaryPreference.NONE
