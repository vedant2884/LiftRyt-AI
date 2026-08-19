"""In-app activity notifications: "looks like you missed a workout,"
streak-alive nudges, a welcome-back message after a longer gap, and a
recent-PR callout — all derived fresh from real workout history on every
call, never stored or scheduled.

That statelessness is deliberate, not a shortcut: there is no push
notification infrastructure in this project (no FCM/APNs registration, no
background job runner/cron on the backend) to actually deliver a
proactively-timed alert, on web or mobile. What's implemented here is the
*eligibility* layer the task asked for — "should the user see a nudge right
now, and what should it say" — computed on demand when the client asks
(e.g. on Dashboard load). Wiring that to true background/push delivery is
the genuinely separate remaining step, and needs platform infrastructure
(a scheduler + FCM/APNs credentials) this codebase doesn't have yet; see
the final report for specifics.

Priority order (first eligible one wins — this app shows at most ONE
notification at a time, deliberately, per "must NOT become spammy"):
  1. Missed an inferred usual training day (only if enough history exists
     to infer a pattern at all — see infer_common_workout_weekdays).
  2. Returning after a longer gap (>= RETURN_REMINDER_GAP_DAYS with no
     workout), regardless of any inferred pattern.
  3. A live streak the user might not realize is still going.
  4. A PR from the last couple of days, worth celebrating/revisiting.
None of these ever claims "you missed your workout" outright — the system
has no way to know a rest day was intentional, so every missed-workout
message is phrased as an observation ("looks like...", "I think..."), not
an accusation, per the task's explicit instruction.
"""

import random
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services import streaks_service, workout_analytics

# How many recent weeks of history to look at when inferring "usual"
# training days, and how many of those weeks need a workout on a given
# weekday before it counts as a real pattern rather than coincidence.
PATTERN_LOOKBACK_WEEKS = 4
PATTERN_MIN_WEEKDAY_HITS = 2
# Below this many total distinct workout days, don't attempt pattern
# inference at all — too little signal to say anything specific.
PATTERN_MIN_TOTAL_DAYS = 3

RETURN_REMINDER_GAP_DAYS = 3
PR_REMINDER_WINDOW_DAYS = 2

MISSED_WORKOUT_MESSAGES = [
    "Looks like you haven't logged a workout today. Want to log it now?",
    "I think something might be missing from today's log \U0001f440",
    "No workout logged yet today — training, or taking it easy?",
]
MISSED_USUAL_DAY_MESSAGES = [
    "I think you missed something \U0001f440 You usually train on {weekday}s. Want to log today's workout?",
    "Looks like today's workout isn't logged yet — {weekday}s are usually a training day for you.",
]
RETURN_REMINDER_MESSAGES = [
    "You haven't logged a workout in a few days. Ready to get back at it?",
    "It's been a bit since your last logged workout. No pressure, just checking in.",
]
STREAK_ALIVE_MESSAGES = [
    "Your {days}-day workout streak is still alive. Keep it going.",
    "Your workout streak is waiting for you \U0001f440 {days} days and counting.",
]
PR_REMINDER_MESSAGES = [
    "You hit a new PR recently — want to see your progress?",
    "Nice work on that recent PR. Check out how far you've come.",
]

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@dataclass
class Notification:
    type: str
    message: str


async def infer_common_workout_weekdays(db: AsyncSession, user_id: uuid.UUID) -> set[int]:
    """Weekdays (0=Monday) that show up often enough in recent history to
    call a real pattern, or an empty set if there isn't enough history to
    say anything — deliberately conservative, per "do not make strong
    assumptions" with little/no history."""
    dates = await streaks_service.get_workout_dates(db, user_id)
    if len(dates) < PATTERN_MIN_TOTAL_DAYS:
        return set()

    cutoff = date.today() - timedelta(weeks=PATTERN_LOOKBACK_WEEKS)
    recent = [d for d in dates if d >= cutoff]
    if len(recent) < PATTERN_MIN_TOTAL_DAYS:
        return set()

    hits_per_weekday: dict[int, int] = {}
    for d in recent:
        hits_per_weekday[d.weekday()] = hits_per_weekday.get(d.weekday(), 0) + 1
    return {weekday for weekday, hits in hits_per_weekday.items() if hits >= PATTERN_MIN_WEEKDAY_HITS}


async def get_notifications(db: AsyncSession, user: User) -> list[Notification]:
    if not user.workout_reminders_enabled:
        return []

    dates = await streaks_service.get_workout_dates(db, user.id)
    today = datetime.now(timezone.utc).date()
    logged_today = today in dates
    last_workout = max(dates) if dates else None
    days_since_last = (today - last_workout).days if last_workout else None

    if not logged_today:
        common_weekdays = await infer_common_workout_weekdays(db, user.id)
        if today.weekday() in common_weekdays:
            weekday_name = WEEKDAY_NAMES[today.weekday()]
            message = random.choice(MISSED_USUAL_DAY_MESSAGES).format(weekday=weekday_name)
            return [Notification(type="missed_workout", message=message)]

        if days_since_last is not None and days_since_last >= RETURN_REMINDER_GAP_DAYS:
            return [Notification(type="return_reminder", message=random.choice(RETURN_REMINDER_MESSAGES))]

        # Neither an inferred usual-day miss nor a longer gap — a soft,
        # generic nudge is still reasonable (today just isn't logged yet),
        # but never the pattern-specific "you usually train on X" wording
        # without the evidence to back it.
        if last_workout is not None:
            return [Notification(type="missed_workout", message=random.choice(MISSED_WORKOUT_MESSAGES))]
        # No workout history at all yet — nothing behavior-based to say.
        return []

    streak = await streaks_service.get_workout_streak(db, user.id)
    if streak.current_streak_days >= 3:
        message = random.choice(STREAK_ALIVE_MESSAGES).format(days=streak.current_streak_days)
        return [Notification(type="streak_alive", message=message)]

    prs = await workout_analytics.get_personal_records(db, user.id)
    recent_pr = next(
        (pr for pr in prs if (today - pr.performed_at.date()).days <= PR_REMINDER_WINDOW_DAYS), None
    )
    if recent_pr is not None:
        return [Notification(type="pr_recent", message=random.choice(PR_REMINDER_MESSAGES))]

    return []
