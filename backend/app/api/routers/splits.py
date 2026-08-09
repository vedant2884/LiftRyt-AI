import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.generated_split import GeneratedSplit
from app.models.user import User
from app.schemas.split import (
    DayCompletionOut,
    SplitDayOut,
    SplitExerciseOut,
    SplitGenerateRequest,
    SplitPlanOut,
)
from app.services import split_service
from app.services.streaks_service import start_of_week

router = APIRouter(prefix="/splits", tags=["splits"])


async def _to_plan_out(db: AsyncSession, split: GeneratedSplit) -> SplitPlanOut:
    week_start = start_of_week(datetime.now(timezone.utc))
    completed = await split_service.get_completed_day_indices_since(db, split.id, week_start)
    return SplitPlanOut(
        id=split.id,
        split_type=split.plan["split_type"],
        days_per_week=split.days_per_week,
        experience_level=split.experience_level,
        goal=split.goal,
        days=[
            SplitDayOut(
                day_number=day["day_number"],
                label=day["label"],
                exercises=[SplitExerciseOut(**ex) for ex in day["exercises"]],
            )
            for day in split.plan["days"]
        ],
        completed_day_numbers=sorted(completed),
    )


@router.post("/generate", response_model=SplitPlanOut)
async def generate_workout_split(
    payload: SplitGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SplitPlanOut:
    split = await split_service.generate_and_save_split(
        db, current_user, payload.days_per_week, payload.experience_level, payload.goal
    )
    return await _to_plan_out(db, split)


@router.get("/active", response_model=SplitPlanOut | None)
async def get_active_split(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SplitPlanOut | None:
    split = await split_service.get_active_split(db, current_user.id)
    if split is None:
        return None
    return await _to_plan_out(db, split)


@router.post("/{split_id}/days/{day_index}/toggle-complete", response_model=DayCompletionOut)
async def toggle_day_complete(
    split_id: uuid.UUID,
    day_index: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DayCompletionOut:
    split = await db.get(GeneratedSplit, split_id)
    if split is None or split.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Split not found")

    completed = await split_service.toggle_day_completion(db, current_user.id, split_id, day_index)
    return DayCompletionOut(day_index=day_index, completed=completed)
