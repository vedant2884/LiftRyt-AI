import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.exercise import Exercise
from app.models.exercise_progression import ExerciseProgression
from app.models.user import User
from app.schemas.progression import (
    ConfirmProgressionRequest,
    ExerciseProgressionOut,
    UpdateProgressionRequest,
)

router = APIRouter(prefix="/exercises/progressions", tags=["progressions"])


def _to_out(row: ExerciseProgression, exercise_name: str, default_increment: float) -> ExerciseProgressionOut:
    override = float(row.increment_kg) if row.increment_kg is not None else None
    return ExerciseProgressionOut(
        id=row.id,
        exercise_id=row.exercise_id,
        exercise_name=exercise_name,
        increment_kg=override if override is not None else default_increment,
        increment_kg_override=override,
        next_suggested_weight_kg=(
            float(row.next_suggested_weight_kg) if row.next_suggested_weight_kg is not None else None
        ),
        enabled=row.enabled,
    )


async def _get_or_create(db: AsyncSession, user_id: uuid.UUID, exercise_id: uuid.UUID) -> ExerciseProgression:
    row = await db.scalar(
        select(ExerciseProgression).where(
            ExerciseProgression.user_id == user_id, ExerciseProgression.exercise_id == exercise_id
        )
    )
    if row is None:
        row = ExerciseProgression(user_id=user_id, exercise_id=exercise_id)
        db.add(row)
        await db.flush()
    return row


@router.get("", response_model=list[ExerciseProgressionOut])
async def list_progressions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ExerciseProgressionOut]:
    rows = (
        await db.execute(
            select(ExerciseProgression, Exercise.name)
            .join(Exercise, Exercise.id == ExerciseProgression.exercise_id)
            .where(ExerciseProgression.user_id == current_user.id)
        )
    ).all()
    default_increment = float(current_user.default_progression_increment_kg)
    return [_to_out(row, name, default_increment) for row, name in rows]


@router.post("/confirm", response_model=ExerciseProgressionOut, status_code=status.HTTP_201_CREATED)
async def confirm_progression(
    payload: ConfirmProgressionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExerciseProgressionOut:
    """Called when the user explicitly taps "+X kg" on a PR — never
    triggered automatically by the PR itself. Computes and stores the next
    suggested weight from the PR weight they just logged plus their
    effective increment (per-exercise override if set, else their
    account-wide default)."""
    exercise = await db.get(Exercise, payload.exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    row = await _get_or_create(db, current_user.id, payload.exercise_id)
    increment = (
        float(row.increment_kg)
        if row.increment_kg is not None
        else float(current_user.default_progression_increment_kg)
    )
    row.next_suggested_weight_kg = payload.pr_weight_kg + increment
    await db.commit()
    await db.refresh(row)
    return _to_out(row, exercise.name, float(current_user.default_progression_increment_kg))


@router.patch("", response_model=ExerciseProgressionOut)
async def update_progression(
    payload: UpdateProgressionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExerciseProgressionOut:
    """Per-exercise override / enable-disable, and consuming a suggestion
    (clear_suggestion=True) once it's been prefilled into a new workout so
    it doesn't linger and get shown again weeks later."""
    exercise = await db.get(Exercise, payload.exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    row = await _get_or_create(db, current_user.id, payload.exercise_id)
    updates = payload.model_dump(exclude_unset=True, exclude={"exercise_id", "clear_suggestion"})
    for field, value in updates.items():
        setattr(row, field, value)
    if payload.clear_suggestion:
        row.next_suggested_weight_kg = None

    await db.commit()
    await db.refresh(row)
    return _to_out(row, exercise.name, float(current_user.default_progression_increment_kg))
