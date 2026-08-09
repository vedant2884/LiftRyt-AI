"""Semantic retrieval over a user's own past chat messages, across
sessions — this is what lets the coach reference something like "you
mentioned your shoulder was bothering you last week" from an earlier,
unrelated conversation instead of only ever seeing the current session's
recent turns (see agent.py's _recent_history, which is recency-based and
scoped to one session).

Same RAG shape as exercise_retrieval.py: embed the query, order by pgvector
cosine distance, cap at a handful of results to keep latency reasonable.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage
from app.models.enums import ChatRole
from app.services.embeddings import embed_text

RELEVANT_MEMORY_COUNT = 3


async def find_relevant_past_messages(
    db: AsyncSession, user_id: uuid.UUID, current_session_id: uuid.UUID, query: str
) -> list[ChatMessage]:
    query_vector = embed_text(query)
    stmt = (
        select(ChatMessage)
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.session_id != current_session_id,
            ChatMessage.role.in_([ChatRole.USER, ChatRole.ASSISTANT]),
            ChatMessage.embedding.is_not(None),
        )
        .order_by(ChatMessage.embedding.cosine_distance(query_vector))
        .limit(RELEVANT_MEMORY_COUNT)
    )
    return list((await db.scalars(stmt)).all())
