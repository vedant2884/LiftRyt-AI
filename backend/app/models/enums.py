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
