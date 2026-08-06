"""Semantic retrieval over the exercise library via pgvector cosine
similarity — the RAG counterpart to step 4's keyword (ILIKE) search.

Used directly by GET /exercises/search/semantic, and from step 10 onward
by the AI coach's context-gathering step, so it can pull relevant exercises
by meaning ("something for a sore lower back") instead of requiring an
exact keyword match.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
from app.services.embeddings import embed_text


async def semantic_search_exercises(db: AsyncSession, query: str, limit: int = 10) -> list[Exercise]:
    query_vector = embed_text(query)
    # cosine_distance compiles to pgvector's <=> operator: 0 = identical
    # direction, 2 = opposite. Ordering ascending puts nearest-meaning
    # matches first; the HNSW index from this step's migration makes this
    # an index scan rather than a full table scan as the library grows.
    stmt = (
        select(Exercise)
        .where(Exercise.embedding.is_not(None))
        .order_by(Exercise.embedding.cosine_distance(query_vector))
        .limit(limit)
    )
    return list((await db.scalars(stmt)).all())
