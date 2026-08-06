"""Workout analytics: personal records and volume tracking, computed with SQL
rather than pulled into Python and aggregated there.

- get_personal_records uses DISTINCT ON, Postgres's "top row per group"
  construct — the idiomatic way to express "the heaviest set per exercise"
  in one pass, cleaner here than a window function + subquery.
- get_muscle_volume joins workout_sets -> exercises and unnest()s the
  primary_muscles array so a set's volume is attributed to every muscle it
  actually trains, then rolls that up by week.
- is_new_pr runs a single MAX() lookup *before* the new set is inserted, so
  "is this a PR" always compares against prior history, never the set being
  judged.
"""

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.workout import MuscleVolume, PersonalRecord, WeeklyVolume

PR_QUERY = text(
    """
    SELECT DISTINCT ON (ws.exercise_id)
        ws.exercise_id,
        e.name AS exercise_name,
        ws.weight_kg,
        ws.reps,
        w.performed_at
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    JOIN exercises e ON e.id = ws.exercise_id
    WHERE w.user_id = :user_id AND ws.is_warmup = false
    ORDER BY ws.exercise_id, ws.weight_kg DESC, w.performed_at ASC
    """
)

WEEKLY_VOLUME_QUERY = text(
    """
    SELECT
        date_trunc('week', w.performed_at)::date AS week_start,
        SUM(ws.reps * ws.weight_kg) AS volume_kg,
        COUNT(DISTINCT w.id) AS workout_count
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    WHERE w.user_id = :user_id AND ws.is_warmup = false
    GROUP BY week_start
    ORDER BY week_start
    """
)

MUSCLE_VOLUME_QUERY = text(
    """
    SELECT
        date_trunc('week', w.performed_at)::date AS week_start,
        muscle,
        SUM(ws.reps * ws.weight_kg) AS volume_kg
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    JOIN exercises e ON e.id = ws.exercise_id,
    unnest(e.primary_muscles) AS muscle
    WHERE w.user_id = :user_id AND ws.is_warmup = false
    GROUP BY week_start, muscle
    ORDER BY week_start, muscle
    """
)

CURRENT_MAX_QUERY = text(
    """
    SELECT MAX(ws.weight_kg)
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    WHERE w.user_id = :user_id AND ws.exercise_id = :exercise_id AND ws.is_warmup = false
    """
)


async def get_personal_records(db: AsyncSession, user_id: uuid.UUID) -> list[PersonalRecord]:
    rows = (await db.execute(PR_QUERY, {"user_id": user_id})).mappings().all()
    return [
        PersonalRecord(
            exercise_id=row["exercise_id"],
            exercise_name=row["exercise_name"],
            weight_kg=float(row["weight_kg"]),
            reps=row["reps"],
            performed_at=row["performed_at"],
        )
        for row in rows
    ]


async def get_weekly_volume(db: AsyncSession, user_id: uuid.UUID) -> list[WeeklyVolume]:
    rows = (await db.execute(WEEKLY_VOLUME_QUERY, {"user_id": user_id})).mappings().all()
    return [
        WeeklyVolume(
            week_start=row["week_start"],
            volume_kg=float(row["volume_kg"]),
            workout_count=row["workout_count"],
        )
        for row in rows
    ]


async def get_muscle_volume(db: AsyncSession, user_id: uuid.UUID) -> list[MuscleVolume]:
    rows = (await db.execute(MUSCLE_VOLUME_QUERY, {"user_id": user_id})).mappings().all()
    return [
        MuscleVolume(
            week_start=row["week_start"], muscle=row["muscle"], volume_kg=float(row["volume_kg"])
        )
        for row in rows
    ]


async def is_new_pr(
    db: AsyncSession, user_id: uuid.UUID, exercise_id: uuid.UUID, weight_kg: float
) -> bool:
    prior_max = await db.scalar(
        CURRENT_MAX_QUERY, {"user_id": user_id, "exercise_id": exercise_id}
    )
    return prior_max is None or weight_kg > float(prior_max)
