"""The AI coach's agent loop:

  user message -> retrieve context (RAG) -> decide if a tool call is
  needed -> call tool -> final LLM response

Deliberately structured as real Python control flow, not one giant prompt
asking the model to orchestrate itself. The model only ever does two
things: decide which tool (if any) to call, and write the final
natural-language reply. Context retrieval, tool execution, and persistence
are all ordinary code, testable independently of any LLM call.
"""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage
from app.models.enums import ChatRole
from app.models.user import User
from app.services.agent_tools import TOOL_DEFINITIONS, execute_tool
from app.services.coach_context import build_context
from app.services.llm.provider import LLMProviderError, get_llm_client, get_llm_model

# How many recent turns of conversation ride along as context. Kept small —
# this is a chat-completions API with no prompt caching across turns, so
# every message here is repaid in tokens on every single request.
HISTORY_LIMIT = 12

SYSTEM_PROMPT_TEMPLATE = """You are LiftRyt AI's gym coach: direct, encouraging, and grounded in the user's real training data. Never invent a workout split or estimate calorie/macro numbers yourself when a tool exists to compute them correctly.

User profile: {age}yo {sex}, {height_cm}cm, {training_experience} lifter, activity level {activity_level}, goal weight {goal_weight_kg}.

Current context (retrieved from their logged data):
{context}

Rules:
- If asked for a workout split, program, or routine, call generate_workout_split — never write one freehand.
- If asked to set or recalculate calorie/macro targets (or explicitly about cutting/bulking), call calculate_macros — never estimate these yourself.
- Don't call calculate_macros just to answer a general progress or weight-trend question — the current context above already has their active target and weight trend; only call it when they actually want a new target calculated.
- When you use a tool's output, briefly explain *why* using the reasons it returns — the user should understand the logic, not just get a list of numbers or exercises.
- Keep answers focused and practical. This is a coach, not an encyclopedia."""


async def run_agent(db: AsyncSession, user: User, user_message: str) -> ChatMessage:
    # Fetch history *before* persisting this turn's user message, so it
    # isn't duplicated when appended to the outgoing messages list below.
    history = await _recent_history(db, user)

    user_msg = ChatMessage(user_id=user.id, role=ChatRole.USER, content=user_message)
    db.add(user_msg)
    await db.commit()

    context = await build_context(db, user, user_message)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        age=user.age,
        sex=user.sex.value,
        height_cm=user.height_cm,
        training_experience=user.training_experience.value,
        activity_level=user.activity_level.value,
        goal_weight_kg=user.goal_weight_kg if user.goal_weight_kg is not None else "not set",
        context=context,
    )

    messages: list[dict] = (
        [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_message}]
    )

    client = get_llm_client()
    model = get_llm_model()

    try:
        response = await client.chat.completions.create(
            model=model, messages=messages, tools=TOOL_DEFINITIONS, tool_choice="auto"
        )
    except Exception as exc:
        raise LLMProviderError(f"LLM request failed: {exc}") from exc

    choice = response.choices[0].message
    tool_name_used: str | None = None
    tool_payload: dict | None = None

    if choice.tool_calls:
        # Only the first tool call is handled — each of the coach's tools is
        # a complete, self-sufficient answer to one kind of question, so a
        # single call per turn covers every case this app supports.
        tool_call = choice.tool_calls[0]
        tool_name_used = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)
        tool_result = await execute_tool(db, user, tool_name_used, arguments)
        tool_payload = {"name": tool_name_used, "arguments": arguments, "result": tool_result}

        messages.append(
            {
                "role": "assistant",
                "content": choice.content,
                "tool_calls": [tool_call.model_dump()],
            }
        )
        messages.append(
            {"role": "tool", "tool_call_id": tool_call.id, "content": json.dumps(tool_result)}
        )

        try:
            follow_up = await client.chat.completions.create(model=model, messages=messages)
        except Exception as exc:
            raise LLMProviderError(f"LLM follow-up request failed: {exc}") from exc
        final_content = follow_up.choices[0].message.content
    else:
        final_content = choice.content

    assistant_msg = ChatMessage(
        user_id=user.id,
        role=ChatRole.ASSISTANT,
        content=final_content or "",
        tool_name=tool_name_used,
        tool_payload=tool_payload,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)
    return assistant_msg


async def _recent_history(db: AsyncSession, user: User) -> list[dict]:
    rows = (
        await db.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.user_id == user.id,
                ChatMessage.role.in_([ChatRole.USER, ChatRole.ASSISTANT]),
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
    ).all()
    return [{"role": message.role.value, "content": message.content} for message in reversed(rows)]
