from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ActivityLevel, DietaryPreference, ExperienceLevel, Sex
from app.schemas.user import UserProfile


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)
    age: int = Field(ge=13, le=120)
    sex: Sex
    height_cm: float = Field(gt=0, le=300)
    goal_weight_kg: float | None = Field(default=None, gt=0, le=500)
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
