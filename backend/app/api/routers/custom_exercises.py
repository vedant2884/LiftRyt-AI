import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.custom_exercise import CustomExercise
from app.models.enums import ExerciseCategory, ExperienceLevel
from app.models.user import User
from app.schemas.exercise import CustomExerciseCreate, CustomExerciseOut, CustomExerciseUpdate

router = APIRouter(prefix="/exercises/custom", tags=["custom-exercises"])


@router.get("", response_model=list[CustomExerciseOut])
async def list_custom_exercises(
    q: str | None = Query(default=None, description="Search by name or description"),
    category: ExerciseCategory | None = None,
    difficulty: ExperienceLevel | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CustomExerciseOut]:
    filters = [CustomExercise.user_id == current_user.id]
    if q:
        like = f"%{q}%"
        filters.append(or_(CustomExercise.name.ilike(like), CustomExercise.description.ilike(like)))
    if category:
        filters.append(CustomExercise.category == category)
    if difficulty:
        filters.append(CustomExercise.difficulty == difficulty)

    rows = (
        await db.scalars(select(CustomExercise).where(*filters).order_by(CustomExercise.name))
    ).all()
    return [CustomExerciseOut.model_validate(row) for row in rows]


@router.post("", response_model=CustomExerciseOut, status_code=status.HTTP_201_CREATED)
async def create_custom_exercise(
    payload: CustomExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomExerciseOut:
    existing = await db.scalar(
        select(CustomExercise).where(
            CustomExercise.user_id == current_user.id, CustomExercise.name == payload.name
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a custom exercise with that name")

    exercise = CustomExercise(user_id=current_user.id, **payload.model_dump())
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    return CustomExerciseOut.model_validate(exercise)


async def _get_owned(db: AsyncSession, user: User, exercise_id: uuid.UUID) -> CustomExercise:
    exercise = await db.get(CustomExercise, exercise_id)
    if exercise is None or exercise.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Custom exercise not found")
    return exercise


@router.patch("/{exercise_id}", response_model=CustomExerciseOut)
async def update_custom_exercise(
    exercise_id: uuid.UUID,
    payload: CustomExerciseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomExerciseOut:
    exercise = await _get_owned(db, current_user, exercise_id)
    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates and updates["name"] != exercise.name:
        existing = await db.scalar(
            select(CustomExercise).where(
                CustomExercise.user_id == current_user.id, CustomExercise.name == updates["name"]
            )
        )
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "You already have a custom exercise with that name")

    for field, value in updates.items():
        setattr(exercise, field, value)
    await db.commit()
    await db.refresh(exercise)
    return CustomExerciseOut.model_validate(exercise)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_exercise(
    exercise_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    exercise = await _get_owned(db, current_user, exercise_id)
    await db.delete(exercise)
    await db.commit()
