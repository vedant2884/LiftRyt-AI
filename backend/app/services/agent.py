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
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.enums import ChatRole
from app.models.user import User
from app.schemas.chat import ExerciseChatContext
from app.services.agent_tools import TOOL_DEFINITIONS, execute_tool
from app.services.coach_context import build_context
from app.services.embeddings import embed_text
from app.services.llm.provider import LLMProviderError, create_chat_completion, get_llm_client

# How many recent turns of conversation ride along as context. Kept small —
# this is a chat-completions API with no prompt caching across turns, so
# every message here is repaid in tokens on every single request.
HISTORY_LIMIT = 12

TITLE_MAX_LENGTH = 48

SYSTEM_PROMPT_TEMPLATE = """You are LiftRyt AI's gym coach: direct, encouraging, and grounded in the user's real training data. Never invent a workout split or estimate calorie/macro numbers yourself when a tool exists to compute them correctly.

User profile: {age}yo {sex}, {height_cm}cm, {training_experience} lifter, activity level {activity_level}, goal weight {goal_weight_kg}.

Current context (retrieved from their logged data):
{context}

Rules:
- Decide whether to call a tool based only on the user's CURRENT message. A tool being called earlier in this conversation is never itself a reason to call it again now.
- If the current message is a greeting, small talk, thanks, or a general question that isn't actually asking for a new split or new macro numbers, respond in plain conversational text and call no tool at all, even if the conversation so far has involved tools.
- If the current message asks for a workout split, program, or routine, call generate_workout_split. Never write one freehand.
- If the current message asks to set or recalculate calorie or macro targets, or explicitly asks about cutting or bulking, call calculate_macros. Never estimate these yourself.
- Don't call calculate_macros just to answer a general progress or weight-trend question. The context above already has their active target and weight trend, so only call it when they actually want a new target calculated.
- After a tool call, the app already renders the exercise list or macro numbers as a structured card, so don't repeat that data in your reply. Write 2-3 short sentences explaining *why* it's a good fit, using the reasons the tool returned.
- Keep answers focused and practical. This is a coach, not an encyclopedia.
- Write in plain, direct sentences. Never use em dashes or en dashes; use a period, comma, or "and"/"with" instead. Use short paragraphs and, when listing multiple items, real markdown bullet points rather than a run-on sentence."""


async def run_agent(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    user_message: str,
    exercise_context: ExerciseChatContext | None = None,
) -> ChatMessage:
    # Fetch history *before* persisting this turn's user message, so it
    # isn't duplicated when appended to the outgoing messages list below.
    history = await _recent_history(db, session.id)

    user_msg = ChatMessage(
        user_id=user.id, session_id=session.id, role=ChatRole.USER, content=user_message
    )
    try:
        user_msg.embedding = embed_text(user_message)
    except Exception:
        # Same "enhancement, not a requirement" reasoning as the retrieval
        # side (coach_context.py) — an embedding hiccup shouldn't block the
        # user's message from being sent at all.
        pass
    db.add(user_msg)

    if session.title is None:
        session.title = _generate_title(user_message)
    # updated_at has onupdate=func.now(), but that only fires when SQLAlchemy
    # actually issues an UPDATE for this row — which title-on-first-message
    # doesn't guarantee on every later turn, so set it explicitly to keep
    # the session-list sort ("most recently active") correct on every turn.
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()

    context = await build_context(db, user, session.id, user_message)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        age=user.age,
        sex=user.sex.value,
        height_cm=user.height_cm,
        training_experience=user.training_experience.value,
        activity_level=user.activity_level.value,
        goal_weight_kg=user.goal_weight_kg if user.goal_weight_kg is not None else "not set",
        context=context,
    )
    if exercise_context is not None:
        # From the Library detail modal's "Ask Coach" box — the user is
        # looking at this exact exercise right now, so answer about it
        # directly rather than asking them to name it.
        muscles = ", ".join(exercise_context.primary_muscles)
        secondary = (
            f" (secondary: {', '.join(exercise_context.secondary_muscles)})"
            if exercise_context.secondary_muscles
            else ""
        )
        system_prompt += (
            f"\n\nThe user currently has this exercise open in the Library and is asking about it "
            f"specifically, even if their message doesn't name it: \"{exercise_context.name}\" "
            f"— targets {muscles}{secondary}, {exercise_context.equipment}, "
            f"{exercise_context.category} category, {exercise_context.difficulty} difficulty. "
            f"Reference it by name in your answer and ground your answer in the user's own profile, "
            f"goals, and any injuries or limitations they've mentioned."
        )

    messages: list[dict] = (
        [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_message}]
    )

    client = get_llm_client()

    try:
        response = await create_chat_completion(
            client, messages=messages, tools=TOOL_DEFINITIONS, tool_choice="auto"
        )
    except LLMProviderError:
        raise
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
            follow_up = await create_chat_completion(client, messages=messages)
        except LLMProviderError:
            raise
        except Exception as exc:
            raise LLMProviderError(f"LLM follow-up request failed: {exc}") from exc
        final_content = follow_up.choices[0].message.content
    else:
        final_content = choice.content

    assistant_msg = ChatMessage(
        user_id=user.id,
        session_id=session.id,
        role=ChatRole.ASSISTANT,
        content=final_content or "",
        tool_name=tool_name_used,
        tool_payload=tool_payload,
    )
    if final_content:
        try:
            assistant_msg.embedding = embed_text(final_content)
        except Exception:
            pass
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)
    return assistant_msg


def _generate_title(first_message: str) -> str:
    """A short label for the session list, truncated at a word boundary.

    Deterministic rather than an extra LLM call: titling a conversation
    from its own first line doesn't need a model, and this app already
    prefers real code over an LLM call wherever real code can do the job
    (see split_generator, macro_calculator).
    """
    text = " ".join(first_message.split())
    if len(text) <= TITLE_MAX_LENGTH:
        return text
    truncated = text[:TITLE_MAX_LENGTH].rsplit(" ", 1)[0]
    return f"{truncated}..."


async def _recent_history(db: AsyncSession, session_id: uuid.UUID) -> list[dict]:
    rows = (
        await db.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.session_id == session_id,
                ChatMessage.role.in_([ChatRole.USER, ChatRole.ASSISTANT]),
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
    ).all()
    return [{"role": message.role.value, "content": message.content} for message in reversed(rows)]
