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
from datetime import date, timedelta

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
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


@pytest_asyncio.fixture(autouse=True)
async def _reset_redis_connection():
    """app/core/redis.py's redis_client is a module-level singleton,
    lazily connected on first real command — so whichever test happens to
    touch a Redis-backed route first (login rate limiting) binds its
    connection pool to *that* test's event loop. Every test gets its own
    fresh event loop (asyncio_default_fixture_loop_scope = function), so
    without this, any later test reusing that now-torn-down loop fails with
    "Event loop is closed". Closing the pool after every test forces a
    lazy, fresh reconnect on the next test's own loop instead."""
    yield
    from app.core.redis import redis_client

    await redis_client.aclose()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="not-a-real-hash",
        full_name="Test User",
        username=f"test_{uuid.uuid4().hex[:12]}",
        # timedelta days (not .replace(year=...)) so this never hits the
        # Feb-29-on-a-non-leap-target-year ValueError footgun.
        date_of_birth=date.today() - timedelta(days=30 * 365),
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


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
    """A second, distinct account — for tests asserting one user can't read
    or write another's data (workouts, custom exercises, ...)."""
    user = User(
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="not-a-real-hash",
        full_name="Other User",
        username=f"test_{uuid.uuid4().hex[:12]}",
        date_of_birth=date.today() - timedelta(days=28 * 365),
        sex=Sex.FEMALE,
        height_cm=165,
        activity_level=ActivityLevel.MODERATE,
        training_experience=ExperienceLevel.BEGINNER,
        dietary_preference=DietaryPreference.NONE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    """An HTTP client hitting the real FastAPI app/routers over ASGI (not a
    real socket), sharing the test's own db_session — for the handful of
    behaviors that genuinely live in router code (ownership checks, request
    validation) rather than in a directly-callable service function the
    other fixtures already cover.

    Only get_db is overridden, not get_current_user — auth goes through the
    real JWT path via bearer_token_for() below, so two different users can
    be authenticated as themselves on the *same* client within one test
    (needed for ownership tests) without one overriding the other, which a
    shared get_current_user override on the app-global dependency_overrides
    dict couldn't support for more than one identity at a time.
    """

    async def _get_db_override():
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def bearer_token_for(user: User) -> dict[str, str]:
    """Authorization header for `user`, via the real access-token path —
    not a test-only shortcut, so these tests also exercise the same
    JWT decoding get_current_user does in production."""
    from app.core.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user.id)}"}
