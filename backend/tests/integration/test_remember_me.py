"""Integration tests for the Remember Me login option (see
_issue_refresh_cookie / LoginRequest.remember_me in app/api/routers/auth.py).

Uses the real /auth/signup + /auth/login HTTP flow rather than the
test_user fixture, since that fixture's hashed_password is a fake string
that verify_password would correctly reject — these tests need a real
bcrypt hash to exercise the actual login path end to end.
"""

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

SIGNUP_PAYLOAD = {
    "password": "testpass123",
    "full_name": "Remember Me Test",
    "age": 30,
    "sex": "male",
    "height_cm": 180,
    "goal_weight_kg": 80,
}


async def _signup(client: AsyncClient) -> str:
    email = f"{uuid.uuid4()}@example.com"
    await client.post(
        "/auth/signup",
        json={
            **SIGNUP_PAYLOAD,
            "email": email,
            "username": f"test_{uuid.uuid4().hex[:12]}",
        },
    )
    return email


async def test_login_with_remember_me_sets_persistent_cookie(client: AsyncClient, db_session: AsyncSession):
    email = await _signup(client)

    res = await client.post(
        "/auth/login", json={"email": email, "password": "testpass123", "remember_me": True}
    )

    set_cookie = res.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "Max-Age=" in set_cookie


async def test_login_without_remember_me_sets_session_cookie(
    client: AsyncClient, db_session: AsyncSession
):
    email = await _signup(client)

    res = await client.post(
        "/auth/login", json={"email": email, "password": "testpass123", "remember_me": False}
    )

    set_cookie = res.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "Max-Age=" not in set_cookie


async def test_login_defaults_to_remembered(client: AsyncClient, db_session: AsyncSession):
    email = await _signup(client)

    res = await client.post("/auth/login", json={"email": email, "password": "testpass123"})

    assert "Max-Age=" in res.headers.get("set-cookie", "")


async def test_refresh_preserves_session_only_choice_across_rotation(
    client: AsyncClient, db_session: AsyncSession
):
    email = await _signup(client)
    await client.post(
        "/auth/login", json={"email": email, "password": "testpass123", "remember_me": False}
    )

    # httpx's AsyncClient keeps the Set-Cookie from login in its own cookie
    # jar and sends it automatically here — the same thing a browser does.
    res = await client.post("/auth/refresh")

    assert res.status_code == 200
    reissued_cookie = res.headers.get("set-cookie", "")
    assert "refresh_token=" in reissued_cookie
    # The whole point of storing remember_me on the token row: rotation
    # must not silently upgrade a session-only login to persistent.
    assert "Max-Age=" not in reissued_cookie


async def test_logout_fully_clears_session_regardless_of_remember_me(
    client: AsyncClient, db_session: AsyncSession
):
    email = await _signup(client)
    await client.post(
        "/auth/login", json={"email": email, "password": "testpass123", "remember_me": True}
    )

    logout_res = await client.post("/auth/logout")
    assert logout_res.status_code == 204

    refresh_res = await client.post("/auth/refresh")
    assert refresh_res.status_code == 401
