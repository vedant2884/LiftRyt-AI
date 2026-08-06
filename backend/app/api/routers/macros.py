from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.macro_target import MacroTarget
from app.models.user import User
from app.schemas.macro import MacroCalculateRequest, MacroTargetOut
from app.services import macro_target_service

router = APIRouter(prefix="/macros", tags=["macros"])


@router.post("/calculate", response_model=MacroTargetOut, status_code=status.HTTP_201_CREATED)
async def calculate_and_save(
    payload: MacroCalculateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MacroTargetOut:
    try:
        target = await macro_target_service.calculate_and_save_target(
            db, current_user, payload.goal, payload.weight_kg
        )
    except macro_target_service.NoWeightOnFileError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No weight on file. Log your current weight first, or provide weight_kg directly.",
        )
    return MacroTargetOut.model_validate(target)


@router.get("/active", response_model=MacroTargetOut | None)
async def get_active_target(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MacroTargetOut | None:
    target = await db.scalar(
        select(MacroTarget).where(
            MacroTarget.user_id == current_user.id, MacroTarget.is_active.is_(True)
        )
    )
    return MacroTargetOut.model_validate(target) if target else None


@router.get("/history", response_model=list[MacroTargetOut])
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MacroTargetOut]:
    rows = (
        await db.scalars(
            select(MacroTarget)
            .where(MacroTarget.user_id == current_user.id)
            .order_by(MacroTarget.created_at.desc())
        )
    ).all()
    return [MacroTargetOut.model_validate(row) for row in rows]
