from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.streaks import StreaksOut, WeeklyAdherenceOut
from app.services.streaks_service import get_logging_streak_days, get_weekly_adherence

router = APIRouter(prefix="/streaks", tags=["streaks"])


@router.get("", response_model=StreaksOut)
async def get_streaks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreaksOut:
    logging_streak_days = await get_logging_streak_days(db, current_user.id)
    adherence = await get_weekly_adherence(db, current_user)

    return StreaksOut(
        logging_streak_days=logging_streak_days,
        weekly_adherence=(
            WeeklyAdherenceOut(completed=adherence.completed, planned=adherence.planned)
            if adherence is not None
            else None
        ),
    )
