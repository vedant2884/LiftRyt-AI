"""Idempotent exercise-library seed.

Runs on every backend startup (see entrypoint.sh) via an upsert keyed on
Exercise.name — cheap for ~60 rows, and it means `docker compose up` alone
always leaves the library present and current, the same one-command-boot
guarantee step 2 established for migrations.
"""

import asyncio

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.seed_data.exercises import EXERCISES
from app.db.session import async_session_factory
from app.models.exercise import Exercise


async def seed_exercises() -> None:
    async with async_session_factory() as session:
        for row in EXERCISES:
            stmt = pg_insert(Exercise).values(**row)
            update_columns = {key: stmt.excluded[key] for key in row if key != "name"}
            stmt = stmt.on_conflict_do_update(index_elements=["name"], set_=update_columns)
            await session.execute(stmt)
        await session.commit()
        print(f"Seeded {len(EXERCISES)} exercises.")


if __name__ == "__main__":
    asyncio.run(seed_exercises())
