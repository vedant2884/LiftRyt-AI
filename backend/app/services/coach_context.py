"""Assembles the context block injected into the AI coach's system prompt:
recent weight trend, PRs, training volume, active macro target, exercises
semantically relevant to the user's specific message, and a handful of
relevant older chat messages pulled from past sessions.

This is step 9's RAG pipeline applied: retrieval happens here, in code,
before the LLM ever sees the message — not something the model is asked to
"remember" or infer on its own.

Each lookup below is independent of every other (none reads a value another
one produced) but they used to run one `await` at a time on a single shared
AsyncSession — which is safe but serial, since one AsyncSession can only
have one query in flight at a time. Real concurrency needs each branch on
its own session (all reads, all against data written well before this
request started, so there's no consistency reason they need to share one),
run together via asyncio.gather. This was the single biggest chunk of the
coach's time-to-first-token before the OpenRouter call even started.

The sibling sessions are built from db.get_bind() — the same engine the
caller's own `db` session already uses — rather than importing
app.db.session's engine directly. That matters for two reasons: it
correctly targets whatever engine a test's dependency override points at
(tests run against a separate liftryt_test database via a separate
engine), and it avoids asyncpg's "attached to a different loop" error that
importing a module-level engine created under a different event loop
would hit under pytest-asyncio's per-test event loops.
"""

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.models.macro_target import MacroTarget
from app.models.user import User
from app.services import chat_memory, exercise_retrieval, weight_analytics, workout_analytics
from app.services.macro_target_service import resolve_weight_kg

RELEVANT_EXERCISE_COUNT = 5
RECENT_PR_COUNT = 5

SessionFactory = async_sessionmaker[AsyncSession]


async def _weight_context(session_factory: SessionFactory, user: User) -> str:
    async with session_factory() as db:
        weight_kg = await resolve_weight_kg(db, user)
        if weight_kg is None:
            return "No weight logged yet."
        goal_weight = float(user.goal_weight_kg) if user.goal_weight_kg is not None else None
        trend = await weight_analytics.get_trend(db, user.id, goal_weight)
    line = f"Current weight: {weight_kg} kg."
    if trend.rate_kg_per_week is not None:
        line += f" Trending {trend.rate_kg_per_week:+.2f} kg/week."
    if trend.projected_goal_date is not None:
        line += f" Projected to reach goal weight ({trend.goal_weight_kg} kg) by {trend.projected_goal_date}."
    return line


async def _pr_context(session_factory: SessionFactory, user: User) -> str | None:
    async with session_factory() as db:
        prs = await workout_analytics.get_personal_records(db, user.id)
    if not prs:
        return None
    pr_text = ", ".join(f"{pr.exercise_name} {pr.weight_kg}kg x{pr.reps}" for pr in prs[:RECENT_PR_COUNT])
    return f"Current PRs: {pr_text}."


async def _volume_context(session_factory: SessionFactory, user: User) -> str | None:
    async with session_factory() as db:
        weekly_volume = await workout_analytics.get_weekly_volume(db, user.id)
    if not weekly_volume:
        return None
    latest = weekly_volume[-1]
    return f"This week's training volume: {latest.volume_kg:.0f} kg across {latest.workout_count} workout(s)."


async def _macro_context(session_factory: SessionFactory, user: User) -> str | None:
    async with session_factory() as db:
        active_target = await db.scalar(
            select(MacroTarget).where(MacroTarget.user_id == user.id, MacroTarget.is_active.is_(True))
        )
    if active_target is None:
        return None
    return (
        f"Active macro target ({active_target.goal.value}): {active_target.target_calories} kcal, "
        f"{active_target.target_protein_g}g protein, {active_target.target_carbs_g}g carbs, "
        f"{active_target.target_fat_g}g fat."
    )


async def _exercise_context(session_factory: SessionFactory, user_message: str) -> str | None:
    try:
        async with session_factory() as db:
            relevant_exercises = await exercise_retrieval.semantic_search_exercises(
                db, user_message, limit=RELEVANT_EXERCISE_COUNT
            )
    except Exception:
        # Semantic search is an enhancement to the context, not a
        # requirement — e.g. a transient embedding-model hiccup shouldn't
        # take down the whole chat turn when the rest of the context
        # (weight, PRs, volume, macros) is still perfectly usable.
        return None
    if not relevant_exercises:
        return None
    ex_text = "; ".join(
        f"{ex.name} ({ex.category.value}, targets {', '.join(ex.primary_muscles)})" for ex in relevant_exercises
    )
    return f"Exercises from the database relevant to this message: {ex_text}."


async def _memory_context(
    session_factory: SessionFactory, user: User, session_id: uuid.UUID, user_message: str
) -> str | None:
    try:
        async with session_factory() as db:
            relevant_memories = await chat_memory.find_relevant_past_messages(
                db, user.id, session_id, user_message
            )
    except Exception:
        # Same reasoning as the exercise search above: an enhancement, not
        # something that should take down the whole turn if it fails.
        return None
    if not relevant_memories:
        return None
    memory_text = " / ".join(
        f'{"You" if m.role.value == "assistant" else "User"} on {m.created_at.date()}: "{m.content}"'
        for m in relevant_memories
    )
    return f"Relevant messages from earlier conversations: {memory_text}"


async def build_context(db: AsyncSession, user: User, session_id: uuid.UUID, user_message: str) -> str:
    # get_bind() returns the sync-facing proxy AsyncSession wraps internally
    # (SQLAlchemy's async support is implemented on top of the sync core),
    # not a usable AsyncEngine on its own — re-wrapping it is the
    # documented way to get a real AsyncEngine back for building more
    # sessions against the same underlying engine/pool.
    session_factory = async_sessionmaker(AsyncEngine(db.get_bind()), expire_on_commit=False)
    sections = await asyncio.gather(
        _weight_context(session_factory, user),
        _pr_context(session_factory, user),
        _volume_context(session_factory, user),
        _macro_context(session_factory, user),
        _exercise_context(session_factory, user_message),
        _memory_context(session_factory, user, session_id, user_message),
    )
    return "\n".join(f"- {line}" for line in sections if line)
