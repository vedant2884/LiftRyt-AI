import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkoutSetCreate(BaseModel):
    exercise_id: uuid.UUID | None = None
    custom_exercise_id: uuid.UUID | None = None
    reps: int = Field(gt=0, le=200)
    weight_kg: float = Field(ge=0, le=500)
    rpe: float | None = Field(default=None, ge=1, le=10)
    is_warmup: bool = False


class WorkoutSetOut(BaseModel):
    id: uuid.UUID
    exercise_id: uuid.UUID | None
    custom_exercise_id: uuid.UUID | None
    is_custom: bool
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
    # Set only alongside is_pr=True — the increment that would be applied
    # if the user explicitly confirms "increase next weight?" (per-exercise
    # override if one exists and progression isn't disabled for it, else
    # the user's account-wide default). Never acted on by the backend on
    # its own; purely what the frontend's confirm prompt offers.
    suggested_increment_kg: float | None = None
    created_at: datetime


class WorkoutCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    performed_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class WorkoutUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    notes: str | None = Field(default=None, max_length=2000)
    # Set once, at Finish Workout.
    duration_seconds: int | None = Field(default=None, ge=0, le=24 * 60 * 60)


class WorkoutSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    performed_at: datetime
    notes: str | None
    duration_seconds: int | None
    set_count: int
    total_volume_kg: float


class WorkoutDetail(BaseModel):
    id: uuid.UUID
    name: str
    performed_at: datetime
    notes: str | None
    duration_seconds: int | None
    sets: list[WorkoutSetOut]


class RecentExerciseOut(BaseModel):
    """Lean shape for the workout exercise picker's "recently used" list —
    just enough to display and to build the next WorkoutSetCreate, not the
    full exercise record (see ExercisePickerSheet: recent -> favorites ->
    search, kept fast rather than filter-heavy)."""

    id: uuid.UUID
    is_custom: bool
    name: str
    primary_muscles: list[str]
    equipment: str
    last_used_at: datetime


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


class ProgressionSessionPoint(BaseModel):
    """One workout's best (heaviest) set for a given exercise — the unit a
    progression chart plots, one point per session, not one per set.
    workout_id lets the frontend cross-reference "which workouts include
    this exercise" for History's exercise filter, reusing this same query
    rather than adding a second one just for that."""

    workout_id: uuid.UUID
    date: date
    weight_kg: float
    reps: int


class ExerciseProgressionStats(BaseModel):
    exercise_id: uuid.UUID
    exercise_name: str
    series: list[ProgressionSessionPoint]
    best_weight_kg: float | None
    best_weight_reps: int | None
    # Epley formula (weight * (1 + reps/30)) over every non-warmup set —
    # an estimate, not a tested max, labeled as such in the UI.
    best_estimated_1rm_kg: float | None
    total_volume_kg: float
    session_count: int
    first_performed_at: datetime | None
    last_performed_at: datetime | None


class WorkoutOverview(BaseModel):
    total_workouts: int
    workouts_this_week: int
    workouts_this_month: int
    total_volume_kg: float
    total_sets: int
    most_trained_muscle: str | None
    most_trained_exercise_name: str | None
