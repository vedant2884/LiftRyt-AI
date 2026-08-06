from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.macro_target import MacroTarget
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.macro import MacroCalculateRequest, MacroTargetOut
from app.services.macro_calculator import calculate_macros

router = APIRouter(prefix="/macros", tags=["macros"])


@router.post("/calculate", response_model=MacroTargetOut, status_code=status.HTTP_201_CREATED)
async def calculate_and_save(
    payload: MacroCalculateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MacroTargetOut:
    weight_kg = payload.weight_kg
    if weight_kg is None:
        latest = await db.scalar(
            select(WeightLog.weight_kg)
            .where(WeightLog.user_id == current_user.id)
            .order_by(WeightLog.logged_at.desc())
            .limit(1)
        )
        if latest is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "No weight on file. Log your current weight first, or provide weight_kg directly.",
            )
        weight_kg = float(latest)

    result = calculate_macros(
        sex=current_user.sex,
        age=current_user.age,
        height_cm=float(current_user.height_cm),
        weight_kg=weight_kg,
        activity_level=current_user.activity_level,
        goal=payload.goal,
    )

    # Deactivate the current target (if any) before inserting the new one —
    # required so the partial unique index from step 2 (one active row per
    # user) is never asked to hold two active rows at once, even mid-transaction.
    await db.execute(
        update(MacroTarget)
        .where(MacroTarget.user_id == current_user.id, MacroTarget.is_active.is_(True))
        .values(is_active=False)
    )

    target = MacroTarget(
        user_id=current_user.id,
        bmr=result.bmr,
        tdee=result.tdee,
        goal=payload.goal,
        target_calories=result.target_calories,
        target_protein_g=result.target_protein_g,
        target_carbs_g=result.target_carbs_g,
        target_fat_g=result.target_fat_g,
        is_active=True,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
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
