"""Two independent consistency stats for the Dashboard:

- Logging streak: consecutive calendar days with a weight entry, resets to
  0 the moment a day is missed. Pure weight_logs data.
- Weekly adherence: planned-vs-completed workouts for the user's active
  split this week, based on split_day_completions. Needs an active split
  to mean anything; returns None if the user has never generated one.

Deliberately kept separate (not merged into one number) since they measure
different things — one is "did you show up," the other is "did you follow
the plan" — conflating them would hide which one actually needs attention.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.weight_log import WeightLog
from app.services import split_service

# Default week start (Monday) — not currently user-configurable.
WEEK_START_WEEKDAY = 0


def start_of_week(now: datetime) -> datetime:
    days_since_start = (now.weekday() - WEEK_START_WEEKDAY) % 7
    return (now - timedelta(days=days_since_start)).replace(hour=0, minute=0, second=0, microsecond=0)


async def get_logging_streak_days(db: AsyncSession, user_id: uuid.UUID) -> int:
    rows = await db.scalars(select(WeightLog.logged_at).where(WeightLog.user_id == user_id))
    logged_dates = set(rows.all())
    if not logged_dates:
        return 0

    today = datetime.now(timezone.utc).date()
    cursor = today
    # No entry yet today doesn't break the streak, it just hasn't extended
    # it yet — start counting from yesterday so the streak doesn't drop to 0
    # for the few hours before today's entry goes in.
    if cursor not in logged_dates:
        cursor -= timedelta(days=1)

    streak = 0
    while cursor in logged_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


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
