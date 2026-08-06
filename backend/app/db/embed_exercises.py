"""Embeds every exercise that doesn't yet have an embedding vector.

Idempotent (only touches rows where embedding IS NULL) and wired into
entrypoint.sh after the seed script, so `docker compose up` alone leaves the
exercise library fully embedded — no separate manual step, same guarantee
step 2 established for migrations and step 4 for seeding.
"""

import asyncio

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.exercise import Exercise
from app.services.embeddings import embed_texts


def _embedding_text(exercise: Exercise) -> str:
    muscles = ", ".join(exercise.primary_muscles + exercise.secondary_muscles)
    return (
        f"{exercise.name}. {exercise.description or ''} "
        f"Targets: {muscles}. Equipment: {exercise.equipment}. "
        f"Category: {exercise.category.value}."
    )


async def embed_exercises() -> None:
    async with async_session_factory() as session:
        rows = list((await session.scalars(select(Exercise).where(Exercise.embedding.is_(None)))).all())
        if not rows:
            print("All exercises already embedded.")
            return

        vectors = embed_texts([_embedding_text(exercise) for exercise in rows])
        for exercise, vector in zip(rows, vectors):
            exercise.embedding = vector
        await session.commit()
        print(f"Embedded {len(rows)} exercises.")


if __name__ == "__main__":
    asyncio.run(embed_exercises())
