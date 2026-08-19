import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ChatRole


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    created_at: datetime
    updated_at: datetime


class ExerciseChatContext(BaseModel):
    """Sent alongside a message from the exercise detail modal's "Ask Coach"
    box, so the user never has to type the exercise's name. Injected only
    into the LLM's system prompt for this one turn — never stored as part
    of the user's visible message content."""

    name: str
    primary_muscles: list[str]
    secondary_muscles: list[str] = Field(default_factory=list)
    equipment: str
    category: str
    difficulty: str


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    exercise_context: ExerciseChatContext | None = None


class ChatMessageEdit(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    exercise_context: ExerciseChatContext | None = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: ChatRole
    content: str
    tool_name: str | None
    tool_payload: dict | None
    created_at: datetime


class SendMessageResult(BaseModel):
    """Both halves of a turn — the client's optimistically-rendered user
    message needs replacing with its real persisted id (not just the reply
    appended), or it can never later be the target of an edit."""

    user_message: ChatMessageOut
    assistant_message: ChatMessageOut
