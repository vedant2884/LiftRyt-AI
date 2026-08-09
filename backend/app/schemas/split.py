import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType, TrainingGoal


class SplitGenerateRequest(BaseModel):
    days_per_week: int = Field(ge=1, le=6)
    experience_level: ExperienceLevel
    goal: TrainingGoal


class SplitExerciseOut(BaseModel):
    exercise_id: uuid.UUID
    name: str
    category: ExerciseCategory
    movement_type: MovementType
    is_custom: bool = False
    primary_muscles: list[str] = []
    sets: int
    reps: str
    reason: str


class SplitDayOut(BaseModel):
    day_number: int
    label: str
    exercises: list[SplitExerciseOut]


class SplitPlanOut(BaseModel):
    id: uuid.UUID
    split_type: str
    days_per_week: int
    experience_level: ExperienceLevel
    goal: TrainingGoal
    days: list[SplitDayOut]
    # Which day_number values have a completion logged since the start of
    # the current week, so the frontend can render checkboxes from this one
    # payload without a second round trip.
    completed_day_numbers: list[int] = []
    # Which day_number is "today's" in the rotation — see
    # split_service.get_next_day_number for how this is derived. A
    # convenience default for the Workout start screen, never enforced.
    next_day_number: int = 1


class SplitSummaryOut(BaseModel):
    """Lean shape for browsing a user's saved splits (GET /splits) — no
    plan/exercise payload, just enough to pick one to activate."""

    id: uuid.UUID
    split_type: str
    days_per_week: int
    experience_level: ExperienceLevel
    goal: TrainingGoal
    is_active: bool
    created_at: datetime


class DayCompletionOut(BaseModel):
    day_index: int
    completed: bool
