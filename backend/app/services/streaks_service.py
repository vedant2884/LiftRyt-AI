"""Consistency stats for the Dashboard / Workout Analysis pages:

- Logging streak: consecutive calendar days with a weight entry, resets to
  0 the moment a day is missed. Pure weight_logs data.
- Weekly adherence: planned-vs-completed workouts for the user's active
  split this week, based on split_day_completions. Needs an active split
  to mean anything; returns None if the user has never generated one.
- Workout streak: the same consecutive-days idea as the logging streak,
  but counting actual logged workouts (workouts.performed_at) instead of
  weight entries — deliberately a separate metric (see
  app.services.workout_analytics for the activity calendar this backs),
  since "did you train" and "did you weigh in" are different questions
  and conflating them would hide which one actually needs attention.
  Opening the app, chatting with the Coach, or just viewing a page never
  counts — only a Workout row with at least one set actually logged does.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import Date, cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout
from app.services import split_service

# Default week start (Monday) — not currently user-configurable.
WEEK_START_WEEKDAY = 0


def start_of_week(now: datetime) -> datetime:
    days_since_start = (now.weekday() - WEEK_START_WEEKDAY) % 7
    return (now - timedelta(days=days_since_start)).replace(hour=0, minute=0, second=0, microsecond=0)


def _current_streak(dates: set[date], today: date) -> int:
    cursor = today
    # No entry yet today doesn't break the streak, it just hasn't extended
    # it yet — start counting from yesterday so the streak doesn't drop to 0
    # for the few hours before today's entry goes in.
    if cursor not in dates:
        cursor -= timedelta(days=1)
    streak = 0
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _longest_streak(dates: set[date]) -> int:
    if not dates:
        return 0
    longest = current = 0
    previous: date | None = None
    for day in sorted(dates):
        current = current + 1 if previous is not None and (day - previous).days == 1 else 1
        longest = max(longest, current)
        previous = day
    return longest


async def get_logging_streak_days(db: AsyncSession, user_id: uuid.UUID) -> int:
    rows = await db.scalars(select(WeightLog.logged_at).where(WeightLog.user_id == user_id))
    logged_dates = set(rows.all())
    if not logged_dates:
        return 0
    return _current_streak(logged_dates, datetime.now(timezone.utc).date())


async def get_workout_dates(db: AsyncSession, user_id: uuid.UUID) -> set[date]:
    """Distinct calendar dates with >=1 logged workout — the shared source
    of truth for both the workout streak below and the activity calendar
    (workout_analytics.get_activity_calendar)."""
    rows = await db.scalars(
        select(cast(Workout.performed_at, Date)).where(Workout.user_id == user_id).distinct()
    )
    return set(rows.all())


@dataclass
class WorkoutStreak:
    current_streak_days: int
    longest_streak_days: int


async def get_workout_streak(db: AsyncSession, user_id: uuid.UUID) -> WorkoutStreak:
    dates = await get_workout_dates(db, user_id)
    if not dates:
        return WorkoutStreak(current_streak_days=0, longest_streak_days=0)
    today = datetime.now(timezone.utc).date()
    return WorkoutStreak(
        current_streak_days=_current_streak(dates, today),
        longest_streak_days=_longest_streak(dates),
    )


@dataclass
class WeeklyAdherence:
    completed: int
    planned: int


async def get_weekly_adherence(db: AsyncSession, user: User) -> WeeklyAdherence | None:
    split = await split_service.get_active_split(db, user.id)
    if split is None:
        return None

    week_start = start_of_week(datetime.now(timezone.utc))
    completed_indices = await split_service.get_completed_day_indices_since(db, split.id, week_start)
    return WeeklyAdherence(completed=len(completed_indices), planned=split.days_per_week)
