from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.exercise import ExerciseOut

RecommendationType = Literal["missing_muscle_group", "variation", "adherence", "progression", "goal_based"]


class RecommendationCard(BaseModel):
    type: RecommendationType
    title: str
    description: str
    exercises: list[ExerciseOut] = []
    action_label: str | None = None
    action_href: str | None = None


class RecommendationsOut(BaseModel):
    cards: list[RecommendationCard]
    generated_at: datetime
