"""Orchestrates persisting a GeneratedSplit and tracking per-day completions.

Mirrors macro_target_service.py's shape: the pure split_generator.py stays
DB-free and reusable, this module adds the deactivate-then-insert dance
needed to respect the "one active split per user" partial unique index.
Both POST /splits/generate and the AI coach's generate_workout_split tool
go through generate_and_save_split so "the active split" means the same
thing regardless of how it was created.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_exercise import CustomExercise
from app.models.enums import ExperienceLevel, TrainingGoal
from app.models.generated_split import GeneratedSplit
from app.models.split_day_completion import SplitDayCompletion
from app.models.user import User
from app.services.split_generator import SplitPlan, generate_split


def _plan_to_dict(plan: SplitPlan) -> dict:
    return {
        "split_type": plan.split_type,
        "days": [
            {
                "day_number": day.day_number,
                "label": day.label,
                "exercises": [
                    {
                        "exercise_id": str(pick.exercise.id),
                        "name": pick.exercise.name,
                        "category": pick.exercise.category.value,
                        "movement_type": pick.exercise.movement_type.value,
                        "is_custom": isinstance(pick.exercise, CustomExercise),
                        "primary_muscles": list(pick.exercise.primary_muscles),
                        "sets": pick.sets,
                        "reps": pick.reps,
                        "reason": pick.reason,
                    }
                    for pick in day.exercises
                ],
            }
            for day in plan.days
        ],
    }


async def generate_and_save_split(
    db: AsyncSession,
    user: User,
    days_per_week: int,
    experience_level: ExperienceLevel,
    goal: TrainingGoal,
) -> GeneratedSplit:
    plan = await generate_split(db, days_per_week, experience_level, goal, user_id=user.id)

    # Deactivate the current split before inserting the new one — same
    # reasoning as macro_target_service: never let the partial unique index
    # find two active rows at once, even momentarily.
    await db.execute(
        update(GeneratedSplit)
        .where(GeneratedSplit.user_id == user.id, GeneratedSplit.is_active.is_(True))
        .values(is_active=False)
    )

    split = GeneratedSplit(
        user_id=user.id,
        split_type=plan.split_type,
        days_per_week=days_per_week,
        experience_level=experience_level,
        goal=goal,
        plan=_plan_to_dict(plan),
        is_active=True,
    )
    db.add(split)
    await db.commit()
    await db.refresh(split)
    return split


async def get_active_split(db: AsyncSession, user_id: uuid.UUID) -> GeneratedSplit | None:
    return await db.scalar(
        select(GeneratedSplit).where(GeneratedSplit.user_id == user_id, GeneratedSplit.is_active.is_(True))
    )


async def list_splits(db: AsyncSession, user_id: uuid.UUID) -> list[GeneratedSplit]:
    """Every split the user has ever generated, not just the active one —
    generating a new split has always deactivated the previous one, but
    nothing before this let you see or return to it. Newest first."""
    rows = await db.scalars(
        select(GeneratedSplit)
        .where(GeneratedSplit.user_id == user_id)
        .order_by(GeneratedSplit.created_at.desc())
    )
    return list(rows.all())


async def activate_split(db: AsyncSession, user_id: uuid.UUID, split_id: uuid.UUID) -> GeneratedSplit:
    """Marks split_id as the user's preferred/active split. Same deactivate-
    then-activate ordering as generate_and_save_split, so the partial
    unique index never sees two active rows for this user at once."""
    split = await db.get(GeneratedSplit, split_id)
    if split is None or split.user_id != user_id:
        raise ValueError("Split not found")

    await db.execute(
        update(GeneratedSplit)
        .where(GeneratedSplit.user_id == user_id, GeneratedSplit.is_active.is_(True))
        .values(is_active=False)
    )
    split.is_active = True
    await db.commit()
    await db.refresh(split)
    return split


async def get_next_day_number(db: AsyncSession, split: GeneratedSplit) -> int:
    """Which day of the split's rotation is "today's" — the day after the
    most recently completed one (wrapping back to day 1 past the last day),
    or day 1 if nothing has ever been completed. Deliberately not tied to
    calendar weekdays: the split itself isn't either (just "N days/week"),
    so rotation position is the only thing that's actually well-defined."""
    last_completed = await db.scalar(
        select(SplitDayCompletion.day_index)
        .where(SplitDayCompletion.split_id == split.id)
        .order_by(desc(SplitDayCompletion.completed_at))
        .limit(1)
    )
    if last_completed is None:
        return 1
    return (last_completed % split.days_per_week) + 1


async def toggle_day_completion(
    db: AsyncSession, user_id: uuid.UUID, split_id: uuid.UUID, day_index: int
) -> bool:
    """Marks a planned day complete for today, or un-marks it if it's
    already complete today. Returns the resulting state (True = now
    complete). Scoped to "today" so tapping the same day on different days
    logs separate completions instead of silently no-op'ing."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    existing = await db.scalar(
        select(SplitDayCompletion).where(
            SplitDayCompletion.user_id == user_id,
            SplitDayCompletion.split_id == split_id,
            SplitDayCompletion.day_index == day_index,
            SplitDayCompletion.completed_at >= today_start,
            SplitDayCompletion.completed_at < today_end,
        )
    )
    if existing is not None:
        await db.delete(existing)
        await db.commit()
        return False

    db.add(
        SplitDayCompletion(user_id=user_id, split_id=split_id, day_index=day_index, completed_at=now)
    )
    await db.commit()
    return True


async def get_completed_day_indices_since(
    db: AsyncSession, split_id: uuid.UUID, since: datetime
) -> set[int]:
    rows = await db.scalars(
        select(SplitDayCompletion.day_index)
        .where(SplitDayCompletion.split_id == split_id, SplitDayCompletion.completed_at >= since)
        .distinct()
    )
    return set(rows.all())
