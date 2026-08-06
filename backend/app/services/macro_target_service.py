"""Orchestrates saving a MacroTarget: resolves which weight to use, calls
the pure calculate_macros() function, and performs the deactivate-then-
insert needed to respect the partial unique index (one active target per
user) from step 2.

Split out from macro_calculator.py (which stays pure and DB-free) because
both POST /macros/calculate and the AI coach's calculate_macros tool
(step 10) need this exact orchestration and shouldn't each reimplement it.
"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import MacroGoal
from app.models.macro_target import MacroTarget
from app.models.user import User
from app.models.weight_log import WeightLog
from app.services.macro_calculator import calculate_macros


class NoWeightOnFileError(Exception):
    """Raised when no weight_kg was given and the user has no logged weight to fall back to."""


async def resolve_weight_kg(db: AsyncSession, user: User) -> float | None:
    latest = await db.scalar(
        select(WeightLog.weight_kg)
        .where(WeightLog.user_id == user.id)
        .order_by(WeightLog.logged_at.desc())
        .limit(1)
    )
    return float(latest) if latest is not None else None


async def calculate_and_save_target(
    db: AsyncSession, user: User, goal: MacroGoal, weight_kg: float | None = None
) -> MacroTarget:
    if weight_kg is None:
        weight_kg = await resolve_weight_kg(db, user)
    if weight_kg is None:
        raise NoWeightOnFileError

    result = calculate_macros(
        sex=user.sex,
        age=user.age,
        height_cm=float(user.height_cm),
        weight_kg=weight_kg,
        activity_level=user.activity_level,
        goal=goal,
    )

    # Deactivate the current target before inserting the new one — required
    # so the partial unique index is never asked to hold two active rows at
    # once, even momentarily.
    await db.execute(
        update(MacroTarget)
        .where(MacroTarget.user_id == user.id, MacroTarget.is_active.is_(True))
        .values(is_active=False)
    )

    target = MacroTarget(
        user_id=user.id,
        bmr=result.bmr,
        tdee=result.tdee,
        goal=goal,
        target_calories=result.target_calories,
        target_protein_g=result.target_protein_g,
        target_carbs_g=result.target_carbs_g,
        target_fat_g=result.target_fat_g,
        is_active=True,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target
