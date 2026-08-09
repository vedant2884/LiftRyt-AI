import uuid

from pydantic import BaseModel, ConfigDict, Field


class ExerciseProgressionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_name: str
    # The increment that would actually be used on the next confirmed PR —
    # increment_kg_override if set, else the user's own default. Computed,
    # not stored, so it never drifts from the user's current default.
    increment_kg: float
    increment_kg_override: float | None
    next_suggested_weight_kg: float | None
    enabled: bool


class ConfirmProgressionRequest(BaseModel):
    exercise_id: uuid.UUID
    pr_weight_kg: float = Field(gt=0, le=500)


class UpdateProgressionRequest(BaseModel):
    """All fields optional and independently settable (see exclude_unset in
    the router) — a request can adjust the override, flip enabled, and/or
    clear a consumed suggestion in one call without needing to resend
    fields it isn't touching."""

    exercise_id: uuid.UUID
    increment_kg: float | None = Field(default=None, gt=0, le=50)
    enabled: bool | None = None
    clear_suggestion: bool = False
