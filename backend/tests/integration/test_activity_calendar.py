"""Integration tests for the activity calendar / workout streak, backed by
real Workout rows — the pure streak-math edge cases already have dedicated
unit coverage in tests/unit/test_streak_calculation.py; this file exists to
prove the actual DB queries (get_workout_dates, get_activity_calendar,
get_workout_overview) wire up correctly, including cross-user isolation.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType
from app.models.exercise import Exercise
from app.models.user import User
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.services import streaks_service, workout_analytics


async def _make_exercise(db: AsyncSession) -> Exercise:
    exercise = Exercise(
        name="Test Bench Press",
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


async def _make_workout(db: AsyncSession, user: User, when: datetime, exercise: Exercise) -> Workout:
    workout = Workout(user_id=user.id, name="Test Workout", performed_at=when)
    db.add(workout)
    await db.flush()
    db.add(
        WorkoutSet(
            workout_id=workout.id, exercise_id=exercise.id, set_number=1,
            reps=8, weight_kg=60, is_warmup=False,
        )
    )
    return workout


async def test_no_workouts_gives_zero_streaks(db_session: AsyncSession, test_user: User):
    streak = await streaks_service.get_workout_streak(db_session, test_user.id)
    assert streak.current_streak_days == 0
    assert streak.longest_streak_days == 0


async def test_current_streak_from_real_workout_rows(db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    for days_ago in (0, 1, 2):
        await _make_workout(db_session, test_user, now - timedelta(days=days_ago), exercise)
    await db_session.commit()

    streak = await streaks_service.get_workout_streak(db_session, test_user.id)

    assert streak.current_streak_days == 3
    assert streak.longest_streak_days == 3


async def test_broken_streak_only_counts_the_most_recent_run(db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    # Workout 6 and 5 days ago (a 2-day streak), gap, then today.
    for days_ago in (6, 5, 0):
        await _make_workout(db_session, test_user, now - timedelta(days=days_ago), exercise)
    await db_session.commit()

    streak = await streaks_service.get_workout_streak(db_session, test_user.id)

    assert streak.current_streak_days == 1  # just today
    assert streak.longest_streak_days == 2  # the earlier 2-day run


async def test_multiple_workouts_same_day_count_as_one_streak_day(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    # Two workouts today (AM/PM split) plus one yesterday.
    await _make_workout(db_session, test_user, now, exercise)
    await _make_workout(db_session, test_user, now - timedelta(hours=6), exercise)
    await _make_workout(db_session, test_user, now - timedelta(days=1), exercise)
    await db_session.commit()

    streak = await streaks_service.get_workout_streak(db_session, test_user.id)

    assert streak.current_streak_days == 2  # today + yesterday, not 3


async def test_activity_calendar_groups_multiple_workouts_per_day(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    day = datetime(2026, 8, 14, 8, tzinfo=timezone.utc)
    await _make_workout(db_session, test_user, day, exercise)
    await _make_workout(db_session, test_user, day.replace(hour=18), exercise)
    await db_session.commit()

    calendar = await workout_analytics.get_activity_calendar(
        db_session, test_user.id, datetime(2026, 8, 1, tzinfo=timezone.utc), datetime(2026, 9, 1, tzinfo=timezone.utc)
    )

    assert len(calendar) == 1
    assert calendar[0].date == day.date()
    assert len(calendar[0].workouts) == 2


async def test_activity_calendar_respects_month_boundaries(db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)
    # One workout in July, one in August — only August should come back
    # when querying the August window.
    await _make_workout(db_session, test_user, datetime(2026, 7, 31, 12, tzinfo=timezone.utc), exercise)
    await _make_workout(db_session, test_user, datetime(2026, 8, 1, 12, tzinfo=timezone.utc), exercise)
    await db_session.commit()

    august = await workout_analytics.get_activity_calendar(
        db_session, test_user.id, datetime(2026, 8, 1, tzinfo=timezone.utc), datetime(2026, 9, 1, tzinfo=timezone.utc)
    )

    assert len(august) == 1
    assert august[0].date == datetime(2026, 8, 1).date()


async def test_activity_calendar_respects_year_boundary(db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)
    await _make_workout(db_session, test_user, datetime(2025, 12, 31, 12, tzinfo=timezone.utc), exercise)
    await _make_workout(db_session, test_user, datetime(2026, 1, 1, 12, tzinfo=timezone.utc), exercise)
    await db_session.commit()

    december = await workout_analytics.get_activity_calendar(
        db_session, test_user.id, datetime(2025, 12, 1, tzinfo=timezone.utc), datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    january = await workout_analytics.get_activity_calendar(
        db_session, test_user.id, datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 2, 1, tzinfo=timezone.utc)
    )

    assert len(december) == 1 and december[0].date == datetime(2025, 12, 31).date()
    assert len(january) == 1 and january[0].date == datetime(2026, 1, 1).date()


async def test_cross_user_isolation_for_streak_and_calendar(
    db_session: AsyncSession, test_user: User, other_user: User
):
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    # test_user has a 3-day streak; other_user has none at all.
    for days_ago in (0, 1, 2):
        await _make_workout(db_session, test_user, now - timedelta(days=days_ago), exercise)
    await db_session.commit()

    user_a_streak = await streaks_service.get_workout_streak(db_session, test_user.id)
    user_b_streak = await streaks_service.get_workout_streak(db_session, other_user.id)

    assert user_a_streak.current_streak_days == 3
    assert user_b_streak.current_streak_days == 0
    assert user_b_streak.longest_streak_days == 0

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (month_start.replace(day=28) + timedelta(days=7)).replace(day=1)
    user_a_calendar = await workout_analytics.get_activity_calendar(
        db_session, test_user.id, month_start, next_month
    )
    user_b_calendar = await workout_analytics.get_activity_calendar(
        db_session, other_user.id, month_start, next_month
    )

    assert len(user_a_calendar) > 0
    assert len(user_b_calendar) == 0
