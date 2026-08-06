import uuid
from enum import Enum

from pydantic import BaseModel, Field

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType


class TrainingGoal(str, Enum):
    """Distinct from MacroGoal (cut/maintain/bulk) — that's a nutrition goal
    and doesn't meaningfully change workout structure (you can build muscle
    in a surplus or a deficit). This is what actually drives sets/reps and
    exercise selection: strength favors low reps and compound movements,
    hypertrophy favors moderate reps and more isolation volume."""

    STRENGTH = "strength"
    HYPERTROPHY = "hypertrophy"
    GENERAL_FITNESS = "general_fitness"


class SplitGenerateRequest(BaseModel):
    days_per_week: int = Field(ge=1, le=6)
    experience_level: ExperienceLevel
    goal: TrainingGoal


class SplitExerciseOut(BaseModel):
    exercise_id: uuid.UUID
    name: str
    category: ExerciseCategory
    movement_type: MovementType
    sets: int
    reps: str
    reason: str


class SplitDayOut(BaseModel):
    day_number: int
    label: str
    exercises: list[SplitExerciseOut]


class SplitPlanOut(BaseModel):
    split_type: str
    days_per_week: int
    experience_level: ExperienceLevel
    goal: TrainingGoal
    days: list[SplitDayOut]
