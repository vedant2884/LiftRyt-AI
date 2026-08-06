import uuid

from pydantic import BaseModel, ConfigDict

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType


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


class ExerciseListResponse(BaseModel):
    items: list[ExerciseOut]
    total: int
