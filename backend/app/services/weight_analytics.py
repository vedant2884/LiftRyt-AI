"""Weight trend analytics computed server-side with SQL window functions
and aggregates, rather than pulling raw rows and crunching them in Python.

Three distinct SQL techniques, each picked because it's the right tool for
that specific number, not for variety's sake:
  - AVG() OVER (... RANGE BETWEEN INTERVAL ...) for the moving averages:
    RANGE (not ROWS) so a gap in logging doesn't shrink the calendar window.
  - GROUP BY date_trunc('week', ...) for the weekly averages.
  - regr_slope()/regr_intercept(), Postgres's built-in least-squares
    regression aggregates, for the trend line — no need to hand-roll linear
    regression in Python when Postgres already has it.
"""

import uuid
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.weight import WeeklyAverage, WeightSeriesPoint, WeightTrend

SERIES_QUERY = text(
    """
    SELECT
        logged_at,
        weight_kg,
        AVG(weight_kg) OVER (
            ORDER BY logged_at
            RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
        ) AS moving_avg_7d,
        AVG(weight_kg) OVER (
            ORDER BY logged_at
            RANGE BETWEEN INTERVAL '29 days' PRECEDING AND CURRENT ROW
        ) AS moving_avg_30d
    FROM weight_logs
    WHERE user_id = :user_id
    ORDER BY logged_at
    """
)

WEEKLY_AVERAGE_QUERY = text(
    """
    SELECT
        date_trunc('week', logged_at)::date AS week_start,
        AVG(weight_kg) AS avg_weight_kg,
        COUNT(*) AS entries
    FROM weight_logs
    WHERE user_id = :user_id
    GROUP BY week_start
    ORDER BY week_start
    """
)

# x = days since the user's first entry (not absolute epoch days) so the
# regression coefficients stay small and easy to sanity-check by hand.
TREND_QUERY = text(
    """
    WITH bounds AS (
        SELECT MIN(logged_at) AS first_date FROM weight_logs WHERE user_id = :user_id
    )
    SELECT
        b.first_date,
        regr_slope(wl.weight_kg, (wl.logged_at - b.first_date)) AS slope_kg_per_day,
        regr_intercept(wl.weight_kg, (wl.logged_at - b.first_date)) AS intercept_kg
    FROM weight_logs wl, bounds b
    WHERE wl.user_id = :user_id
    GROUP BY b.first_date
    """
)


async def get_weight_series(db: AsyncSession, user_id: uuid.UUID) -> list[WeightSeriesPoint]:
    rows = (await db.execute(SERIES_QUERY, {"user_id": user_id})).mappings().all()
    return [
        WeightSeriesPoint(
            logged_at=row["logged_at"],
            weight_kg=float(row["weight_kg"]),
            moving_avg_7d=float(row["moving_avg_7d"]) if row["moving_avg_7d"] is not None else None,
            moving_avg_30d=float(row["moving_avg_30d"])
            if row["moving_avg_30d"] is not None
            else None,
        )
        for row in rows
    ]


async def get_weekly_averages(db: AsyncSession, user_id: uuid.UUID) -> list[WeeklyAverage]:
    rows = (await db.execute(WEEKLY_AVERAGE_QUERY, {"user_id": user_id})).mappings().all()
    return [
        WeeklyAverage(
            week_start=row["week_start"],
            avg_weight_kg=round(float(row["avg_weight_kg"]), 2),
            entries=row["entries"],
        )
        for row in rows
    ]


async def get_trend(
    db: AsyncSession, user_id: uuid.UUID, goal_weight_kg: float | None
) -> WeightTrend:
    row = (await db.execute(TREND_QUERY, {"user_id": user_id})).mappings().first()
    # regr_slope returns NULL with fewer than 2 distinct x values (i.e. fewer
    # than 2 logged dates) — nothing to fit a line to yet.
    if row is None or row["slope_kg_per_day"] is None:
        return WeightTrend(rate_kg_per_week=None, projected_goal_date=None, goal_weight_kg=goal_weight_kg)

    slope = float(row["slope_kg_per_day"])
    intercept = float(row["intercept_kg"])
    first_date: date = row["first_date"]

    projected_goal_date = None
    if goal_weight_kg is not None and slope != 0:
        days_to_goal = (goal_weight_kg - intercept) / slope
        candidate = first_date + timedelta(days=days_to_goal)
        # Only report a projection if it's a real future date — a goal
        # behind you (wrong direction, or slope ~0) has no honest ETA.
        if candidate >= date.today():
            projected_goal_date = candidate

    return WeightTrend(
        rate_kg_per_week=round(slope * 7, 3),
        projected_goal_date=projected_goal_date,
        goal_weight_kg=goal_weight_kg,
    )
