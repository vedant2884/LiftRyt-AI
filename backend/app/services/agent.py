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

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.enums import ChatRole
from app.models.user import User
from app.schemas.chat import ExerciseChatContext
from app.services.agent_tools import TOOL_DEFINITIONS, execute_tool
from app.services.coach_context import build_context
from app.services.embeddings import embed_text_async
from app.services.language_detection import detect_language, language_instruction
from app.services.llm.provider import (
    LLMProviderError,
    create_chat_completion,
    get_llm_client,
    stream_chat_completion,
)

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
- Write in plain, direct sentences. Never use em dashes or en dashes; use a period, comma, or "and"/"with" instead.
- Match formatting to the question: a one-line question gets a one-line answer, no headings. A genuinely multi-part or detailed question can use short paragraphs, headings, and real markdown bullet/numbered lists, not a wall of text. Bold only the numbers/values that matter.
- Emojis only where they'd feel natural in a text from a real coach, never in every message and never more than one or two in a reply.
- Never mix Hindi and Marathi in one reply, even though both can be written in Devanagari. Never silently translate the user's message into a different language or script before answering. An explicit request from the user for a different language or script (e.g. "English mein batao") always overrides the detected default below, for that reply only.{language_instruction}"""


async def run_agent(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    user_message: str,
    exercise_context: ExerciseChatContext | None = None,
) -> tuple[ChatMessage, ChatMessage]:
    """Returns (user_message, assistant_message) — the caller needs the
    persisted user message's real id/created_at too, not just the reply, so
    the client can replace its optimistic placeholder rather than being
    stuck with a client-only id it can never later target an edit at."""
    # Fetch history *before* persisting this turn's user message, so it
    # isn't duplicated when appended to the outgoing messages list below.
    history = await _recent_history(db, session.id)

    user_msg = ChatMessage(
        user_id=user.id, session_id=session.id, role=ChatRole.USER, content=user_message
    )
    try:
        user_msg.embedding = await embed_text_async(user_message)
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
    await db.refresh(user_msg)

    assistant_msg = await _generate_reply(db, user, session, history, user_message, exercise_context)
    return user_msg, assistant_msg


async def edit_user_message(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    message: ChatMessage,
    new_content: str,
    exercise_context: ExerciseChatContext | None = None,
) -> ChatMessage:
    """Edits a previously-sent user message and regenerates the reply from
    that point, mirroring ChatGPT/Claude's edit behavior: everything after
    the edited message (its old assistant reply, and any later turns) is
    discarded rather than left orphaned or the whole conversation wiped."""
    # History as it stood *before* this message, so the model doesn't see
    # the message's own pre-edit content or anything now being discarded.
    history = await _recent_history(db, session.id, before=message.created_at)

    await db.execute(
        delete(ChatMessage).where(
            ChatMessage.session_id == session.id, ChatMessage.created_at > message.created_at
        )
    )
    message.content = new_content
    try:
        message.embedding = await embed_text_async(new_content)
    except Exception:
        pass
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return await _generate_reply(db, user, session, history, new_content, exercise_context)


async def _build_messages(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    history: list[dict],
    user_message: str,
    exercise_context: ExerciseChatContext | None,
) -> list[dict]:
    context = await build_context(db, user, session.id, user_message)

    # Detected fresh from the CURRENT message every turn (per the language
    # policy, the current message always takes priority over history) —
    # the most recent user turn in history only breaks a tie/no-signal case
    # (e.g. "ok thanks"), so a genuinely ambiguous follow-up doesn't
    # randomly flip languages mid-conversation.
    previous_user_message = next(
        (m["content"] for m in reversed(history) if m["role"] == "user"), None
    )
    fallback_language = detect_language(previous_user_message)[0] if previous_user_message else "hindi"
    language, script = detect_language(user_message, fallback_language=fallback_language)

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        age=user.age,
        sex=user.sex.value,
        height_cm=user.height_cm,
        training_experience=user.training_experience.value,
        activity_level=user.activity_level.value,
        goal_weight_kg=user.goal_weight_kg if user.goal_weight_kg is not None else "not set",
        context=context,
        language_instruction=language_instruction(language, script),
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

    return [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_message}]


async def _generate_reply(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    history: list[dict],
    user_message: str,
    exercise_context: ExerciseChatContext | None,
) -> ChatMessage:
    messages = await _build_messages(db, user, session, history, user_message, exercise_context)
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
            assistant_msg.embedding = await embed_text_async(final_content)
        except Exception:
            pass
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)
    return assistant_msg


async def stream_new_message(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    user_message: str,
    exercise_context: ExerciseChatContext | None = None,
):
    """Streaming counterpart to run_agent — same persistence, yields SSE-
    shaped event dicts instead of returning once at the end. See
    _stream_reply for the event shapes."""
    history = await _recent_history(db, session.id)

    user_msg = ChatMessage(
        user_id=user.id, session_id=session.id, role=ChatRole.USER, content=user_message
    )
    try:
        user_msg.embedding = await embed_text_async(user_message)
    except Exception:
        pass
    db.add(user_msg)

    if session.title is None:
        session.title = _generate_title(user_message)
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user_msg)

    yield {"type": "start", "user_message": user_msg}
    async for event in _stream_reply(db, user, session, history, user_message, exercise_context):
        yield event


