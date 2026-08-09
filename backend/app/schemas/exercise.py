import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType, PreviewMediaType


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    primary_muscles: list[str]
    secondary_muscles: list[str]
    equipment: str
    movement_type: MovementType
    category: ExerciseCategory
    difficulty: ExperienceLevel

    thumbnail_url: str | None = None
    preview_media_url: str | None = None
    preview_media_type: PreviewMediaType | None = None

    instructions: list[str] | None = None
    common_mistakes: list[str] | None = None
    breathing_tips: str | None = None
    range_of_motion: str | None = None
    tempo: str | None = None
    recommended_sets: str | None = None
    recommended_reps: str | None = None
    beginner_tips: str | None = None
    advanced_tips: str | None = None
    safety_notes: str | None = None


class ExerciseListResponse(BaseModel):
    items: list[ExerciseOut]
    total: int


class CustomExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    primary_muscles: list[str] = Field(min_length=1)
    secondary_muscles: list[str] = Field(default_factory=list)
    equipment: str = Field(min_length=1, max_length=50)
    movement_type: MovementType
    category: ExerciseCategory
    difficulty: ExperienceLevel


class CustomExerciseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    primary_muscles: list[str] | None = Field(default=None, min_length=1)
    secondary_muscles: list[str] | None = None
    equipment: str | None = Field(default=None, min_length=1, max_length=50)
    movement_type: MovementType | None = None
    category: ExerciseCategory | None = None
    difficulty: ExperienceLevel | None = None


class CustomExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    primary_muscles: list[str]
    secondary_muscles: list[str]
    equipment: str
    movement_type: MovementType
    category: ExerciseCategory
    difficulty: ExperienceLevel
    created_at: datetime


class FavoriteExerciseCreate(BaseModel):
    exercise_id: uuid.UUID | None = None
    custom_exercise_id: uuid.UUID | None = None


class FavoriteExerciseOut(BaseModel):
    """Merges the favorite row with whichever exercise it points at (official
    or custom) into one flat shape, so the frontend doesn't need to branch
    on source to render a favorites list."""

    id: uuid.UUID
    exercise_id: uuid.UUID | None
    custom_exercise_id: uuid.UUID | None
    is_custom: bool
    position: int
    name: str
    primary_muscles: list[str]
    secondary_muscles: list[str]
    equipment: str
    movement_type: MovementType
    category: ExerciseCategory
    difficulty: ExperienceLevel


class ReorderFavoritesRequest(BaseModel):
    ordered_ids: list[uuid.UUID]
