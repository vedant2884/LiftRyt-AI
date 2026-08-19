"""Domain enums shared between SQLAlchemy models and Pydantic schemas.

Each becomes a native Postgres ENUM type (not a plain varchar + check
constraint) so invalid values are rejected at the database layer too, not
just by the API.
"""

from enum import Enum


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"
    VERY_ACTIVE = "very_active"


class ExperienceLevel(str, Enum):
    """Used for both a user's training experience and an exercise's difficulty."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class DietaryPreference(str, Enum):
    NONE = "none"
    VEGETARIAN = "vegetarian"
    NON_VEGETARIAN = "non_vegetarian"
    EGGETARIAN = "eggetarian"
    # Kept for backward compatibility with existing rows — no longer offered
    # in the signup UI (see SignupPage.tsx / GoogleCompleteProfilePage.tsx),
    # which now shows the simpler Vegetarian/Non-Vegetarian/Eggetarian set.
    VEGAN = "vegan"
    PESCATARIAN = "pescatarian"
    KETO = "keto"
    OTHER = "other"


class WeightUnit(str, Enum):
    KG = "kg"
    LB = "lb"


class LengthUnit(str, Enum):
    CM = "cm"
    IN = "in"


class MovementType(str, Enum):
    COMPOUND = "compound"
    ISOLATION = "isolation"


class ExerciseCategory(str, Enum):
    PUSH = "push"
    PULL = "pull"
    LEGS = "legs"
    UPPER = "upper"
    LOWER = "lower"
    FULL_BODY = "full_body"
    CORE = "core"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class MacroGoal(str, Enum):
    CUT = "cut"
    MAINTAIN = "maintain"
    BULK = "bulk"


class PreviewMediaType(str, Enum):
    """How to render an exercise's hover/hero preview — determines whether
    the media component mounts an <img> (gif) or a <video> (mp4/webm)."""

    GIF = "gif"
    MP4 = "mp4"
    WEBM = "webm"


class TrainingGoal(str, Enum):
    """Distinct from MacroGoal (cut/maintain/bulk) — that's a nutrition goal
    and doesn't meaningfully change workout structure (you can build muscle
    in a surplus or a deficit). This is what actually drives sets/reps and
    exercise selection: strength favors low reps and compound movements,
    hypertrophy favors moderate reps and more isolation volume."""

    STRENGTH = "strength"
    HYPERTROPHY = "hypertrophy"
    GENERAL_FITNESS = "general_fitness"
