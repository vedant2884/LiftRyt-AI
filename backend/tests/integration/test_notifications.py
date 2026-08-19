"""Integration tests for the in-app notification eligibility layer (see
app/services/notification_service.py's module docstring for why this is
stateless, on-demand eligibility rather than scheduled push delivery)."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType
from app.models.exercise import Exercise
from app.models.user import User
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet
from app.services.notification_service import get_notifications


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


async def test_no_history_returns_no_notifications(db_session: AsyncSession, test_user: User):
    notifications = await get_notifications(db_session, test_user)
    assert notifications == []


async def test_disabled_preference_returns_nothing_even_with_a_gap(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await _make_workout(db_session, test_user, datetime.now(timezone.utc) - timedelta(days=10), exercise)
    test_user.workout_reminders_enabled = False
    await db_session.commit()

    notifications = await get_notifications(db_session, test_user)

    assert notifications == []


async def test_missed_workout_after_gap_uses_soft_wording_not_an_accusation(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    await _make_workout(db_session, test_user, now - timedelta(days=5), exercise)
    await db_session.commit()

    notifications = await get_notifications(db_session, test_user)

    assert len(notifications) == 1
    assert notifications[0].type == "return_reminder"
    # Never an outright accusation — the system can't know a rest day was
    # unintentional, so it must never claim "you missed your workout."
    assert "you missed your workout" not in notifications[0].message.lower()


async def test_missed_inferred_usual_day_names_the_weekday(db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)
    today = datetime.now(timezone.utc)
    # Workouts on the same weekday as today, 1/2/3 weeks ago — a real
    # pattern the system can name, per PATTERN_MIN_WEEKDAY_HITS.
    for weeks_ago in (1, 2, 3):
        await _make_workout(db_session, test_user, today - timedelta(weeks=weeks_ago), exercise)
    await db_session.commit()

    notifications = await get_notifications(db_session, test_user)

    assert len(notifications) == 1
    assert notifications[0].type == "missed_workout"


async def test_little_history_does_not_claim_a_pattern(db_session: AsyncSession, test_user: User):
    # Only one prior workout ever — nowhere near enough to infer "you
    # usually train on X," per PATTERN_MIN_TOTAL_DAYS. Should still get a
    # generic nudge (there IS a gap), just not a pattern-specific one.
    exercise = await _make_exercise(db_session)
    await _make_workout(
        db_session, test_user, datetime.now(timezone.utc) - timedelta(days=1), exercise
    )
    await db_session.commit()

    notifications = await get_notifications(db_session, test_user)

    assert len(notifications) == 1
    assert notifications[0].type == "missed_workout"
    assert "usually train" not in notifications[0].message


async def test_streak_alive_when_three_plus_days_and_logged_today(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    for days_ago in (0, 1, 2, 3):
        await _make_workout(db_session, test_user, now - timedelta(days=days_ago), exercise)
    await db_session.commit()

    notifications = await get_notifications(db_session, test_user)

    assert len(notifications) == 1
    assert notifications[0].type == "streak_alive"
    assert "4" in notifications[0].message


async def test_short_streak_with_workout_today_is_quiet(db_session: AsyncSession, test_user: User):
    # Logged today, but the streak is only 1 day (a workout 5 days ago
    # doesn't chain to today) and today's set doesn't beat the PR set from
    # that earlier workout, which is now outside the recency window —
    # nothing notification-worthy (not every completed workout needs one).
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    older = Workout(user_id=test_user.id, name="Older Workout", performed_at=now - timedelta(days=5))
    db_session.add(older)
    await db_session.flush()
    db_session.add(
        WorkoutSet(
            workout_id=older.id, exercise_id=exercise.id, set_number=1,
            reps=8, weight_kg=100, is_warmup=False,  # the PR, set 5 days ago
        )
    )
    today_workout = await _make_workout(db_session, test_user, now, exercise)  # weight_kg=60, not a PR
    await db_session.commit()

    notifications = await get_notifications(db_session, test_user)

    assert notifications == []
    assert today_workout.id is not None  # sanity: today's workout really was logged


async def test_recent_pr_surfaces_when_no_streak_notification_applies(
    db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await _make_workout(db_session, test_user, datetime.now(timezone.utc), exercise)
    await db_session.commit()
    # The only set ever logged for this exercise is automatically the PR.

    notifications = await get_notifications(db_session, test_user)

    assert len(notifications) == 1
    assert notifications[0].type == "pr_recent"


async def test_repeated_calls_do_not_accumulate_duplicates(db_session: AsyncSession, test_user: User):
    """"Duplicate prevention" in this stateless design means calling it
    again with no state change returns the same single notification, not
    a second one stacking alongside it — there's no persisted log to
    dedupe against because there's nothing to accumulate in the first
    place."""
    exercise = await _make_exercise(db_session)
    await _make_workout(db_session, test_user, datetime.now(timezone.utc) - timedelta(days=5), exercise)
    await db_session.commit()

    first = await get_notifications(db_session, test_user)
    second = await get_notifications(db_session, test_user)

    assert len(first) == 1
    assert len(first) == len(second)
    assert first[0].type == second[0].type


async def test_cross_user_isolation(db_session: AsyncSession, test_user: User, other_user: User):
    exercise = await _make_exercise(db_session)
    now = datetime.now(timezone.utc)
    for days_ago in (0, 1, 2, 3):
        await _make_workout(db_session, test_user, now - timedelta(days=days_ago), exercise)
    await db_session.commit()

    user_a = await get_notifications(db_session, test_user)
    user_b = await get_notifications(db_session, other_user)

    assert len(user_a) == 1 and user_a[0].type == "streak_alive"
    assert user_b == []  # other_user has no workout history at all
