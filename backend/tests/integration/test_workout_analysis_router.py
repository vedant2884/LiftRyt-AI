"""Integration tests for the Workout Analysis endpoints
(app/api/routers/workouts.py's /analysis/* routes +
app/services/workout_analytics.get_workout_overview/get_exercise_progression).
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


async def test_overview_reflects_real_logged_data(
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

    res = await client.get("/workouts/analysis/overview", headers=headers)

    body = res.json()
    assert body["total_workouts"] == 1
    assert body["workouts_this_week"] == 1
    assert body["total_sets"] == 1
    assert body["total_volume_kg"] == 640.0  # 80 * 8
    assert body["most_trained_muscle"] == "chest"
    assert body["most_trained_exercise_name"] == "Test Bench Press"


async def test_overview_is_scoped_to_the_current_user(
    client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    owner_headers = bearer_token_for(test_user)
    other_headers = bearer_token_for(other_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=owner_headers)).json()
    await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 8, "weight_kg": 80},
        headers=owner_headers,
    )

    res = await client.get("/workouts/analysis/overview", headers=other_headers)

    body = res.json()
    assert body["total_workouts"] == 0
    assert body["total_sets"] == 0
    assert body["most_trained_muscle"] is None


async def test_exercise_progression_best_estimated_1rm_uses_epley(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)
    workout = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()
    await client.post(
        f"/workouts/{workout['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 5, "weight_kg": 90},
        headers=headers,
    )

    res = await client.get(f"/workouts/analysis/progression/{exercise.id}", headers=headers)

    body = res.json()
    # Epley: 90 * (1 + 5/30) = 105.0
    assert body["best_estimated_1rm_kg"] == 105.0
    assert body["best_weight_kg"] == 90.0
    assert body["best_weight_reps"] == 5
    assert body["session_count"] == 1


async def test_exercise_progression_series_is_one_point_per_session_chronological(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    exercise = await _make_exercise(db_session)
    await db_session.commit()
    headers = bearer_token_for(test_user)

    workout1 = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()
    await client.post(
        f"/workouts/{workout1['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 8, "weight_kg": 80},
        headers=headers,
    )
    # Second, heavier set in the SAME session — the series should still
    # show only the session's best set, not every set.
    await client.post(
        f"/workouts/{workout1['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 6, "weight_kg": 85},
        headers=headers,
    )
    workout2 = (await client.post("/workouts", json={"name": "Push Day"}, headers=headers)).json()
    await client.post(
        f"/workouts/{workout2['id']}/sets",
        json={"exercise_id": str(exercise.id), "reps": 5, "weight_kg": 90},
        headers=headers,
    )

    res = await client.get(f"/workouts/analysis/progression/{exercise.id}", headers=headers)

    series = res.json()["series"]
    assert len(series) == 2
    assert [point["weight_kg"] for point in series] == [85.0, 90.0]
