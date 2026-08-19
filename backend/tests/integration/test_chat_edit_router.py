"""Integration tests for PATCH /chat/sessions/{id}/messages/{id} (editing a
past user message and regenerating from that point — see
app.services.agent.edit_user_message).

The LLM call itself is monkeypatched: this suite has no existing precedent
for mocking create_chat_completion, and asserting on real model output
would be flaky/slow/costly. What's actually novel and worth a real test
here is the surrounding logic — the stale reply and anything after the
edited message get discarded, and the edit lands on the right message.
"""

from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage
from tests.conftest import bearer_token_for


def _fake_completion(content: str):
    """Minimal stand-in for the OpenAI SDK response shape create_chat_completion
    returns — just enough of response.choices[0].message for agent.py's
    no-tool-call branch."""
    message = SimpleNamespace(content=content, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


@pytest.fixture
def mock_llm_replies(monkeypatch):
    """Each call to create_chat_completion returns the next reply in order
    (first turn, second turn, the edit's regenerated reply, ...), so a test
    can tell them apart by content."""
    replies = iter(["first reply", "second reply", "third reply", "fourth reply"])

    async def fake_create_chat_completion(_client, **_kwargs):
        return _fake_completion(next(replies))

    monkeypatch.setattr("app.services.agent.create_chat_completion", fake_create_chat_completion)


async def test_edit_discards_stale_reply_and_regenerates(
    client: AsyncClient, db_session: AsyncSession, test_user, mock_llm_replies
):
    headers = bearer_token_for(test_user)

    session_res = await client.post("/chat/sessions", headers=headers)
    session_id = session_res.json()["id"]

    first_user_msg = await client.post(
        f"/chat/sessions/{session_id}/messages", json={"content": "How was my chest workout?"}, headers=headers
    )
    assert first_user_msg.status_code == 201
    assert first_user_msg.json()["assistant_message"]["content"] == "first reply"

    # A follow-up turn, so there's genuinely something *after* the edited
    # message that should get discarded, not just the one stale reply.
    await client.post(
        f"/chat/sessions/{session_id}/messages", json={"content": "And my legs?"}, headers=headers
    )

    rows = (
        await db_session.scalars(
            select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
        )
    ).all()
    assert len(rows) == 4  # user, assistant, user, assistant
    edited_message_id = rows[0].id

    edit_res = await client.patch(
        f"/chat/sessions/{session_id}/messages/{edited_message_id}",
        json={"content": "How was my chest workout, be brief"},
        headers=headers,
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["content"] == "third reply"

    db_session.expire_all()
    rows = (
        await db_session.scalars(
            select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
        )
    ).all()
    # Exactly the edited user message + its fresh reply — the old reply and
    # the "And my legs?" follow-up turn are both gone, not orphaned.
    assert len(rows) == 2
    assert rows[0].id == edited_message_id
    assert rows[0].content == "How was my chest workout, be brief"
    assert rows[1].content == "third reply"


async def test_edit_rejects_another_users_message(client: AsyncClient, test_user, other_user):
    session_res = await client.post("/chat/sessions", headers=bearer_token_for(test_user))
    session_id = session_res.json()["id"]

    res = await client.patch(
        f"/chat/sessions/{session_id}/messages/00000000-0000-0000-0000-000000000000",
        json={"content": "hijacked"},
        headers=bearer_token_for(other_user),
    )
    # other_user doesn't own the session at all, so this 404s before the
    # message-ownership check is even reached.
    assert res.status_code == 404


async def test_edit_rejects_assistant_message(client: AsyncClient, test_user, mock_llm_replies):
    headers = bearer_token_for(test_user)
    session_res = await client.post("/chat/sessions", headers=headers)
    session_id = session_res.json()["id"]

    send_res = await client.post(
        f"/chat/sessions/{session_id}/messages", json={"content": "hi"}, headers=headers
    )
    assistant_message_id = send_res.json()["assistant_message"]["id"]

    res = await client.patch(
        f"/chat/sessions/{session_id}/messages/{assistant_message_id}",
        json={"content": "forged"},
        headers=headers,
    )
    assert res.status_code == 400
