from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageOut
from app.services.agent import run_agent
from app.services.llm.provider import LLMProviderError
from app.services.weekly_checkin import generate_weekly_checkin

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/messages", response_model=list[ChatMessageOut])
async def list_messages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageOut]:
    rows = (
        await db.scalars(
            select(ChatMessage)
            .where(ChatMessage.user_id == current_user.id)
            .order_by(ChatMessage.created_at)
        )
    ).all()
    return [ChatMessageOut.model_validate(row) for row in rows]


@router.post("/messages", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageOut:
    try:
        assistant_message = await run_agent(db, current_user, payload.content)
    except LLMProviderError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    return ChatMessageOut.model_validate(assistant_message)


@router.post("/weekly-checkin", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
async def weekly_checkin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageOut:
    try:
        assistant_message = await generate_weekly_checkin(db, current_user)
    except LLMProviderError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    return ChatMessageOut.model_validate(assistant_message)
