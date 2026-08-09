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

from app.schemas.workout import (
    ExerciseProgressionStats,
    MuscleVolume,
    PersonalRecord,
    ProgressionSessionPoint,
    RecentExerciseOut,
    WeeklyVolume,
    WorkoutOverview,
)

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

RECENT_EXERCISES_QUERY = text(
    """
    SELECT * FROM (
        SELECT DISTINCT ON (COALESCE(ws.exercise_id, ws.custom_exercise_id))
            COALESCE(ws.exercise_id, ws.custom_exercise_id) AS id,
            ws.custom_exercise_id IS NOT NULL AS is_custom,
            COALESCE(e.name, ce.name) AS name,
            COALESCE(e.primary_muscles, ce.primary_muscles) AS primary_muscles,
            COALESCE(e.equipment, ce.equipment) AS equipment,
            w.performed_at AS last_used_at
        FROM workout_sets ws
        JOIN workouts w ON w.id = ws.workout_id
        LEFT JOIN exercises e ON e.id = ws.exercise_id
        LEFT JOIN custom_exercises ce ON ce.id = ws.custom_exercise_id
        WHERE w.user_id = :user_id
        ORDER BY COALESCE(ws.exercise_id, ws.custom_exercise_id), w.performed_at DESC
    ) recent
    ORDER BY last_used_at DESC
    LIMIT :limit
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


async def get_recent_exercises(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 10
) -> list[RecentExerciseOut]:
    rows = (
        await db.execute(RECENT_EXERCISES_QUERY, {"user_id": user_id, "limit": limit})
    ).mappings().all()
    return [
        RecentExerciseOut(
            id=row["id"],
            is_custom=row["is_custom"],
            name=row["name"],
            primary_muscles=row["primary_muscles"],
            equipment=row["equipment"],
            last_used_at=row["last_used_at"],
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


PROGRESSION_SERIES_QUERY = text(
    """
    SELECT * FROM (
        SELECT DISTINCT ON (w.id)
            w.id AS workout_id,
            w.performed_at AS performed_at,
            w.performed_at::date AS date,
            ws.weight_kg,
            ws.reps
        FROM workout_sets ws
        JOIN workouts w ON w.id = ws.workout_id
        WHERE w.user_id = :user_id AND ws.exercise_id = :exercise_id AND ws.is_warmup = false
        ORDER BY w.id, ws.weight_kg DESC, ws.reps DESC
    ) sessions
    -- Ordered by the full timestamp, not the truncated date, so two
    -- sessions logged on the same calendar day still land in the chart in
    -- the order they actually happened rather than an arbitrary tie order.
    ORDER BY performed_at
    """
)

PROGRESSION_SUMMARY_QUERY = text(
    """
    SELECT
        COUNT(DISTINCT w.id) AS session_count,
        MIN(w.performed_at) AS first_performed_at,
        MAX(w.performed_at) AS last_performed_at,
        SUM(ws.reps * ws.weight_kg) AS total_volume_kg,
        MAX(ws.weight_kg * (1 + ws.reps / 30.0)) AS best_estimated_1rm_kg
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    WHERE w.user_id = :user_id AND ws.exercise_id = :exercise_id AND ws.is_warmup = false
    """
)

# The heaviest set ever logged for this exercise, tie-broken by reps — same
# "top row" shape as the PR query, reused here for best_weight/best_reps
# rather than recomputing it a different way.
PROGRESSION_BEST_SET_QUERY = text(
    """
    SELECT ws.weight_kg, ws.reps
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    WHERE w.user_id = :user_id AND ws.exercise_id = :exercise_id AND ws.is_warmup = false
    ORDER BY ws.weight_kg DESC, ws.reps DESC
    LIMIT 1
    """
)

WORKOUT_OVERVIEW_QUERY = text(
    """
    SELECT
        COUNT(DISTINCT w.id) AS total_workouts,
        COUNT(DISTINCT w.id) FILTER (WHERE w.performed_at >= :week_start) AS workouts_this_week,
        COUNT(DISTINCT w.id) FILTER (WHERE w.performed_at >= :month_start) AS workouts_this_month,
        COALESCE(SUM(ws.reps * ws.weight_kg) FILTER (WHERE ws.is_warmup = false), 0) AS total_volume_kg,
        COUNT(ws.id) FILTER (WHERE ws.is_warmup = false) AS total_sets
    FROM workouts w
    LEFT JOIN workout_sets ws ON ws.workout_id = w.id
    WHERE w.user_id = :user_id
    """
)

MOST_TRAINED_MUSCLE_QUERY = text(
    """
    SELECT muscle, COUNT(*) AS set_count
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    JOIN exercises e ON e.id = ws.exercise_id,
    unnest(e.primary_muscles) AS muscle
    WHERE w.user_id = :user_id AND ws.is_warmup = false
    GROUP BY muscle
    ORDER BY set_count DESC
    LIMIT 1
    """
)

MOST_TRAINED_EXERCISE_QUERY = text(
    """
    SELECT e.name, COUNT(*) AS set_count
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    JOIN exercises e ON e.id = ws.exercise_id
    WHERE w.user_id = :user_id AND ws.is_warmup = false
    GROUP BY e.name
    ORDER BY set_count DESC
    LIMIT 1
    """
)


async def get_exercise_progression(
    db: AsyncSession, user_id: uuid.UUID, exercise_id: uuid.UUID, exercise_name: str
) -> ExerciseProgressionStats:
    series_rows = (
        await db.execute(PROGRESSION_SERIES_QUERY, {"user_id": user_id, "exercise_id": exercise_id})
    ).mappings().all()
    summary = (
        await db.execute(PROGRESSION_SUMMARY_QUERY, {"user_id": user_id, "exercise_id": exercise_id})
    ).mappings().one()
    best_set = (
        await db.execute(PROGRESSION_BEST_SET_QUERY, {"user_id": user_id, "exercise_id": exercise_id})
    ).mappings().first()

    return ExerciseProgressionStats(
        exercise_id=exercise_id,
        exercise_name=exercise_name,
        series=[
            ProgressionSessionPoint(
                workout_id=row["workout_id"],
                date=row["date"],
                weight_kg=float(row["weight_kg"]),
                reps=row["reps"],
            )
            for row in series_rows
        ],
        best_weight_kg=float(best_set["weight_kg"]) if best_set else None,
        best_weight_reps=best_set["reps"] if best_set else None,
        best_estimated_1rm_kg=(
            round(float(summary["best_estimated_1rm_kg"]), 1)
            if summary["best_estimated_1rm_kg"] is not None
            else None
        ),
        total_volume_kg=float(summary["total_volume_kg"] or 0),
        session_count=summary["session_count"] or 0,
        first_performed_at=summary["first_performed_at"],
        last_performed_at=summary["last_performed_at"],
    )


async def get_workout_overview(
    db: AsyncSession, user_id: uuid.UUID, week_start, month_start
) -> WorkoutOverview:
    row = (
        await db.execute(
            WORKOUT_OVERVIEW_QUERY,
            {"user_id": user_id, "week_start": week_start, "month_start": month_start},
        )
    ).mappings().one()
    most_muscle = (
        await db.execute(MOST_TRAINED_MUSCLE_QUERY, {"user_id": user_id})
    ).mappings().first()
    most_exercise = (
        await db.execute(MOST_TRAINED_EXERCISE_QUERY, {"user_id": user_id})
    ).mappings().first()

    return WorkoutOverview(
        total_workouts=row["total_workouts"] or 0,
        workouts_this_week=row["workouts_this_week"] or 0,
        workouts_this_month=row["workouts_this_month"] or 0,
        total_volume_kg=float(row["total_volume_kg"] or 0),
        total_sets=row["total_sets"] or 0,
        most_trained_muscle=most_muscle["muscle"] if most_muscle else None,
        most_trained_exercise_name=most_exercise["name"] if most_exercise else None,
    )
