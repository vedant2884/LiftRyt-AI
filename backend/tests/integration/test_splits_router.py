"""Integration tests for the "preferred/active split" feature added on top
of GeneratedSplit.is_active — app/api/routers/splits.py's list/activate
endpoints and the next_day_number rotation.
"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from tests.conftest import bearer_token_for

GENERATE_PAYLOAD = {"days_per_week": 3, "experience_level": "intermediate", "goal": "hypertrophy"}


async def test_list_splits_returns_all_generated_splits_newest_first(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    headers = bearer_token_for(test_user)
    first = (await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)).json()
    second = (await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)).json()

    res = await client.get("/splits", headers=headers)

    ids = [row["id"] for row in res.json()]
    assert ids == [second["id"], first["id"]]


async def test_generating_a_new_split_deactivates_the_previous_one(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    headers = bearer_token_for(test_user)
    await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)
    await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)

    res = await client.get("/splits", headers=headers)

    active_flags = [row["is_active"] for row in res.json()]
    assert active_flags.count(True) == 1


async def test_activate_split_switches_which_one_is_active(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    headers = bearer_token_for(test_user)
    first = (await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)).json()
    await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)  # now active

    await client.post(f"/splits/{first['id']}/activate", headers=headers)

    active = await client.get("/splits/active", headers=headers)
    assert active.json()["id"] == first["id"]


async def test_user_cannot_activate_another_users_split(
    client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    owner_headers = bearer_token_for(test_user)
    other_headers = bearer_token_for(other_user)
    split = (await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=owner_headers)).json()

    res = await client.post(f"/splits/{split['id']}/activate", headers=other_headers)

    assert res.status_code == 404


async def test_next_day_number_advances_after_completing_a_day(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    headers = bearer_token_for(test_user)
    split = (await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)).json()
    assert split["next_day_number"] == 1

    await client.post(f"/splits/{split['id']}/days/1/toggle-complete", headers=headers)

    active = await client.get("/splits/active", headers=headers)
    assert active.json()["next_day_number"] == 2


async def test_next_day_number_wraps_around_after_the_last_day(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    headers = bearer_token_for(test_user)
    split = (await client.post("/splits/generate", json=GENERATE_PAYLOAD, headers=headers)).json()

    await client.post(f"/splits/{split['id']}/days/3/toggle-complete", headers=headers)

    active = await client.get("/splits/active", headers=headers)
    assert active.json()["next_day_number"] == 1
