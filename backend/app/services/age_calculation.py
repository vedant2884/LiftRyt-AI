"""Reusable date-of-birth -> age calculation, plus DOB input validation.

Kept as one small, independently testable module rather than inlined in the
signup/profile-update schemas, since "age off by one before/after the
birthday" and "leap-year DOB" are exactly the kind of bug that's easy to
introduce again in a second call site if this isn't centralized.
"""

from datetime import date

MIN_REASONABLE_AGE = 13
MAX_REASONABLE_AGE = 120


def calculate_age(date_of_birth: date, as_of: date | None = None) -> int:
    """Age in whole years as of `as_of` (defaults to today). Correctly
    accounts for whether the birthday has already occurred this year —
    `as_of.year - date_of_birth.year` alone is wrong for any date before
    the birthday. Handles a Feb 29 birthday on a non-leap current year by
    comparing the (month, day) tuple, which naturally treats "not yet
    reached Feb 29" as "not yet had a birthday this year" until Mar 1."""
    as_of = as_of or date.today()
    had_birthday_this_year = (as_of.month, as_of.day) >= (date_of_birth.month, date_of_birth.day)
    age = as_of.year - date_of_birth.year
    if not had_birthday_this_year:
        age -= 1
    return age


def validate_date_of_birth(date_of_birth: date, as_of: date | None = None) -> None:
    """Raises ValueError with a user-facing message for an obviously
    invalid DOB. Deliberately doesn't hardcode a strict business-rule
    minimum age beyond MIN_REASONABLE_AGE — that's enforced by the caller
    (e.g. signup requiring 13+) if/where it actually matters; this just
    rejects dates that can't be real."""
    as_of = as_of or date.today()
    if date_of_birth > as_of:
        raise ValueError("Date of birth can't be in the future.")
    age = calculate_age(date_of_birth, as_of)
    if age > MAX_REASONABLE_AGE:
        raise ValueError(f"That date of birth implies an age over {MAX_REASONABLE_AGE}.")
