from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.split import SplitDayOut, SplitExerciseOut, SplitGenerateRequest, SplitPlanOut
from app.services.split_generator import generate_split

router = APIRouter(prefix="/splits", tags=["splits"])


@router.post("/generate", response_model=SplitPlanOut)
async def generate_workout_split(
    payload: SplitGenerateRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SplitPlanOut:
    plan = await generate_split(db, payload.days_per_week, payload.experience_level, payload.goal)

    return SplitPlanOut(
        split_type=plan.split_type,
        days_per_week=payload.days_per_week,
        experience_level=payload.experience_level,
        goal=payload.goal,
        days=[
            SplitDayOut(
                day_number=day.day_number,
                label=day.label,
                exercises=[
                    SplitExerciseOut(
                        exercise_id=pick.exercise.id,
                        name=pick.exercise.name,
                        category=pick.exercise.category,
                        movement_type=pick.exercise.movement_type,
                        sets=pick.sets,
                        reps=pick.reps,
                        reason=pick.reason,
                    )
                    for pick in day.exercises
                ],
            )
            for day in plan.days
        ],
    )
