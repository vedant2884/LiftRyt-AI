"""Integration tests for app/services/weight_analytics.py — these exercise
the actual raw SQL (window functions, GROUP BY date_trunc, regr_slope)
against a real Postgres, not mocked results. Mocking the query results
here would just test that Python calls a mock correctly, which proves
nothing about whether the SQL itself is right.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.weight_log import WeightLog
from app.services import weight_analytics


async def _seed_linear_trend(db: AsyncSession, user: User, days: int, slope_kg_per_day: float, start_weight: float):
    """Seeds a perfectly linear weight trend (no noise) so the regression
    result is exact and assertable, not just approximately plausible."""
    start = date.today() - timedelta(days=days - 1)
    for i in range(days):
        db.add(
            WeightLog(
                user_id=user.id,
                weight_kg=Decimal(str(round(start_weight + slope_kg_per_day * i, 2))),
                logged_at=start + timedelta(days=i),
            )
        )
    await db.commit()


async def test_trend_slope_matches_seeded_linear_data(db_session: AsyncSession, test_user: User):
    # Exactly -0.1 kg/day -> -0.7 kg/week, no noise to obscure the assertion.
    await _seed_linear_trend(db_session, test_user, days=8, slope_kg_per_day=-0.1, start_weight=80.0)

    trend = await weight_analytics.get_trend(db_session, test_user.id, goal_weight_kg=None)

    assert trend.rate_kg_per_week == pytest.approx(-0.7, abs=0.01)


async def test_trend_is_none_with_fewer_than_two_points(db_session: AsyncSession, test_user: User):
    db_session.add(WeightLog(user_id=test_user.id, weight_kg=Decimal("80.0"), logged_at=date.today()))
    await db_session.commit()

    trend = await weight_analytics.get_trend(db_session, test_user.id, goal_weight_kg=None)

    # regr_slope needs >= 2 distinct x values; one logged day has nothing to fit a line to.
    assert trend.rate_kg_per_week is None
    assert trend.projected_goal_date is None


async def test_goal_projection_is_none_when_trend_moves_away_from_goal(
    db_session: AsyncSession, test_user: User
):
    # Gaining weight while the goal is to lose it — no honest future date exists.
    await _seed_linear_trend(db_session, test_user, days=8, slope_kg_per_day=0.1, start_weight=80.0)

    trend = await weight_analytics.get_trend(db_session, test_user.id, goal_weight_kg=70.0)

    assert trend.projected_goal_date is None


async def test_moving_averages_first_point_equals_itself(db_session: AsyncSession, test_user: User):
    await _seed_linear_trend(db_session, test_user, days=5, slope_kg_per_day=-0.2, start_weight=90.0)

    series = await weight_analytics.get_weight_series(db_session, test_user.id)

    assert len(series) == 5
    # No prior days exist for the first point, so its moving average is just itself.
    assert series[0].moving_avg_7d == series[0].weight_kg
    assert series[0].moving_avg_30d == series[0].weight_kg


async def test_moving_average_of_all_points_when_window_covers_full_range(
    db_session: AsyncSession, test_user: User
):
    await _seed_linear_trend(db_session, test_user, days=5, slope_kg_per_day=-0.2, start_weight=90.0)

    series = await weight_analytics.get_weight_series(db_session, test_user.id)

    # 5 days all fall within a 30-day window, so the last point's 30-day
    # moving average is the mean of every logged weight.
    expected_mean = sum(float(p.weight_kg) for p in series) / len(series)
    assert series[-1].moving_avg_30d == pytest.approx(expected_mean, abs=0.01)


async def test_weekly_averages_group_by_calendar_week(db_session: AsyncSession, test_user: User):
    await _seed_linear_trend(db_session, test_user, days=10, slope_kg_per_day=0.0, start_weight=75.0)

    weekly = await weight_analytics.get_weekly_averages(db_session, test_user.id)

    assert sum(w.entries for w in weekly) == 10
    for w in weekly:
        assert w.avg_weight_kg == pytest.approx(75.0, abs=0.01)
