import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageOut, ChatSessionOut
from app.services.agent import run_agent
from app.services.llm.provider import LLMProviderError
from app.services.weekly_checkin import generate_weekly_checkin

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_owned_session(db: AsyncSession, user: User, session_id: uuid.UUID) -> ChatSession:
    session = await db.get(ChatSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat session not found")
    return session


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
    "/sessions/{session_id}/messages", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED
)
async def send_message(
    session_id: uuid.UUID,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageOut:
    session = await _get_owned_session(db, current_user, session_id)
    try:
        assistant_message = await run_agent(
            db, current_user, session, payload.content, exercise_context=payload.exercise_context
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
