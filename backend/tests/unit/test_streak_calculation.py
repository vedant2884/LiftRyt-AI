"""Unit tests for the pure streak-math helpers in streaks_service.py —
no DB needed, since these operate on a plain set[date]. Integration
coverage (real Workout rows -> get_workout_streak/get_activity_calendar)
lives in tests/integration/test_activity_calendar.py.
"""

from datetime import date, timedelta

from app.services.streaks_service import _current_streak, _longest_streak


def _dates_ago(*days_ago: int, today: date) -> set[date]:
    return {today - timedelta(days=d) for d in days_ago}


def test_current_streak_workout_today_and_yesterday():
    today = date(2026, 8, 16)
    dates = _dates_ago(0, 1, 2, today=today)
    assert _current_streak(dates, today) == 3


def test_current_streak_no_workout_today_yet_does_not_reset():
    # Hasn't logged today yet, but logged yesterday/day before — streak is
    # still "alive," just not extended to today yet.
    today = date(2026, 8, 16)
    dates = _dates_ago(1, 2, 3, today=today)
    assert _current_streak(dates, today) == 3


def test_current_streak_broken_by_a_missed_day():
    # Mon/Tue/Wed workout, Thu missed, Fri workout — per the task's own
    # example, only Friday's fresh streak should count as "current."
    monday = date(2026, 8, 10)
    tuesday = monday + timedelta(days=1)
    wednesday = monday + timedelta(days=2)
    friday = monday + timedelta(days=4)
    dates = {monday, tuesday, wednesday, friday}
    assert _current_streak(dates, as_of := friday) == 1
    assert as_of == friday  # sanity: streak measured "as of" the last workout day


def test_current_streak_zero_when_gap_is_two_or_more_days():
    today = date(2026, 8, 16)
    dates = _dates_ago(3, 4, 5, today=today)  # nothing today or yesterday
    assert _current_streak(dates, today) == 0


def test_current_streak_spans_month_boundary():
    dates = {date(2026, 7, 30), date(2026, 7, 31), date(2026, 8, 1), date(2026, 8, 2)}
    assert _current_streak(dates, date(2026, 8, 2)) == 4


def test_current_streak_spans_year_boundary():
    dates = {date(2025, 12, 30), date(2025, 12, 31), date(2026, 1, 1), date(2026, 1, 2)}
    assert _current_streak(dates, date(2026, 1, 2)) == 4


def test_longest_streak_finds_the_best_run_not_just_the_latest():
    # A 3-day streak early on, then a gap, then a 2-day streak — longest
    # must report 3, even though it's not the most recent run.
    monday = date(2026, 8, 3)
    dates = {
        monday,
        monday + timedelta(days=1),
        monday + timedelta(days=2),
        monday + timedelta(days=10),
        monday + timedelta(days=11),
    }
    assert _longest_streak(dates) == 3


def test_longest_streak_with_no_workouts_is_zero():
    assert _longest_streak(set()) == 0


def test_longest_streak_all_isolated_days_is_one():
    dates = {date(2026, 8, 1), date(2026, 8, 5), date(2026, 8, 10)}
    assert _longest_streak(dates) == 1


def test_multiple_workouts_same_day_counts_as_one_streak_day():
    # get_workout_dates already de-dupes via SELECT DISTINCT, so the
    # streak math only ever sees each date once regardless of how many
    # workouts happened that day — modeled here directly as a set.
    today = date(2026, 8, 16)
    dates = {today, today - timedelta(days=1)}  # two workouts on `today` still one date
    assert _current_streak(dates, today) == 2
