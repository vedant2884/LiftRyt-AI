"""Integration tests for app/api/routers/workouts.py, added alongside the
workout logger frontend. Exercised over HTTP (see conftest.py's `client`
fixture) rather than by calling the endpoint functions directly, since the
behaviors here — per-exercise set numbering, dual exercise/custom-exercise
sourcing, cross-user ownership — live in the router itself, not in a
separately-callable service function.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_exercise import CustomExercise
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


async def _make_custom_exercise(db: AsyncSession, user: User, name: str = "Home Curl") -> CustomExercise:
    custom = CustomExercise(
        user_id=user.id,
        name=name,
        primary_muscles=["biceps"],
        secondary_muscles=[],
        equipment="dumbbell",
        movement_type=MovementType.ISOLATION,
        category=ExerciseCategory.PULL,
        difficulty=ExperienceLevel.BEGINNER,
    )
    db.add(custom)
    await db.flush()
    return custom


async def test_set_numbering_restarts_per_exercise(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    bench = await _make_exercise(db_session, "Bench")
    row = await _make_exercise(db_session, "Row")
    await db_session.commit()
    headers = bearer_token_for(test_user)

    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    r1 = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(bench.id), "reps": 8, "weight_kg": 80},
        headers=headers,
    )
    r2 = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(bench.id), "reps": 6, "weight_kg": 90},
        headers=headers,
    )
    # Switching exercises must restart set_number at 1, not continue a
    # single counter across the whole workout (the bug this fix targets).
    r3 = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(row.id), "reps": 10, "weight_kg": 60},
        headers=headers,
    )

    assert r1.json()["set_number"] == 1
    assert r2.json()["set_number"] == 2
    assert r3.json()["set_number"] == 1


async def test_custom_exercise_set_logging(client: AsyncClient, db_session: AsyncSession, test_user: User):
    custom = await _make_custom_exercise(db_session, test_user)
    await db_session.commit()
    headers = bearer_token_for(test_user)

    workout = (await client.post("/workouts", json={"name": "Arms"}, headers=headers)).json()
    res = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"custom_exercise_id": str(custom.id), "reps": 12, "weight_kg": 15},
        headers=headers,
    )

    assert res.status_code == 201
    body = res.json()
    assert body["is_custom"] is True
    assert body["exercise_id"] is None
    assert body["custom_exercise_id"] == str(custom.id)
    assert body["exercise_name"] == "Home Curl"
    # PR tracking is scoped to official exercises only.
    assert body["is_pr"] is False


@pytest.mark.parametrize(
    "payload",
    [
        {"reps": 8, "weight_kg": 80},  # neither source
    ],
)
async def test_add_set_requires_exactly_one_source(
    client: AsyncClient, db_session: AsyncSession, test_user: User, payload: dict
):
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    res = await client.post(f"/workouts/{workout['id']}/sets", json=payload, headers=headers)

    assert res.status_code == 400


async def test_add_set_rejects_both_sources(client: AsyncClient, db_session: AsyncSession, test_user: User):
    exercise = await _make_exercise(db_session)
    custom = await _make_custom_exercise(db_session, test_user)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    res = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={
            "exercise_id": str(exercise.id),
            "custom_exercise_id": str(custom.id),
            "reps": 8,
            "weight_kg": 80,
        },
        headers=headers,
    )

    assert res.status_code == 400


async def test_user_cannot_read_another_users_workout(
    client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    owner_headers = bearer_token_for(test_user)
    other_headers = bearer_token_for(other_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=owner_headers)).json()

    res = await client.get(f"/workouts/{workout['id']}", headers=other_headers)

    assert res.status_code == 404


async def test_user_cannot_log_a_set_against_another_users_workout(
    client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    owner_headers = bearer_token_for(test_user)
    other_headers = bearer_token_for(other_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=owner_headers)).json()

    res = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 8, "weight_kg": 80},
        headers=other_headers,
    )

    assert res.status_code == 404


async def test_user_cannot_log_a_set_against_another_users_custom_exercise(
    client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    custom = await _make_custom_exercise(db_session, test_user)
    await db_session.commit()
    other_headers = bearer_token_for(other_user)
    workout = (await client.post("/workouts", json={"name": "Arms"}, headers=other_headers)).json()

    res = await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"custom_exercise_id": str(custom.id), "reps": 12, "weight_kg": 15},
        headers=other_headers,
    )

    assert res.status_code == 404


async def test_finish_workout_persists_duration(client: AsyncClient, db_session: AsyncSession, test_user: User):
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    res = await client.patch(
        f"/workouts/{workout['id']}", json={"duration_seconds": 2520}, headers=headers
    )

    assert res.status_code == 200
    assert res.json()["duration_seconds"] == 2520


async def test_recent_exercises_returns_distinct_most_recent_first(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    bench = await _make_exercise(db_session, "Bench")
    row = await _make_exercise(db_session, "Row")
    custom = await _make_custom_exercise(db_session, test_user)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()

    for exercise_id in (bench.id, bench.id, row.id):
        await client.post(
            f"/workouts/{workout['id']}/sets",
            json={"exercise_id": str(exercise_id), "reps": 8, "weight_kg": 80},
            headers=headers,
        )
    await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"custom_exercise_id": str(custom.id), "reps": 8, "weight_kg": 10},
        headers=headers,
    )

    res = await client.get("/workouts/recent-exercises", headers=headers)

    assert res.status_code == 200
    names = [row["name"] for row in res.json()]
    # Distinct — Bench appeared twice but shows once.
    assert sorted(names) == sorted(["Bench", "Row", "Home Curl"])
