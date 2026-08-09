"""Assembles the context block injected into the AI coach's system prompt:
recent weight trend, PRs, training volume, active macro target, exercises
semantically relevant to the user's specific message, and a handful of
relevant older chat messages pulled from past sessions.

This is step 9's RAG pipeline applied: retrieval happens here, in code,
before the LLM ever sees the message — not something the model is asked to
"remember" or infer on its own.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.macro_target import MacroTarget
from app.models.user import User
from app.services import chat_memory, exercise_retrieval, weight_analytics, workout_analytics
from app.services.macro_target_service import resolve_weight_kg

RELEVANT_EXERCISE_COUNT = 5
RECENT_PR_COUNT = 5


async def build_context(
    db: AsyncSession, user: User, session_id: uuid.UUID, user_message: str
) -> str:
    sections: list[str] = []

    weight_kg = await resolve_weight_kg(db, user)
    if weight_kg is not None:
        goal_weight = float(user.goal_weight_kg) if user.goal_weight_kg is not None else None
        trend = await weight_analytics.get_trend(db, user.id, goal_weight)
        line = f"Current weight: {weight_kg} kg."
        if trend.rate_kg_per_week is not None:
            line += f" Trending {trend.rate_kg_per_week:+.2f} kg/week."
        if trend.projected_goal_date is not None:
            line += f" Projected to reach goal weight ({trend.goal_weight_kg} kg) by {trend.projected_goal_date}."
        sections.append(line)
    else:
        sections.append("No weight logged yet.")

    prs = await workout_analytics.get_personal_records(db, user.id)
    if prs:
        pr_text = ", ".join(f"{pr.exercise_name} {pr.weight_kg}kg x{pr.reps}" for pr in prs[:RECENT_PR_COUNT])
        sections.append(f"Current PRs: {pr_text}.")

    weekly_volume = await workout_analytics.get_weekly_volume(db, user.id)
    if weekly_volume:
        latest = weekly_volume[-1]
        sections.append(
            f"This week's training volume: {latest.volume_kg:.0f} kg across {latest.workout_count} workout(s)."
        )

    active_target = await db.scalar(
        select(MacroTarget).where(MacroTarget.user_id == user.id, MacroTarget.is_active.is_(True))
    )
    if active_target is not None:
        sections.append(
            f"Active macro target ({active_target.goal.value}): {active_target.target_calories} kcal, "
            f"{active_target.target_protein_g}g protein, {active_target.target_carbs_g}g carbs, "
            f"{active_target.target_fat_g}g fat."
        )

    try:
        relevant_exercises = await exercise_retrieval.semantic_search_exercises(
            db, user_message, limit=RELEVANT_EXERCISE_COUNT
        )
    except Exception:
        # Semantic search is an enhancement to the context, not a
        # requirement — e.g. a transient embedding-model hiccup shouldn't
        # take down the whole chat turn when the rest of the context
        # (weight, PRs, volume, macros) is still perfectly usable.
        relevant_exercises = []

    if relevant_exercises:
        ex_text = "; ".join(
            f"{ex.name} ({ex.category.value}, targets {', '.join(ex.primary_muscles)})"
            for ex in relevant_exercises
        )
        sections.append(f"Exercises from the database relevant to this message: {ex_text}.")

    try:
        relevant_memories = await chat_memory.find_relevant_past_messages(
            db, user.id, session_id, user_message
        )
    except Exception:
        # Same reasoning as the exercise search above: an enhancement, not
        # something that should take down the whole turn if it fails.
        relevant_memories = []

    if relevant_memories:
        memory_text = " / ".join(
            f'{"You" if m.role.value == "assistant" else "User"} on {m.created_at.date()}: "{m.content}"'
            for m in relevant_memories
        )
        sections.append(f"Relevant messages from earlier conversations: {memory_text}")

    return "\n".join(f"- {line}" for line in sections)
