"""Unit tests for app/services/macro_calculator.py — pure functions, no DB,
by design (see the module docstring from step 7), so these run without any
fixtures at all.

Expected values below aren't invented for the test — they're the exact
numbers verified by hand against the running API in step 7 (curl output),
so this doubles as a regression check against that already-confirmed-correct
behavior, including the safety-floor edge case.
"""

import pytest

from app.models.enums import ActivityLevel, MacroGoal, Sex
from app.services.macro_calculator import calculate_bmr, calculate_macros


def test_bmr_male_uses_plus_five_constant():
    # 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    assert calculate_bmr(Sex.MALE, age=30, height_cm=180, weight_kg=80) == 1780.0


def test_bmr_female_uses_minus_161_constant():
    # 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    assert calculate_bmr(Sex.FEMALE, age=25, height_cm=165, weight_kg=60) == 1345.25


def test_bmr_other_averages_male_and_female_constants():
    base = 10 * 70 + 6.25 * 170 - 5 * 28
    other = calculate_bmr(Sex.OTHER, age=28, height_cm=170, weight_kg=70)
    assert other == base + (5 + -161) / 2


def test_macros_male_cut():
    result = calculate_macros(Sex.MALE, 30, 180, 80, ActivityLevel.MODERATE, MacroGoal.CUT)
    assert result.bmr == 1780.0
    assert result.tdee == 2759.0
    assert result.target_calories == 2259.0  # tdee - 500, well above the 1.2x BMR floor
    assert result.target_protein_g == 176.0  # 2.2 g/kg (cut) * 80kg
    assert result.target_carbs_g == 247.6
    assert result.target_fat_g == 62.8


def test_macros_male_bulk():
    result = calculate_macros(Sex.MALE, 30, 180, 80, ActivityLevel.MODERATE, MacroGoal.BULK)
    assert result.target_calories == 3059.0  # tdee + 300
    assert result.target_protein_g == 144.0  # 1.8 g/kg (bulk) * 80kg
    assert result.target_carbs_g == 429.6
    assert result.target_fat_g == 85.0


def test_cut_never_drops_below_1_2x_bmr_floor():
    """A sedentary, low-BMR case where the naive TDEE-500 deficit would
    undershoot 1.2x BMR — the floor should win, clamping the target up
    rather than recommending the crash-diet-level deficit. This is the
    exact edge case that surfaced during step 7's manual testing."""
    result = calculate_macros(Sex.FEMALE, 25, 165, 60, ActivityLevel.SEDENTARY, MacroGoal.CUT)
    naive_deficit_target = result.tdee - 500
    # result.bmr is already rounded to 1 decimal; the real floor was computed
    # from the unrounded intermediate value, so compare with a tolerance
    # wide enough to absorb that double-rounding rather than the exact
    # (and therefore flaky) rounded-bmr recomputation.
    floor = result.bmr * 1.2

    assert naive_deficit_target < floor  # confirms this case actually exercises the floor
    assert result.target_calories == pytest.approx(floor, abs=0.1)
    assert result.target_calories == result.tdee  # sedentary multiplier == floor multiplier here


def test_protein_scales_with_bodyweight_not_just_goal():
    lighter = calculate_macros(Sex.MALE, 30, 180, 70, ActivityLevel.MODERATE, MacroGoal.MAINTAIN)
    heavier = calculate_macros(Sex.MALE, 30, 180, 90, ActivityLevel.MODERATE, MacroGoal.MAINTAIN)
    assert heavier.target_protein_g > lighter.target_protein_g


def test_maintain_goal_targets_tdee_exactly():
    result = calculate_macros(Sex.MALE, 30, 180, 80, ActivityLevel.MODERATE, MacroGoal.MAINTAIN)
    assert result.target_calories == result.tdee
