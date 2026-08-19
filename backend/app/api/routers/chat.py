import json
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.enums import ChatRole
from app.models.user import User
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageEdit,
    ChatMessageOut,
    ChatSessionOut,
    SendMessageResult,
)
from app.services.agent import edit_user_message, run_agent, stream_edit_message, stream_new_message
from app.services.llm.provider import LLMProviderError
from app.services.weekly_checkin import generate_weekly_checkin

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_owned_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> ChatSession:
    session = await db.get(ChatSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat session not found")
    return session


async def _get_owned_user_message(
    db: AsyncSession, session: ChatSession, message_id: uuid.UUID
) -> ChatMessage:
    message = await db.get(ChatMessage, message_id)
    if message is None or message.session_id != session.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if message.role != ChatRole.USER:
        # Only the user's own messages are editable — editing an assistant
        # reply directly would mean forging what the coach "said".
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only your own messages can be edited")
    return message


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatSessionOut]:
    rows = (
        await db.scalars(
            select(ChatSession)
            .where(ChatSession.user_id == current_user.id)
            .order_by(ChatSession.updated_at.desc())
        )
    ).all()
    return [ChatSessionOut.model_validate(row) for row in rows]


@router.post("/sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionOut:
    session = ChatSession(user_id=current_user.id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionOut.model_validate(session)


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageOut]:
    await _get_owned_session(db, current_user, session_id)
    rows = (
        await db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
    ).all()
    return [ChatMessageOut.model_validate(row) for row in rows]


@router.post(
    "/sessions/{session_id}/messages", response_model=SendMessageResult, status_code=status.HTTP_201_CREATED
)
async def send_message(
    session_id: uuid.UUID,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResult:
    """Non-streaming send — kept alongside the streaming endpoint below
    (not replaced by it) as the simpler, lower-risk path for any client
    that doesn't consume SSE. The web app and (once wired up) the mobile
    app use /stream instead for the real first-token-latency win."""
    session = await _get_owned_session(db, current_user, session_id)
    try:
        user_message, assistant_message = await run_agent(
            db, current_user, session, payload.content, exercise_context=payload.exercise_context
        )
    except LLMProviderError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    return SendMessageResult(
        user_message=ChatMessageOut.model_validate(user_message),
        assistant_message=ChatMessageOut.model_validate(assistant_message),
    )


def _encode_sse_event(event: dict) -> str:
    """Renders one agent.py event dict as an SSE `data:` line. ChatMessage
    ORM rows (the "start"/"done" events' payloads) go through
    ChatMessageOut first so the wire format matches every other chat
    endpoint's JSON shape exactly, just delivered incrementally."""
    out = dict(event)
    for key in ("user_message", "assistant_message"):
        if key in out:
            out[key] = json.loads(ChatMessageOut.model_validate(out[key]).model_dump_json())
    return f"data: {json.dumps(out)}\n\n"


async def _sse_response(events: AsyncIterator[dict]) -> StreamingResponse:
    async def encoded() -> AsyncIterator[str]:
        try:
            async for event in events:
                yield _encode_sse_event(event)
        except LLMProviderError as exc:
            yield _encode_sse_event({"type": "error", "detail": str(exc)})

    return StreamingResponse(
        encoded(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # Disabled in case this is ever fronted by a buffering reverse
            # proxy (Render's own edge has not needed this in testing, but
            # it's a no-op everywhere else and cheap insurance against a
            # silent regression to "wait for the whole body" behavior.
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions/{session_id}/messages/stream", status_code=status.HTTP_201_CREATED)
async def send_message_stream(
    session_id: uuid.UUID,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    session = await _get_owned_session(db, current_user, session_id)
    return await _sse_response(
        stream_new_message(db, current_user, session, payload.content, exercise_context=payload.exercise_context)
    )


@router.patch("/sessions/{session_id}/messages/{message_id}/stream")
async def edit_message_stream(
    session_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: ChatMessageEdit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    session = await _get_owned_session(db, current_user, session_id)
    message = await _get_owned_user_message(db, session, message_id)
    return await _sse_response(
        stream_edit_message(
            db, current_user, session, message, payload.content, exercise_context=payload.exercise_context
        )
    )


@router.patch("/sessions/{session_id}/messages/{message_id}", response_model=ChatMessageOut)
async def edit_message(
    session_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: ChatMessageEdit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageOut:
    """Edits a past user message in place and regenerates from that point —
    everything after it (the stale reply, and any later turns) is discarded
    server-side, so the client just replaces its local message list with
    whatever this returns plus the edited message itself. Non-streaming
    counterpart to /stream above, kept for the same reason as send_message."""
    session = await _get_owned_session(db, current_user, session_id)
    message = await _get_owned_user_message(db, session, message_id)
    try:
        assistant_message = await edit_user_message(
            db, current_user, session, message, payload.content, exercise_context=payload.exercise_context
        )
    except LLMProviderError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    return ChatMessageOut.model_validate(assistant_message)


@router.post(
    "/sessions/{session_id}/weekly-checkin",
    response_model=ChatMessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def weekly_checkin(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageOut:
    session = await _get_owned_session(db, current_user, session_id)
    try:
        assistant_message = await generate_weekly_checkin(db, current_user, session)
    except LLMProviderError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    return ChatMessageOut.model_validate(assistant_message)
