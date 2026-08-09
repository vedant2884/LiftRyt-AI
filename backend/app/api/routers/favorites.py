import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.custom_exercise import CustomExercise
from app.models.exercise import Exercise
from app.models.favorite_exercise import FavoriteExercise
from app.models.user import User
from app.schemas.exercise import FavoriteExerciseCreate, FavoriteExerciseOut, ReorderFavoritesRequest

router = APIRouter(prefix="/exercises/favorites", tags=["favorites"])


def _to_out(favorite: FavoriteExercise, source: Exercise | CustomExercise) -> FavoriteExerciseOut:
    return FavoriteExerciseOut(
        id=favorite.id,
        exercise_id=favorite.exercise_id,
        custom_exercise_id=favorite.custom_exercise_id,
        is_custom=favorite.custom_exercise_id is not None,
        position=favorite.position,
        name=source.name,
        primary_muscles=source.primary_muscles,
        secondary_muscles=source.secondary_muscles,
        equipment=source.equipment,
        movement_type=source.movement_type,
        category=source.category,
        difficulty=source.difficulty,
    )


@router.get("", response_model=list[FavoriteExerciseOut])
async def list_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FavoriteExerciseOut]:
    favorites = (
        await db.scalars(
            select(FavoriteExercise)
            .where(FavoriteExercise.user_id == current_user.id)
            .order_by(FavoriteExercise.position)
        )
    ).all()
    if not favorites:
        return []

    exercise_ids = [f.exercise_id for f in favorites if f.exercise_id is not None]
    custom_ids = [f.custom_exercise_id for f in favorites if f.custom_exercise_id is not None]

    exercises_by_id: dict[uuid.UUID, Exercise] = {}
    if exercise_ids:
        rows = (await db.scalars(select(Exercise).where(Exercise.id.in_(exercise_ids)))).all()
        exercises_by_id = {row.id: row for row in rows}

    custom_by_id: dict[uuid.UUID, CustomExercise] = {}
    if custom_ids:
        rows = (await db.scalars(select(CustomExercise).where(CustomExercise.id.in_(custom_ids)))).all()
        custom_by_id = {row.id: row for row in rows}

    out: list[FavoriteExerciseOut] = []
    for favorite in favorites:
        source = (
            exercises_by_id.get(favorite.exercise_id)
            if favorite.exercise_id is not None
            else custom_by_id.get(favorite.custom_exercise_id)
        )
        # Source row was deleted out from under the favorite (shouldn't
        # normally happen — the FK is ondelete=CASCADE — but skip rather
        # than 500 if it ever does, e.g. mid-transaction race).
        if source is None:
            continue
        out.append(_to_out(favorite, source))
    return out


@router.post("", response_model=FavoriteExerciseOut, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    payload: FavoriteExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavoriteExerciseOut:
    if (payload.exercise_id is None) == (payload.custom_exercise_id is None):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Provide exactly one of exercise_id or custom_exercise_id"
        )

    source: Exercise | CustomExercise | None
    if payload.exercise_id is not None:
        source = await db.get(Exercise, payload.exercise_id)
    else:
        source = await db.get(CustomExercise, payload.custom_exercise_id)
        if source is not None and source.user_id != current_user.id:
            source = None
    if source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    existing = await db.scalar(
        select(FavoriteExercise).where(
            FavoriteExercise.user_id == current_user.id,
            FavoriteExercise.exercise_id == payload.exercise_id,
            FavoriteExercise.custom_exercise_id == payload.custom_exercise_id,
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already favorited")

    max_position = await db.scalar(
        select(FavoriteExercise.position)
        .where(FavoriteExercise.user_id == current_user.id)
        .order_by(FavoriteExercise.position.desc())
        .limit(1)
    )
    favorite = FavoriteExercise(
        user_id=current_user.id,
        exercise_id=payload.exercise_id,
        custom_exercise_id=payload.custom_exercise_id,
        position=(max_position + 1) if max_position is not None else 0,
    )
    db.add(favorite)
    await db.commit()
    await db.refresh(favorite)
    return _to_out(favorite, source)


@router.put("/reorder", response_model=list[FavoriteExerciseOut])
async def reorder_favorites(
    payload: ReorderFavoritesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FavoriteExerciseOut]:
    favorites = (
        await db.scalars(select(FavoriteExercise).where(FavoriteExercise.user_id == current_user.id))
    ).all()
    by_id = {f.id: f for f in favorites}

    if set(payload.ordered_ids) != set(by_id.keys()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "ordered_ids must contain exactly the user's current favorite IDs"
        )

    for position, favorite_id in enumerate(payload.ordered_ids):
        by_id[favorite_id].position = position
    await db.commit()

    return await list_favorites(current_user, db)


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    favorite_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    favorite = await db.get(FavoriteExercise, favorite_id)
    if favorite is None or favorite.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Favorite not found")
    await db.delete(favorite)
    await db.commit()
