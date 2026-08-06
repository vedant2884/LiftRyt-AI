import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import MacroGoal


class MacroCalculateRequest(BaseModel):
    goal: MacroGoal
    # Defaults to the user's latest logged weight when omitted (see the
    # /macros/calculate handler); provide it directly if no weight is on
    # file yet, or to preview targets at a hypothetical weight.
    weight_kg: float | None = Field(default=None, gt=0, le=500)


class MacroTargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bmr: float
    tdee: float
    goal: MacroGoal
    target_calories: float
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    is_active: bool
    created_at: datetime
