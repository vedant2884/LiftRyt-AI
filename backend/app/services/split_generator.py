"""Rule-based workout split generator.

Not an LLM prompt — a deterministic decision procedure over the exercise
library, so results are reproducible and every pick carries an explicit
reason. This is what step 10's AI coach calls as a tool instead of
freehand-generating a split from nothing, and what lets it explain *why*
it suggested something rather than inventing a justification after the fact.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_exercise import CustomExercise
from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType, TrainingGoal
from app.models.exercise import Exercise
from app.models.favorite_exercise import FavoriteExercise

# Either source is a valid candidate for a generated split — see
# CustomExercise's docstring. They share every attribute this module reads
# (id, name, category, movement_type, difficulty, primary_muscles), so the
# selection algorithm below never needs to branch on which one it has.
ExerciseLike = Exercise | CustomExercise

DAY_LABELS: dict[str, str] = {
    "full_body": "Full Body",
    "upper": "Upper Body",
    "lower": "Lower Body",
    "push": "Push",
    "pull": "Pull",
    "legs": "Legs",
}

DAY_TYPE_CATEGORIES: dict[str, list[ExerciseCategory]] = {
    "full_body": [
        ExerciseCategory.PUSH,
        ExerciseCategory.PULL,
        ExerciseCategory.LEGS,
        ExerciseCategory.CORE,
    ],
    "upper": [ExerciseCategory.PUSH, ExerciseCategory.PULL],
    "lower": [ExerciseCategory.LEGS],
    "push": [ExerciseCategory.PUSH],
    "pull": [ExerciseCategory.PULL],
    "legs": [ExerciseCategory.LEGS],
}

EXERCISES_PER_DAY: dict[str, int] = {
    "full_body": 6,
    "upper": 5,
    "lower": 5,
    "push": 5,
    "pull": 5,
    "legs": 5,
}

# Sets / rep range / how compound-heavy each goal's selection should be.
GOAL_SETS: dict[TrainingGoal, int] = {
    TrainingGoal.STRENGTH: 4,
    TrainingGoal.HYPERTROPHY: 3,
    TrainingGoal.GENERAL_FITNESS: 3,
}
GOAL_REPS: dict[TrainingGoal, str] = {
    TrainingGoal.STRENGTH: "3-6",
    TrainingGoal.HYPERTROPHY: "8-12",
    TrainingGoal.GENERAL_FITNESS: "10-15",
}
GOAL_COMPOUND_RATIO: dict[TrainingGoal, float] = {
    TrainingGoal.STRENGTH: 0.8,
    TrainingGoal.HYPERTROPHY: 0.5,
    TrainingGoal.GENERAL_FITNESS: 0.4,
}

# Difficulties a given experience level may draw from — a beginner never
# sees an advanced lift; an advanced lifter can draw from the whole library.
ALLOWED_DIFFICULTY: dict[ExperienceLevel, list[ExperienceLevel]] = {
    ExperienceLevel.BEGINNER: [ExperienceLevel.BEGINNER],
    ExperienceLevel.INTERMEDIATE: [ExperienceLevel.BEGINNER, ExperienceLevel.INTERMEDIATE],
    ExperienceLevel.ADVANCED: [
        ExperienceLevel.BEGINNER,
        ExperienceLevel.INTERMEDIATE,
        ExperienceLevel.ADVANCED,
    ],
}


def _split_template(days_per_week: int, experience_level: ExperienceLevel) -> tuple[str, list[str]]:
    """Returns (split-type label, day-type sequence). Encodes real program
    design judgment, not just a lookup: a 3-day beginner benefits more from
    full-body frequency than from a low-frequency PPL split; an
    intermediate+ lifter can handle the focused per-session volume PPL asks for.
    """
    if days_per_week <= 2:
        return "Full Body", ["full_body"] * days_per_week
    if days_per_week == 3:
        if experience_level == ExperienceLevel.BEGINNER:
            return "Full Body", ["full_body", "full_body", "full_body"]
        return "Push/Pull/Legs", ["push", "pull", "legs"]
    if days_per_week == 4:
        return "Upper/Lower", ["upper", "lower", "upper", "lower"]
    if days_per_week == 5:
        return "Upper/Lower/Push/Pull/Legs", ["upper", "lower", "push", "pull", "legs"]
    return "Push/Pull/Legs", ["push", "pull", "legs", "push", "pull", "legs"]


def _allocate_counts(total: int, num_buckets: int) -> list[int]:
    """Splits `total` slots as evenly as possible across `num_buckets`."""
    base, remainder = divmod(total, num_buckets)
    return [base + (1 if i < remainder else 0) for i in range(num_buckets)]


def _round_half_up(x: float) -> int:
    """Python's builtin round() uses banker's rounding (round(0.5) == 0),
    which meant a category with a single slot at a 0.5 compound ratio
    always lost its compound slot to isolation — e.g. the one leg exercise
    on a full-body day defaulting to Glute Bridge instead of a squat
    variant. Round-half-up matches the intuitive "half a slot rounds up
    to compound" behavior instead.
    """
    return int(x + 0.5)


def _reason(exercise: ExerciseLike, goal: TrainingGoal) -> str:
    muscles = ", ".join(m.replace("_", " ") for m in exercise.primary_muscles)
    suffix = " (one of your custom exercises)" if isinstance(exercise, CustomExercise) else ""
    if exercise.movement_type == MovementType.COMPOUND:
        goal_label = goal.value.replace("_", " ")
        return f"Compound movement targeting {muscles}, prioritized for a {goal_label} goal.{suffix}"
    return f"Isolation movement adding targeted {muscles} volume.{suffix}"


@dataclass
class SplitExercisePick:
    exercise: ExerciseLike
    sets: int
    reps: str
    reason: str


@dataclass
class SplitDayPlan:
    day_number: int
    label: str
    exercises: list[SplitExercisePick]


@dataclass
class SplitPlan:
    split_type: str
    days: list[SplitDayPlan]


def _select_exercises(
    pool: list[ExerciseLike],
    count: int,
    compound_target: int,
    used_exercise_ids: set[uuid.UUID],
    favorite_ids: set[uuid.UUID],
) -> list[ExerciseLike]:
    """Prefers exercises not already used elsewhere in the split — falls
    back to repeats only if the unused pool can't cover the need. Within
    that, favorited exercises are preferred first (see the sort below):
    "prioritize favorites unless the user explicitly requests otherwise" —
    the AI coach's tool-calling path is exactly that override, since it can
    still ask for a specific goal/experience combination that steers the
    pool regardless of favorites.
    """

    def pick(candidates: list[ExerciseLike], n: int, already: list[ExerciseLike]) -> list[ExerciseLike]:
        unused = [e for e in candidates if e.id not in used_exercise_ids and e not in already]
        chosen = unused[:n]
        if len(chosen) < n:
            remaining = [e for e in candidates if e not in chosen and e not in already]
            chosen += remaining[: n - len(chosen)]
        return chosen

    # Stable sort: favorited exercises float to the front of the pool
    # (within their own compound/isolation bucket below), everything else
    # keeps its original relative order.
    ranked = sorted(pool, key=lambda e: e.id not in favorite_ids)

    compounds = [e for e in ranked if e.movement_type == MovementType.COMPOUND]
    isolations = [e for e in ranked if e.movement_type == MovementType.ISOLATION]

    chosen = pick(compounds, min(compound_target, count), [])
    chosen += pick(isolations, count - len(chosen), chosen)
    if len(chosen) < count:
        chosen += pick(ranked, count - len(chosen), chosen)
    return chosen


def _pick_for_category(
    pool: list[ExerciseLike],
    count: int,
    compound_ratio: float,
    used_exercise_ids: set[uuid.UUID],
    favorite_ids: set[uuid.UUID],
    sets: int,
    reps: str,
    goal: TrainingGoal,
) -> list[SplitExercisePick]:
    if count <= 0 or not pool:
        return []

    chosen = _select_exercises(
        pool, count, _round_half_up(count * compound_ratio), used_exercise_ids, favorite_ids
    )
    for exercise in chosen:
        used_exercise_ids.add(exercise.id)

    return [
        SplitExercisePick(exercise=exercise, sets=sets, reps=reps, reason=_reason(exercise, goal))
        for exercise in chosen
    ]


async def generate_split(
    db: AsyncSession,
    days_per_week: int,
    experience_level: ExperienceLevel,
    goal: TrainingGoal,
    user_id: uuid.UUID | None = None,
) -> SplitPlan:
    """user_id is optional so this function still works standalone (e.g.
    tests) without a real account — when given, the candidate pool also
    draws from that user's custom exercises, and their favorites (of either
    source) are preferred within each category. Both are genuinely used at
    generation time, not merged into the shared exercises table."""
    split_type, day_types = _split_template(days_per_week, experience_level)
    allowed_difficulties = ALLOWED_DIFFICULTY[experience_level]

    # Fetch every candidate once, grouped by category — the whole library
    # is small enough that this beats re-querying per day.
    candidates_by_category: dict[ExerciseCategory, list[ExerciseLike]] = {}
    for category in ExerciseCategory:
        rows = (
            await db.scalars(
                select(Exercise)
                .where(Exercise.category == category, Exercise.difficulty.in_(allowed_difficulties))
                .order_by(Exercise.name)
            )
        ).all()
        candidates_by_category[category] = list(rows)

    favorite_ids: set[uuid.UUID] = set()
    if user_id is not None:
        custom_rows = (
            await db.scalars(
                select(CustomExercise).where(
                    CustomExercise.user_id == user_id,
                    CustomExercise.difficulty.in_(allowed_difficulties),
                )
            )
        ).all()
        for custom_exercise in custom_rows:
            candidates_by_category.setdefault(custom_exercise.category, []).append(custom_exercise)

        favorites = (
            await db.scalars(select(FavoriteExercise).where(FavoriteExercise.user_id == user_id))
        ).all()
        for favorite in favorites:
            favorite_ids.add(favorite.exercise_id or favorite.custom_exercise_id)

    used_exercise_ids: set[uuid.UUID] = set()
    days: list[SplitDayPlan] = []

    for day_number, day_type in enumerate(day_types, start=1):
        categories = DAY_TYPE_CATEGORIES[day_type]
        counts = _allocate_counts(EXERCISES_PER_DAY[day_type], len(categories))
        compound_ratio = GOAL_COMPOUND_RATIO[goal]
        sets = GOAL_SETS[goal]
        reps = GOAL_REPS[goal]

        picks: list[SplitExercisePick] = []
        for category, count in zip(categories, counts):
            picks.extend(
                _pick_for_category(
                    candidates_by_category.get(category, []),
                    count,
                    compound_ratio,
                    used_exercise_ids,
                    favorite_ids,
                    sets,
                    reps,
                    goal,
                )
            )

        days.append(SplitDayPlan(day_number=day_number, label=DAY_LABELS[day_type], exercises=picks))

    return SplitPlan(split_type=split_type, days=days)
