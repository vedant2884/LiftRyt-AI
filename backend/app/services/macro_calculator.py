"""Macro & calorie targets: Mifflin-St Jeor BMR, activity-multiplier TDEE,
a goal-based calorie target, and an evidence-based macro split.

Pure functions, no DB access — this is deliberate. It means the math is
directly unit-testable without mocking a session, and it's the same
function both this router and the AI coach's tool call (step 10) use, so
the coach references real computed numbers instead of re-deriving or
hallucinating them.
"""

from dataclasses import dataclass

from app.models.enums import ActivityLevel, MacroGoal, Sex

ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    ActivityLevel.SEDENTARY: 1.2,
    ActivityLevel.LIGHT: 1.375,
    ActivityLevel.MODERATE: 1.55,
    ActivityLevel.ACTIVE: 1.725,
    ActivityLevel.VERY_ACTIVE: 1.9,
}

# ~0.45 kg/week deficit for a cut, a conservative surplus for a bulk —
# standard, non-aggressive defaults rather than crash-diet numbers.
CUT_CALORIE_ADJUSTMENT = -500
BULK_CALORIE_ADJUSTMENT = 300

# A cut is never pushed below 1.2x BMR, regardless of how large the TDEE
# deficit would otherwise be — guards against recommending an unrealistic
# or unsafe deficit for someone with a naturally low BMR.
MIN_CUT_MULTIPLIER = 1.2

PROTEIN_G_PER_KG: dict[MacroGoal, float] = {
    MacroGoal.CUT: 2.2,  # higher protein in a deficit helps preserve lean mass
    MacroGoal.MAINTAIN: 1.8,
    MacroGoal.BULK: 1.8,
}
FAT_PERCENT_OF_CALORIES = 0.25

PROTEIN_KCAL_PER_G = 4
CARB_KCAL_PER_G = 4
FAT_KCAL_PER_G = 9


@dataclass
class MacroResult:
    bmr: float
    tdee: float
    target_calories: float
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float


def calculate_bmr(sex: Sex, age: int, height_cm: float, weight_kg: float) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if sex == Sex.MALE:
        return base + 5
    if sex == Sex.FEMALE:
        return base - 161
    # Mifflin-St Jeor has no validated third term for this case; averaging
    # the male (+5) and female (-161) constants is the standard practical
    # compromise most calculators use here.
    return base + (5 + -161) / 2


def calculate_macros(
    sex: Sex,
    age: int,
    height_cm: float,
    weight_kg: float,
    activity_level: ActivityLevel,
    goal: MacroGoal,
) -> MacroResult:
    bmr = calculate_bmr(sex, age, height_cm, weight_kg)
    tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level]

    if goal == MacroGoal.CUT:
        target_calories = max(tdee + CUT_CALORIE_ADJUSTMENT, bmr * MIN_CUT_MULTIPLIER)
    elif goal == MacroGoal.BULK:
        target_calories = tdee + BULK_CALORIE_ADJUSTMENT
    else:
        target_calories = tdee

    protein_g = PROTEIN_G_PER_KG[goal] * weight_kg
    protein_kcal = protein_g * PROTEIN_KCAL_PER_G

    fat_kcal = FAT_PERCENT_OF_CALORIES * target_calories
    fat_g = fat_kcal / FAT_KCAL_PER_G

    carb_kcal = max(target_calories - protein_kcal - fat_kcal, 0)
    carb_g = carb_kcal / CARB_KCAL_PER_G

    return MacroResult(
        bmr=round(bmr, 1),
        tdee=round(tdee, 1),
        target_calories=round(target_calories, 1),
        target_protein_g=round(protein_g, 1),
        target_carbs_g=round(carb_g, 1),
        target_fat_g=round(fat_g, 1),
    )
