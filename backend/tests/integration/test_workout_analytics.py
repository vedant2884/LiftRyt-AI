"""Integration tests for app/services/workout_analytics.py.

The warmup-exclusion tests exist specifically because that was a real bug
found by hand in step 6: the workout list's total volume summed warmup
sets while every analytics endpoint excluded them, so the same workout
showed two different "volume" numbers in different parts of the UI. These
tests lock that behavior in so it can't quietly regress.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType
from app.models.exercise import Exercise
from app.models.user import User
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.services import workout_analytics


async def _make_exercise(db: AsyncSession, name: str = "Test Bench Press") -> Exercise:
    exercise = Exercise(
        name=name,
        description="Test fixture exercise.",
        primary_muscles=["chest"],
        secondary_muscles=["triceps"],
        equipment="barbell",
        movement_type=MovementType.COMPOUND,
        category=ExerciseCategory.PUSH,
        difficulty=ExperienceLevel.BEGINNER,
    )
    db.add(exercise)
    await db.flush()
    return exercise


async def _make_workout(db: AsyncSession, user: User, days_ago: int = 0) -> Workout:
    workout = Workout(
        user_id=user.id,
        name="Test Workout",
        performed_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
    )
    db.add(workout)
    await db.flush()
    return workout


async def test_pr_excludes_warmup_even_when_it_is_the_heaviest_set(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    workout = await _make_workout(db_session, test_user)
    db_session.add_all(
        [
            WorkoutSet(
                workout_id=workout.id, exercise_id=exercise.id, set_number=1,
                reps=8, weight_kg=Decimal("60"), is_warmup=False,
            ),
            # Heaviest weight of the session, but it's a warmup — must not win the PR.
            WorkoutSet(
                workout_id=workout.id, exercise_id=exercise.id, set_number=2,
                reps=10, weight_kg=Decimal("90"), is_warmup=True,
            ),
        ]
    )
    await db_session.commit()

    prs = await workout_analytics.get_personal_records(db_session, test_user.id)

    assert len(prs) == 1
    assert prs[0].weight_kg == 60.0


async def test_weekly_volume_excludes_warmup_sets(db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)
    workout = await _make_workout(db_session, test_user)
    db_session.add_all(
        [
            WorkoutSet(
                workout_id=workout.id, exercise_id=exercise.id, set_number=1,
                reps=8, weight_kg=Decimal("60"), is_warmup=False,  # 480 kg volume
            ),
            WorkoutSet(
                workout_id=workout.id, exercise_id=exercise.id, set_number=2,
                reps=10, weight_kg=Decimal("90"), is_warmup=True,  # 900 kg, must be excluded
            ),
        ]
    )
    await db_session.commit()

    volume = await workout_analytics.get_weekly_volume(db_session, test_user.id)

    assert len(volume) == 1
    assert volume[0].volume_kg == pytest.approx(480.0)


async def test_is_new_pr_compares_against_prior_history_not_the_new_set(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    workout = await _make_workout(db_session, test_user)
    db_session.add(
        WorkoutSet(
            workout_id=workout.id, exercise_id=exercise.id, set_number=1,
            reps=5, weight_kg=Decimal("100"), is_warmup=False,
        )
    )
    await db_session.commit()

    heavier = await workout_analytics.is_new_pr(db_session, test_user.id, exercise.id, 105)
    lighter = await workout_analytics.is_new_pr(db_session, test_user.id, exercise.id, 95)
    equal = await workout_analytics.is_new_pr(db_session, test_user.id, exercise.id, 100)

    assert heavier is True
    assert lighter is False
    assert equal is False  # strictly greater than, not greater-or-equal


async def test_is_new_pr_true_for_first_ever_set(db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)

    result = await workout_analytics.is_new_pr(db_session, test_user.id, exercise.id, 40)

    assert result is True


async def test_muscle_volume_attributes_to_every_primary_muscle(
    db_session: AsyncSession, test_user: User
):
    # Back Squat-style exercise with two primary muscles — its volume
    # should show up under both, not just the first.
    exercise = Exercise(
        name="Test Squat",
        primary_muscles=["quads", "glutes"],
        secondary_muscles=[],
        equipment="barbell",
        movement_type=MovementType.COMPOUND,
        category=ExerciseCategory.LEGS,
        difficulty=ExperienceLevel.BEGINNER,
    )
    db_session.add(exercise)
    await db_session.flush()
    workout = await _make_workout(db_session, test_user)
    db_session.add(
        WorkoutSet(
            workout_id=workout.id, exercise_id=exercise.id, set_number=1,
            reps=5, weight_kg=Decimal("100"), is_warmup=False,
        )
    )
    await db_session.commit()

    muscle_volume = await workout_analytics.get_muscle_volume(db_session, test_user.id)
    muscles_seen = {row.muscle for row in muscle_volume}

    assert muscles_seen == {"quads", "glutes"}
    for row in muscle_volume:
        assert row.volume_kg == pytest.approx(500.0)  # 5 reps * 100kg, counted fully under each muscle