async def stream_edit_message(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    message: ChatMessage,
    new_content: str,
    exercise_context: ExerciseChatContext | None = None,
):
    """Streaming counterpart to edit_user_message — same truncate-and-
    regenerate persistence, yields SSE-shaped event dicts."""
    history = await _recent_history(db, session.id, before=message.created_at)

    await db.execute(
        delete(ChatMessage).where(
            ChatMessage.session_id == session.id, ChatMessage.created_at > message.created_at
        )
    )
    message.content = new_content
    try:
        message.embedding = await embed_text_async(new_content)
    except Exception:
        pass
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()

    yield {"type": "start", "user_message": message}
    async for event in _stream_reply(db, user, session, history, new_content, exercise_context):
        yield event


async def _stream_reply(
    db: AsyncSession,
    user: User,
    session: ChatSession,
    history: list[dict],
    user_message: str,
    exercise_context: ExerciseChatContext | None,
):
    """Shared streaming core for both a new message and a post-edit
    regeneration. Yields:
      {"type": "delta", "content": str}                       — text chunk
      {"type": "tool_result", "tool_name", "arguments", "result"}
      {"type": "done", "assistant_message": ChatMessage}       — persisted
      {"type": "error", "detail": str}                         — terminal

    Tool calls arrive as accumulated deltas (name/arguments build up across
    chunks, mirroring how the non-streaming _generate_reply only ever
    handles the first tool call) with no visible content of their own; once
    the tool call is complete, the tool runs locally (fast — no network
    beyond our own DB) and a second streaming call narrates the result,
    which *does* stream token-by-token like a normal reply.
    """
    messages = await _build_messages(db, user, session, history, user_message, exercise_context)
    client = get_llm_client()

    try:
        chunks = await stream_chat_completion(
            client, messages=messages, tools=TOOL_DEFINITIONS, tool_choice="auto"
        )
    except Exception as exc:
        yield {"type": "error", "detail": f"LLM request failed: {exc}"}
        return

    tool_call_id: str | None = None
    tool_call_name: str | None = None
    tool_call_arg_fragments: list[str] = []
    full_text = ""

    try:
        async for chunk in chunks:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta is None:
                continue
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if tc.id:
                        tool_call_id = tc.id
                    if tc.function and tc.function.name:
                        tool_call_name = tc.function.name
                    if tc.function and tc.function.arguments:
                        tool_call_arg_fragments.append(tc.function.arguments)
            elif delta.content:
                full_text += delta.content
                yield {"type": "delta", "content": delta.content}
    except Exception as exc:
        yield {"type": "error", "detail": f"LLM stream failed: {exc}"}
        return

    tool_name_used: str | None = None
    tool_payload: dict | None = None

    if tool_call_name:
        arguments = json.loads("".join(tool_call_arg_fragments) or "{}")
        tool_name_used = tool_call_name
        tool_result = await execute_tool(db, user, tool_name_used, arguments)
        tool_payload = {"name": tool_name_used, "arguments": arguments, "result": tool_result}
        yield {
            "type": "tool_result",
            "tool_name": tool_name_used,
            "arguments": arguments,
            "result": tool_result,
        }

        call_id = tool_call_id or "call_1"
        messages.append(
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": call_id,
                        "type": "function",
                        "function": {
                            "name": tool_call_name,
                            "arguments": "".join(tool_call_arg_fragments) or "{}",
                        },
                    }
                ],
            }
        )
        messages.append({"role": "tool", "tool_call_id": call_id, "content": json.dumps(tool_result)})

        try:
            follow_up_chunks = await stream_chat_completion(client, messages=messages)
        except Exception as exc:
            yield {"type": "error", "detail": f"LLM follow-up request failed: {exc}"}
            return

        try:
            async for chunk in follow_up_chunks:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    full_text += delta.content
                    yield {"type": "delta", "content": delta.content}
        except Exception as exc:
            yield {"type": "error", "detail": f"LLM follow-up stream failed: {exc}"}
            return

    assistant_msg = ChatMessage(
        user_id=user.id,
        session_id=session.id,
        role=ChatRole.ASSISTANT,
        content=full_text,
        tool_name=tool_name_used,
        tool_payload=tool_payload,
    )
    if full_text:
        try:
            assistant_msg.embedding = await embed_text_async(full_text)
        except Exception:
            pass
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    yield {"type": "done", "assistant_message": assistant_msg}


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


async def _recent_history(
    db: AsyncSession, session_id: uuid.UUID, *, before: datetime | None = None
) -> list[dict]:
    query = select(ChatMessage).where(
        ChatMessage.session_id == session_id,
        ChatMessage.role.in_([ChatRole.USER, ChatRole.ASSISTANT]),
    )
    if before is not None:
        # Used when regenerating after an edit — excludes the edited
        # message's own pre-edit content and anything sent after it, both of
        # which are about to be overwritten/deleted by the caller.
        query = query.where(ChatMessage.created_at < before)
    rows = (await db.scalars(query.order_by(ChatMessage.created_at.desc()).limit(HISTORY_LIMIT))).all()
    return [{"role": message.role.value, "content": message.content} for message in reversed(rows)]
