import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.custom_exercise import CustomExercise
from app.models.exercise import Exercise
from app.models.exercise_progression import ExerciseProgression
from app.models.user import User
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.schemas.workout import (
    CalendarDayOut,
    ExerciseProgressionStats,
    MuscleVolume,
    PersonalRecord,
    RecentExerciseOut,
    WeeklyVolume,
    WorkoutCreate,
    WorkoutDetail,
    WorkoutOverview,
    WorkoutSetCreate,
    WorkoutSetOut,
    WorkoutSummary,
    WorkoutUpdate,
)
from app.services import workout_analytics
from app.services.streaks_service import start_of_week

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
        duration_seconds=workout.duration_seconds,
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
            duration_seconds=workout.duration_seconds,
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


# Registered before /{workout_id} — a literal path segment ("recent-exercises")
# would otherwise never be reached, since FastAPI matches routes in
# registration order and /{workout_id} would swallow it first as an
# (invalid-UUID, 422) attempt. Same reason custom_exercises/favorites are
# registered before exercises's catch-all elsewhere in this app.
@router.get("/recent-exercises", response_model=list[RecentExerciseOut])
async def get_recent_exercises(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RecentExerciseOut]:
    return await workout_analytics.get_recent_exercises(db, current_user.id, limit)


@router.get("/analysis/overview", response_model=WorkoutOverview)
async def get_workout_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkoutOverview:
    now = datetime.now(timezone.utc)
    week_start = start_of_week(now)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return await workout_analytics.get_workout_overview(db, current_user.id, week_start, month_start)


@router.get("/analysis/calendar", response_model=list[CalendarDayOut])
async def get_activity_calendar(
    year: int = Query(ge=1900, le=2100),
    month: int = Query(ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarDayOut]:
    """One month of activity at a time (not the user's whole history) —
    matches how the frontend calendar navigates, and keeps the query and
    payload bounded regardless of how long someone's been using the app."""
    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(
        year, month + 1, 1, tzinfo=timezone.utc
    )
    return await workout_analytics.get_activity_calendar(db, current_user.id, month_start, month_end)


@router.get("/analysis/progression/{exercise_id}", response_model=ExerciseProgressionStats)
async def get_exercise_progression(
    exercise_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExerciseProgressionStats:
    exercise = await db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
    return await workout_analytics.get_exercise_progression(db, current_user.id, exercise_id, exercise.name)


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
            select(WorkoutSet, Exercise.name, CustomExercise.name)
            .outerjoin(Exercise, Exercise.id == WorkoutSet.exercise_id)
            .outerjoin(CustomExercise, CustomExercise.id == WorkoutSet.custom_exercise_id)
            .where(WorkoutSet.workout_id == workout_id)
            # Sets are logged in exercise-sized bursts, so insertion order
            # naturally groups each exercise's sets together — set_number
            # alone can't be used here since it now restarts at 1 per
            # exercise (see WorkoutSet), not a single counter for the whole
            # workout.
            .order_by(WorkoutSet.created_at)
        )
    ).all()

    sets = [
        WorkoutSetOut(
            id=workout_set.id,
            exercise_id=workout_set.exercise_id,
            custom_exercise_id=workout_set.custom_exercise_id,
            is_custom=workout_set.custom_exercise_id is not None,
            exercise_name=exercise_name or custom_exercise_name,
            set_number=workout_set.set_number,
            reps=workout_set.reps,
            weight_kg=float(workout_set.weight_kg),
            rpe=float(workout_set.rpe) if workout_set.rpe is not None else None,
            is_warmup=workout_set.is_warmup,
            created_at=workout_set.created_at,
        )
        for workout_set, exercise_name, custom_exercise_name in rows
    ]
    return WorkoutDetail(
        id=workout.id,
        name=workout.name,
        performed_at=workout.performed_at,
        notes=workout.notes,
        duration_seconds=workout.duration_seconds,
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
        duration_seconds=workout.duration_seconds,
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

    if (payload.exercise_id is None) == (payload.custom_exercise_id is None):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Provide exactly one of exercise_id or custom_exercise_id"
        )

    exercise_name: str
    if payload.exercise_id is not None:
        exercise = await db.get(Exercise, payload.exercise_id)
        if exercise is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
        exercise_name = exercise.name
    else:
        custom_exercise = await db.get(CustomExercise, payload.custom_exercise_id)
        if custom_exercise is None or custom_exercise.user_id != current_user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
        exercise_name = custom_exercise.name

    # Checked before insertion so "prior max" never includes the set being
    # judged. PR tracking is scoped to official exercises only — custom
    # exercises are inherently one user's own one-off entries, not worth
    # extending that cross-workout comparison for.
    is_pr = False
    suggested_increment_kg: float | None = None
    if not payload.is_warmup and payload.exercise_id is not None:
        is_pr = await workout_analytics.is_new_pr(
            db, current_user.id, payload.exercise_id, payload.weight_kg
        )
        if is_pr:
            progression = await db.scalar(
                select(ExerciseProgression).where(
                    ExerciseProgression.user_id == current_user.id,
                    ExerciseProgression.exercise_id == payload.exercise_id,
                )
            )
            # A disabled progression suppresses the confirm prompt entirely
            # — the PR itself still shows, it just never offers to increase.
            if progression is None or progression.enabled:
                suggested_increment_kg = (
                    float(progression.increment_kg)
                    if progression is not None and progression.increment_kg is not None
                    else float(current_user.default_progression_increment_kg)
                )

    # Scoped to this workout AND this specific exercise, so switching
    # exercises mid-workout restarts set numbering at 1 instead of
    # continuing a single counter across the whole session.
    same_exercise = (
        WorkoutSet.exercise_id == payload.exercise_id
        if payload.exercise_id is not None
        else WorkoutSet.custom_exercise_id == payload.custom_exercise_id
    )
    next_set_number = await db.scalar(
        select(func.coalesce(func.max(WorkoutSet.set_number), 0) + 1).where(
            WorkoutSet.workout_id == workout_id, same_exercise
        )
    )

    workout_set = WorkoutSet(
        workout_id=workout_id,
        exercise_id=payload.exercise_id,
        custom_exercise_id=payload.custom_exercise_id,
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
        exercise_id=workout_set.exercise_id,
        custom_exercise_id=workout_set.custom_exercise_id,
        is_custom=workout_set.custom_exercise_id is not None,
        exercise_name=exercise_name,
        set_number=workout_set.set_number,
        reps=workout_set.reps,
        weight_kg=float(workout_set.weight_kg),
        rpe=float(workout_set.rpe) if workout_set.rpe is not None else None,
        is_warmup=workout_set.is_warmup,
        is_pr=is_pr,
        suggested_increment_kg=suggested_increment_kg,
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
