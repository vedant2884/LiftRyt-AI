"""Builds the AI Recommendations page's cards.

Every card here is derived from real data (the active split, its
completion history, weight trend) the same way the rest of this app's "AI"
features work: retrieval and rule-based logic in code, with semantic search
(exercise_retrieval.py, already backed by the exercise embeddings) used
only to *find* relevant exercises, never to invent claims about the user's
own training. Recommendations naturally improve as more data exists
(splits get generated, days get marked complete) since every card here
reads from that same growing history.

Injury-specific alternatives are deliberately NOT a card type here: "is
this safe given my shoulder pain" needs conversational back-and-forth, not
a static suggestion — see the "Ask the coach" card, which hands off to the
AI Coach chat instead of guessing.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
from app.models.generated_split import GeneratedSplit
from app.models.user import User
from app.schemas.exercise import ExerciseOut
from app.schemas.recommendations import RecommendationCard
from app.services import exercise_retrieval, split_service
from app.services.streaks_service import get_weekly_adherence

# Major muscle groups a well-rounded split should hit, using this app's own
# seeded vocabulary (see app/db/seed_data/exercises.py) rather than an
# invented taxonomy that might not match real primary_muscles values.
MAJOR_MUSCLE_GROUPS = [
    "chest", "lats", "upper_back", "front_delts", "side_delts", "rear_delts",
    "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "abs",
]

VARIATION_SAMPLE_SIZE = 2
GOAL_BASED_SUGGESTIONS = 3


async def build_recommendations(db: AsyncSession, user: User) -> list[RecommendationCard]:
    split = await split_service.get_active_split(db, user.id)

    if split is None:
        return [
            RecommendationCard(
                type="goal_based",
                title="Generate a split to unlock recommendations",
                description=(
                    "Recommendations here are built from your active split and how consistently "
                    "you complete it, so there's nothing to analyze until you have one."
                ),
                action_label="Generate a split",
                action_href="/splits",
            )
        ]

    cards: list[RecommendationCard] = []
    plan_exercises = [ex for day in split.plan["days"] for ex in day["exercises"]]
    covered_muscles = {m for ex in plan_exercises for m in ex.get("primary_muscles", [])}
    used_exercise_ids = {uuid.UUID(ex["exercise_id"]) for ex in plan_exercises if not ex.get("is_custom")}

    missing_card = await _missing_muscle_groups_card(db, covered_muscles, used_exercise_ids)
    if missing_card is not None:
        cards.append(missing_card)

    cards.append(await _variation_card(db, plan_exercises, used_exercise_ids))
    cards.append(await _adherence_card(db, user))
    cards.append(_progression_card(split))
    cards.append(await _goal_based_card(db, user, split, used_exercise_ids))
    cards.append(_ask_coach_card())

    return [card for card in cards if card is not None]


async def _missing_muscle_groups_card(
    db: AsyncSession, covered_muscles: set[str], exclude_ids: set[uuid.UUID]
) -> RecommendationCard | None:
    missing = [m for m in MAJOR_MUSCLE_GROUPS if m not in covered_muscles]
    if not missing:
        return None

    # A handful of missing groups is normal (most splits target a subset per
    # day) — only flag it as a real gap once several major groups are
    # untouched by the split as a whole.
    if len(missing) <= 2:
        return None

    suggestions: list[Exercise] = []
    for muscle in missing[:3]:
        results = await exercise_retrieval.semantic_search_exercises(
            db, f"{muscle.replace('_', ' ')} exercise", limit=3
        )
        for exercise in results:
            if exercise.id not in exclude_ids and exercise not in suggestions:
                suggestions.append(exercise)
                break

    readable = ", ".join(m.replace("_", " ") for m in missing)
    return RecommendationCard(
        type="missing_muscle_group",
        title="A few muscle groups aren't in your current split",
        description=f"Your active split doesn't train: {readable}. Consider working these in.",
        exercises=[ExerciseOut.model_validate(e) for e in suggestions],
    )


async def _variation_card(
    db: AsyncSession, plan_exercises: list[dict], exclude_ids: set[uuid.UUID]
) -> RecommendationCard:
    sample = plan_exercises[:VARIATION_SAMPLE_SIZE]
    suggestions: list[Exercise] = []
    for ex in sample:
        results = await exercise_retrieval.semantic_search_exercises(db, f"alternative to {ex['name']}", limit=4)
        for exercise in results:
            if exercise.id not in exclude_ids and exercise not in suggestions:
                suggestions.append(exercise)
                break

    return RecommendationCard(
        type="variation",
        title="Exercise variations to keep things fresh",
        description="Swapping in a variation for a familiar movement keeps the stimulus new without changing your split's structure.",
        exercises=[ExerciseOut.model_validate(e) for e in suggestions],
    )


async def _adherence_card(db: AsyncSession, user: User) -> RecommendationCard:
    adherence = await get_weekly_adherence(db, user)
    if adherence is None or adherence.planned == 0:
        return RecommendationCard(
            type="adherence",
            title="Not enough data yet",
            description="Mark a few planned days complete on the Splits page and this card will reflect your actual adherence.",
        )

    rate = adherence.completed / adherence.planned
    if rate >= 0.75:
        description = (
            f"You've completed {adherence.completed}/{adherence.planned} planned workouts this week. "
            "That's strong consistency, this is a good week to consider a slightly harder split next time you regenerate."
        )
    elif rate >= 0.4:
        description = (
            f"You've completed {adherence.completed}/{adherence.planned} planned workouts this week. "
            "Steady, but there's room to close the gap. A shorter or lower-frequency split might fit your week better."
        )
    else:
        description = (
            f"You've completed {adherence.completed}/{adherence.planned} planned workouts this week. "
            "Consistency matters more than intensity right now, consider fewer days per week so it's easier to hit all of them."
        )

    return RecommendationCard(type="adherence", title="This week's adherence", description=description)


def _progression_card(split: GeneratedSplit) -> RecommendationCard:
    age_days = (datetime.now(timezone.utc) - split.created_at).days
    if age_days < 21:
        description = (
            f"Your current split has been active for {age_days} days. Give it a few more weeks before "
            "changing anything, consistency on the same plan is what drives early progress."
        )
    else:
        weeks = age_days // 7
        description = (
            f"Your current split has been active for about {weeks} weeks. If the planned sets and reps "
            "feel easy now, consider regenerating with a higher experience level or a strength-focused goal "
            "for a harder rep range."
        )
    return RecommendationCard(type="progression", title="Progressive overload", description=description)


async def _goal_based_card(
    db: AsyncSession, user: User, split: GeneratedSplit, exclude_ids: set[uuid.UUID]
) -> RecommendationCard:
    query = f"{split.experience_level.value} {split.goal.value.replace('_', ' ')} exercise"
    results = await exercise_retrieval.semantic_search_exercises(db, query, limit=GOAL_BASED_SUGGESTIONS + 3)
    suggestions = [e for e in results if e.id not in exclude_ids][:GOAL_BASED_SUGGESTIONS]

    goal_label = split.goal.value.replace("_", " ")
    return RecommendationCard(
        type="goal_based",
        title="New exercises worth trying",
        description=f"Based on your {goal_label} goal and {split.experience_level.value} experience level, and not already in your split.",
        exercises=[ExerciseOut.model_validate(e) for e in suggestions],
    )


def _ask_coach_card() -> RecommendationCard:
    return RecommendationCard(
        type="goal_based",
        title="Dealing with an injury or a specific limitation?",
        description="Exercise substitutions for pain or injury need context a static list can't give you safely, ask the coach directly and it'll ground its answer in your real training data.",
        action_label="Ask the coach",
        action_href="/coach",
    )
