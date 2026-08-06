import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkoutSetCreate(BaseModel):
    exercise_id: uuid.UUID
    reps: int = Field(gt=0, le=200)
    weight_kg: float = Field(ge=0, le=500)
    rpe: float | None = Field(default=None, ge=1, le=10)
    is_warmup: bool = False


class WorkoutSetOut(BaseModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_name: str
    set_number: int
    reps: int
    weight_kg: float
    rpe: float | None
    is_warmup: bool
    # True only in the response right after logging a set (see POST
    # /workouts/{id}/sets) — not reconstructed retroactively for historical
    # views, since "was this a PR at the time" needs a full point-in-time
    # replay that isn't worth the complexity for what's mainly a
    # log-and-celebrate moment.
    is_pr: bool = False
    created_at: datetime


class WorkoutCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    performed_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class WorkoutUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    notes: str | None = Field(default=None, max_length=2000)


class WorkoutSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    performed_at: datetime
    notes: str | None
    set_count: int
    total_volume_kg: float


class WorkoutDetail(BaseModel):
    id: uuid.UUID
    name: str
    performed_at: datetime
    notes: str | None
    sets: list[WorkoutSetOut]


class PersonalRecord(BaseModel):
    exercise_id: uuid.UUID
    exercise_name: str
    weight_kg: float
    reps: int
    performed_at: datetime


class WeeklyVolume(BaseModel):
    week_start: date
    volume_kg: float
    workout_count: int


class MuscleVolume(BaseModel):
    week_start: date
    muscle: str
    volume_kg: float
