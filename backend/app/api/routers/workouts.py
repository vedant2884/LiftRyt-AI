import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.exercise import Exercise
from app.models.user import User
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.schemas.workout import (
    MuscleVolume,
    PersonalRecord,
    WeeklyVolume,
    WorkoutCreate,
    WorkoutDetail,
    WorkoutSetCreate,
    WorkoutSetOut,
    WorkoutSummary,
    WorkoutUpdate,
)
from app.services import workout_analytics

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutSummary, status_code=status.HTTP_201_CREATED)
async def create_workout(
    payload: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkoutSummary:
    workout = Workout(
        user_id=current_user.id,
        name=payload.name,
        performed_at=payload.performed_at or datetime.now(timezone.utc),
        notes=payload.notes,
    )
    db.add(workout)
    await db.commit()
    await db.refresh(workout)
    return WorkoutSummary(
        id=workout.id,
        name=workout.name,
        performed_at=workout.performed_at,
        notes=workout.notes,
        set_count=0,
        total_volume_kg=0.0,
    )


@router.get("", response_model=list[WorkoutSummary])
async def list_workouts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WorkoutSummary]:
    rows = (
        await db.execute(
            select(
                Workout,
                func.count(WorkoutSet.id).label("set_count"),
                # FILTER, not a WHERE clause, so set_count above still
                # counts warmups while volume — matching the analytics
                # service's definition — excludes them.
                func.coalesce(
                    func.sum(WorkoutSet.reps * WorkoutSet.weight_kg).filter(
                        WorkoutSet.is_warmup.is_(False)
                    ),
                    0,
                ).label("total_volume_kg"),
            )
            .outerjoin(WorkoutSet, WorkoutSet.workout_id == Workout.id)
            .where(Workout.user_id == current_user.id)
            .group_by(Workout.id)
            .order_by(Workout.performed_at.desc())
        )
    ).all()

    return [
        WorkoutSummary(
            id=workout.id,
            name=workout.name,
            performed_at=workout.performed_at,
            notes=workout.notes,
            set_count=set_count,
            total_volume_kg=float(total_volume_kg),
        )
        for workout, set_count, total_volume_kg in rows
    ]


@router.get("/prs", response_model=list[PersonalRecord])
async def get_personal_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PersonalRecord]:
    return await workout_analytics.get_personal_records(db, current_user.id)


@router.get("/volume", response_model=list[WeeklyVolume])
async def get_weekly_volume(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WeeklyVolume]:
    return await workout_analytics.get_weekly_volume(db, current_user.id)


@router.get("/volume/muscles", response_model=list[MuscleVolume])
async def get_muscle_volume(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MuscleVolume]:
    return await workout_analytics.get_muscle_volume(db, current_user.id)


@router.get("/{workout_id}", response_model=WorkoutDetail)
async def get_workout(
    workout_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkoutDetail:
    workout = await db.get(Workout, workout_id)
    if workout is None or workout.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")

    rows = (
        await db.execute(
            select(WorkoutSet, Exercise.name)
            .join(Exercise, Exercise.id == WorkoutSet.exercise_id)
            .where(WorkoutSet.workout_id == workout_id)
            .order_by(WorkoutSet.set_number)
        )
    ).all()

    sets = [
        WorkoutSetOut(
            id=workout_set.id,
            exercise_id=workout_set.exercise_id,
            exercise_name=exercise_name,
            set_number=workout_set.set_number,
            reps=workout_set.reps,
            weight_kg=float(workout_set.weight_kg),
            rpe=float(workout_set.rpe) if workout_set.rpe is not None else None,
            is_warmup=workout_set.is_warmup,
            created_at=workout_set.created_at,
        )
        for workout_set, exercise_name in rows
    ]
    return WorkoutDetail(
        id=workout.id,
        name=workout.name,
        performed_at=workout.performed_at,
        notes=workout.notes,
        sets=sets,
    )


@router.patch("/{workout_id}", response_model=WorkoutSummary)
async def update_workout(
    workout_id: uuid.UUID,
    payload: WorkoutUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkoutSummary:
    workout = await db.get(Workout, workout_id)
    if workout is None or workout.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(workout, field, value)
    await db.commit()
    await db.refresh(workout)

    set_count = await db.scalar(
        select(func.count(WorkoutSet.id)).where(WorkoutSet.workout_id == workout_id)
    )
    total_volume = await db.scalar(
        select(
            func.coalesce(func.sum(WorkoutSet.reps * WorkoutSet.weight_kg), 0)
        ).where(
            WorkoutSet.workout_id == workout_id,
            WorkoutSet.is_warmup.is_(False)
        )
    )
    return WorkoutSummary(
        id=workout.id,
        name=workout.name,
        performed_at=workout.performed_at,
        notes=workout.notes,
        set_count=set_count or 0,
        total_volume_kg=float(total_volume or 0),
    )


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(
    workout_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    workout = await db.get(Workout, workout_id)
    if workout is None or workout.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")
    await db.delete(workout)
    await db.commit()


@router.post("/{workout_id}/sets", response_model=WorkoutSetOut, status_code=status.HTTP_201_CREATED)
async def add_set(
    workout_id: uuid.UUID,
    payload: WorkoutSetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkoutSetOut:
    workout = await db.get(Workout, workout_id)
    if workout is None or workout.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")

    exercise = await db.get(Exercise, payload.exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    # Checked before insertion so "prior max" never includes the set being judged.
    is_pr = False
    if not payload.is_warmup:
        is_pr = await workout_analytics.is_new_pr(
            db, current_user.id, payload.exercise_id, payload.weight_kg
        )

    next_set_number = await db.scalar(
        select(func.coalesce(func.max(WorkoutSet.set_number), 0) + 1).where(
            WorkoutSet.workout_id == workout_id
        )
    )

    workout_set = WorkoutSet(
        workout_id=workout_id,
        exercise_id=payload.exercise_id,
        set_number=next_set_number,
        reps=payload.reps,
        weight_kg=payload.weight_kg,
        rpe=payload.rpe,
        is_warmup=payload.is_warmup,
    )
    db.add(workout_set)
    await db.commit()
    await db.refresh(workout_set)

    return WorkoutSetOut(
        id=workout_set.id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        set_number=workout_set.set_number,
        reps=workout_set.reps,
        weight_kg=float(workout_set.weight_kg),
        rpe=float(workout_set.rpe) if workout_set.rpe is not None else None,
        is_warmup=workout_set.is_warmup,
        is_pr=is_pr,
        created_at=workout_set.created_at,
    )


@router.delete("/{workout_id}/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_set(
    workout_id: uuid.UUID,
    set_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    workout = await db.get(Workout, workout_id)
    if workout is None or workout.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")

    workout_set = await db.get(WorkoutSet, set_id)
    if workout_set is None or workout_set.workout_id != workout_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Set not found")

    await db.delete(workout_set)
    await db.commit()
