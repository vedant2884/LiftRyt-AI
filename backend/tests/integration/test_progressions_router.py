"""Integration tests for the progressive-overload feature: PR detection
offering a suggested increment (never auto-applied), confirming it, and
per-exercise overrides/disable — app/api/routers/{workouts,progressions}.py.
"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType
from app.models.exercise import Exercise
from app.models.user import User
from tests.conftest import bearer_token_for


async def _make_exercise(db: AsyncSession, name: str = "Test Bench Press") -> Exercise:
    exercise = Exercise(
        name=name,
        primary_muscles=["chest"],
        secondary_muscles=[],
        equipment="barbell",
        movement_type=MovementType.COMPOUND,
        category=ExerciseCategory.PUSH,
        difficulty=ExperienceLevel.BEGINNER,
    )
    db.add(exercise)
    await db.flush()
    return exercise


async def test_first_pr_suggests_the_users_default_increment(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    res = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 8, "weight_kg": 80},
        headers=headers,
    )

    body = res.json()
    assert body["is_pr"] is True
    assert body["suggested_increment_kg"] == float(test_user.default_progression_increment_kg)


async def test_non_pr_set_never_suggests_an_increment(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 8, "weight_kg": 80},
        headers=headers,
    )
    # Lighter than the first set — not a PR.
    res = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 8, "weight_kg": 70},
        headers=headers,
    )

    body = res.json()
    assert body["is_pr"] is False
    assert body["suggested_increment_kg"] is None


async def test_confirming_never_happens_automatically_and_computes_next_weight(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()
    await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 8, "weight_kg": 80},
        headers=headers,
    )

    # Nothing has been confirmed yet — no progression row, no suggestion.
    before = await client.get("/exercises/progressions", headers=headers)
    assert before.json() == []

    confirm = await client.post(
        "/exercises/progressions/confirm",
        json={"exercise_id": str(exercise.id), "pr_weight_kg": 80},
        headers=headers,
    )

    body = confirm.json()
    assert body["next_suggested_weight_kg"] == 80 + float(test_user.default_progression_increment_kg)


async def test_per_exercise_override_changes_the_next_confirmed_increment(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)

    await client.patch(
        "/exercises/progressions", json={"exercise_id": str(exercise.id), "increment_kg": 5}, headers=headers
    )
    confirm = await client.post(
        "/exercises/progressions/confirm",
        json={"exercise_id": str(exercise.id), "pr_weight_kg": 100},
        headers=headers,
    )

    body = confirm.json()
    assert body["increment_kg_override"] == 5.0
    assert body["next_suggested_weight_kg"] == 105.0


async def test_disabling_progression_suppresses_the_suggestion_but_pr_still_detected(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    await client.patch(
        "/exercises/progressions", json={"exercise_id": str(exercise.id), "enabled": False}, headers=headers
    )
    res = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 5, "weight_kg": 100},
        headers=headers,
    )

    body = res.json()
    assert body["is_pr"] is True
    assert body["suggested_increment_kg"] is None


async def test_clear_suggestion_removes_the_pending_next_weight(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    await client.post(
        "/exercises/progressions/confirm",
        json={"exercise_id": str(exercise.id), "pr_weight_kg": 80},
        headers=headers,
    )

    res = await client.patch(
        "/exercises/progressions",
        json={"exercise_id": str(exercise.id), "clear_suggestion": True},
        headers=headers,
    )

    assert res.json()["next_suggested_weight_kg"] is None


async def test_progressions_list_is_scoped_to_the_current_user(
    client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    owner_headers = bearer_token_for(test_user)
    other_headers = bearer_token_for(other_user)

    await client.post(
        "/exercises/progressions/confirm",
        json={"exercise_id": str(exercise.id), "pr_weight_kg": 80},
        headers=owner_headers,
    )

    other_list = await client.get("/exercises/progressions", headers=other_headers)
    assert other_list.json() == []

    owner_list = await client.get("/exercises/progressions", headers=owner_headers)
    assert len(owner_list.json()) == 1
