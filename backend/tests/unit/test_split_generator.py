"""Unit tests for the pure helpers in app/services/split_generator.py —
the split-type decision table and the allocation/rounding math, none of
which touch the database (the exercise-selection logic that does is
covered separately, if at all, by integration tests — these are about the
program-design rules themselves).
"""

from app.models.enums import ExperienceLevel
from app.services.split_generator import _allocate_counts, _round_half_up, _split_template


def test_one_or_two_days_is_full_body():
    assert _split_template(1, ExperienceLevel.BEGINNER) == ("Full Body", ["full_body"])
    assert _split_template(2, ExperienceLevel.ADVANCED) == ("Full Body", ["full_body", "full_body"])


def test_three_days_beginner_is_full_body_not_ppl():
    split_type, days = _split_template(3, ExperienceLevel.BEGINNER)
    assert split_type == "Full Body"
    assert days == ["full_body", "full_body", "full_body"]


def test_three_days_intermediate_or_advanced_is_ppl():
    for level in (ExperienceLevel.INTERMEDIATE, ExperienceLevel.ADVANCED):
        split_type, days = _split_template(3, level)
        assert split_type == "Push/Pull/Legs"
        assert days == ["push", "pull", "legs"]


def test_four_days_is_upper_lower_x2():
    split_type, days = _split_template(4, ExperienceLevel.INTERMEDIATE)
    assert split_type == "Upper/Lower"
    assert days == ["upper", "lower", "upper", "lower"]


def test_five_days_is_hybrid():
    split_type, days = _split_template(5, ExperienceLevel.ADVANCED)
    assert split_type == "Upper/Lower/Push/Pull/Legs"
    assert days == ["upper", "lower", "push", "pull", "legs"]


def test_six_days_is_ppl_x2():
    split_type, days = _split_template(6, ExperienceLevel.ADVANCED)
    assert split_type == "Push/Pull/Legs"
    assert days == ["push", "pull", "legs", "push", "pull", "legs"]


def test_allocate_counts_divides_evenly():
    assert _allocate_counts(6, 3) == [2, 2, 2]


def test_allocate_counts_distributes_remainder_to_earlier_buckets():
    # 6 slots / 4 categories: base 1 each, 2 remainder -> first two get +1.
    assert _allocate_counts(6, 4) == [2, 2, 1, 1]


def test_round_half_up_fixes_the_banker_rounding_bug():
    """Python's builtin round() would give round(0.5) == 0 here, which was
    the actual bug found in step 8: a category with exactly one slot at a
    0.5 compound ratio always lost its compound pick to isolation (the
    sole leg exercise on a full-body day defaulted to an isolation move
    instead of a squat variant). This is the fix, tested directly."""
    assert _round_half_up(0.5) == 1
    assert round(0.5) == 0  # documents the stdlib behavior this works around


def test_round_half_up_matches_normal_rounding_off_the_boundary():
    assert _round_half_up(0.4) == 0
    assert _round_half_up(0.6) == 1
    assert _round_half_up(2.5) == 3
