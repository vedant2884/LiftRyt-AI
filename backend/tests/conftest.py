"""Shared pytest fixtures.

Each test that needs a database gets one via `db_session`, backed by a
dedicated `liftryt_test` database (created on first use if it doesn't
exist yet, never the dev `liftryt` database) whose schema is created fresh
from the SQLAlchemy models and torn down after the test. That's simpler
and more robust across pytest-asyncio versions than the more common
"one shared engine + rollback a transaction per test" pattern, and for a
handful of integration tests the per-test create/drop cost is negligible.

Schema is built from Base.metadata directly rather than by running the
real Alembic migrations — faster for tests, and the migrations themselves
are already exercised manually (upgrade/downgrade cycles verified by hand
at each step). What these tests exist to catch is analytics SQL and
calculation bugs, not migration correctness.
"""

import uuid

import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.base import Base
from app.models import *  # noqa: F401,F403 — populates Base.metadata
from app.models.enums import ActivityLevel, DietaryPreference, ExperienceLevel, Sex
from app.models.user import User

TEST_DB_NAME = "liftryt_test"


def _test_db_url() -> URL:
    # Returning the URL object (not str(url)) deliberately: str()/render_as_string()
    # defaults to hide_password=True and masks it as "***", which
    # create_async_engine will then try to literally authenticate with —
    # a real bug caught here, not a hypothetical one.
    return make_url(settings.database_url).set(database=TEST_DB_NAME)


def _admin_db_url() -> URL:
    # "postgres" is Postgres's own always-present maintenance database —
    # used only to issue CREATE DATABASE, which can't run inside a
    # transaction against the database being created.
    return make_url(settings.database_url).set(database="postgres")


async def _ensure_test_database_exists() -> None:
    admin_engine = create_async_engine(_admin_db_url(), isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": TEST_DB_NAME}
        )
        if not exists:
            await conn.execute(text(f"CREATE DATABASE {TEST_DB_NAME}"))
    await admin_engine.dispose()


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    await _ensure_test_database_exists()
    engine = create_async_engine(_test_db_url())
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="not-a-real-hash",
        full_name="Test User",
        username=f"test_{uuid.uuid4().hex[:12]}",
        age=30,
        sex=Sex.MALE,
        height_cm=180,
        activity_level=ActivityLevel.MODERATE,
        training_experience=ExperienceLevel.INTERMEDIATE,
        dietary_preference=DietaryPreference.NONE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user
