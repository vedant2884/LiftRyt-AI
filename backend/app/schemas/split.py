import uuid

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


class DayCompletionOut(BaseModel):
    day_index: int
    completed: bool
