import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class WeightLogCreate(BaseModel):
    weight_kg: float = Field(gt=0, le=500)
    # Defaults to today when omitted. Logging again for a date you've
    # already logged upserts that entry rather than erroring or duplicating.
    logged_at: date | None = None
    note: str | None = Field(default=None, max_length=1000)


class WeightLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    weight_kg: float
    logged_at: date
    note: str | None
    created_at: datetime


class WeightSeriesPoint(BaseModel):
    logged_at: date
    weight_kg: float
    moving_avg_7d: float | None
    moving_avg_30d: float | None


class WeeklyAverage(BaseModel):
    week_start: date
    avg_weight_kg: float
    entries: int


class WeightTrend(BaseModel):
    rate_kg_per_week: float | None
    projected_goal_date: date | None
    goal_weight_kg: float | None


class WeightAnalyticsResponse(BaseModel):
    current_weight_kg: float | None
    latest_logged_at: date | None
    series: list[WeightSeriesPoint]
    weekly_averages: list[WeeklyAverage]
    trend: WeightTrend
