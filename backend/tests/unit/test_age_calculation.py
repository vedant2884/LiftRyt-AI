from datetime import date

import pytest

from app.services.age_calculation import calculate_age, validate_date_of_birth


def test_age_before_birthday_this_year():
    # Born Aug 28 2004; "today" is Aug 16 2026 — birthday hasn't happened yet.
    assert calculate_age(date(2004, 8, 28), as_of=date(2026, 8, 16)) == 21


def test_age_after_birthday_this_year():
    assert calculate_age(date(2004, 8, 28), as_of=date(2026, 9, 1)) == 22


def test_age_on_birthday_today():
    assert calculate_age(date(2004, 8, 28), as_of=date(2026, 8, 28)) == 22


def test_leap_year_birthday_on_non_leap_current_year():
    # Born Feb 29 2000 (leap year). 2026 isn't a leap year — Feb 29 doesn't
    # exist, so "had the birthday" should only become true once Mar 1 passes.
    assert calculate_age(date(2000, 2, 29), as_of=date(2026, 2, 28)) == 25
    assert calculate_age(date(2000, 2, 29), as_of=date(2026, 3, 1)) == 26


def test_leap_year_birthday_on_leap_current_year():
    assert calculate_age(date(2000, 2, 29), as_of=date(2028, 2, 29)) == 28


def test_naive_year_subtraction_would_be_wrong():
    # Regression guard for the exact bug the task calls out: currentYear -
    # birthYear alone overstates age before the birthday.
    dob = date(2004, 8, 28)
    today = date(2026, 8, 16)
    naive = today.year - dob.year
    assert calculate_age(dob, as_of=today) == naive - 1


def test_validate_rejects_future_date():
    with pytest.raises(ValueError, match="future"):
        validate_date_of_birth(date(2027, 1, 1), as_of=date(2026, 8, 16))


def test_validate_rejects_unreasonable_age():
    with pytest.raises(ValueError, match="over"):
        validate_date_of_birth(date(1850, 1, 1), as_of=date(2026, 8, 16))


def test_validate_accepts_reasonable_dob():
    validate_date_of_birth(date(2004, 8, 28), as_of=date(2026, 8, 16))


def test_validate_accepts_today_as_dob():
    # A newborn is a valid (if unlikely) signup edge case — not the
    # validator's job to enforce a minimum account-holder age.
    validate_date_of_birth(date(2026, 8, 16), as_of=date(2026, 8, 16))
