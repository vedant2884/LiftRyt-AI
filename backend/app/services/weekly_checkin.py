"""Auto-generated weekly check-in: weight trend + training volume in,
one LLM call out, producing a short recap and exactly one actionable
suggestion — the spec's "check in without being asked" differentiator.

Not a scheduled background job (this project has no task queue) — it's
triggered on demand from the coach page, but the content itself is the
same idea: a proactive summary instead of the user having to ask "how am
I doing this week?" themselves.
"""

from app.models.chat_message import ChatMessage
from app.models.enums import ChatRole
from app.models.user import User
from app.services import weight_analytics, workout_analytics
from app.services.llm.provider import LLMProviderError, get_llm_client, get_llm_model
from app.services.macro_target_service import resolve_weight_kg
from sqlalchemy.ext.asyncio import AsyncSession

CHECKIN_PROMPT_TEMPLATE = """Write a short weekly check-in (3-4 sentences, second person, direct and encouraging) for a gym app user based on this week's actual data:

{data}

End with exactly one specific, actionable suggestion grounded in the numbers above — not generic advice. If there isn't enough data for a data-grounded suggestion, say so plainly instead of inventing one."""


async def generate_weekly_checkin(db: AsyncSession, user: User) -> ChatMessage:
    data_lines: list[str] = []

    weight_kg = await resolve_weight_kg(db, user)
    if weight_kg is not None:
        goal_weight = float(user.goal_weight_kg) if user.goal_weight_kg is not None else None
        trend = await weight_analytics.get_trend(db, user.id, goal_weight)
        line = f"- Current weight: {weight_kg} kg."
        if trend.rate_kg_per_week is not None:
            line += f" Trending {trend.rate_kg_per_week:+.2f} kg/week."
        data_lines.append(line)
    else:
        data_lines.append("- No weight logged this week.")

    weekly_volume = await workout_analytics.get_weekly_volume(db, user.id)
    if weekly_volume:
        latest = weekly_volume[-1]
        data_lines.append(
            f"- This week's training volume: {latest.volume_kg:.0f} kg across {latest.workout_count} workout(s)."
        )
        if len(weekly_volume) > 1:
            previous = weekly_volume[-2]
            data_lines.append(f"- Previous week's volume: {previous.volume_kg:.0f} kg.")
    else:
        data_lines.append("- No workouts logged this week.")

    prompt = CHECKIN_PROMPT_TEMPLATE.format(data="\n".join(data_lines))

    client = get_llm_client()
    model = get_llm_model()
    try:
        response = await client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": prompt}]
        )
    except Exception as exc:
        raise LLMProviderError(f"LLM request failed: {exc}") from exc

    content = response.choices[0].message.content or ""

    message = ChatMessage(
        user_id=user.id,
        role=ChatRole.ASSISTANT,
        content=content,
        tool_name="weekly_checkin",
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message
