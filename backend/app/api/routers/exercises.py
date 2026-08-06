import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import ExerciseCategory, ExperienceLevel, MovementType
from app.models.exercise import Exercise
from app.models.user import User
from app.schemas.exercise import ExerciseListResponse, ExerciseOut
from app.services import exercise_retrieval

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=ExerciseListResponse)
async def list_exercises(
    q: str | None = Query(default=None, description="Search by name or description"),
    muscle: str | None = Query(default=None, description="Primary or secondary muscle"),
    equipment: str | None = None,
    category: ExerciseCategory | None = None,
    movement_type: MovementType | None = None,
    difficulty: ExperienceLevel | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ExerciseListResponse:
    filters = []
    if q:
        like = f"%{q}%"
        filters.append(or_(Exercise.name.ilike(like), Exercise.description.ilike(like)))
    if muscle:
        # Postgres array containment: true if `muscle` appears in either
        # array column. ARRAY(...).any() compiles to `x = ANY(column)`.
        filters.append(
            or_(Exercise.primary_muscles.any(muscle), Exercise.secondary_muscles.any(muscle))
        )
    if equipment:
        filters.append(Exercise.equipment == equipment)
    if category:
        filters.append(Exercise.category == category)
    if movement_type:
        filters.append(Exercise.movement_type == movement_type)
    if difficulty:
        filters.append(Exercise.difficulty == difficulty)

    base_stmt = select(Exercise).where(*filters)
    total = await db.scalar(select(func.count()).select_from(base_stmt.subquery()))
    page_stmt = base_stmt.order_by(Exercise.name).limit(limit).offset(offset)
    items = (await db.scalars(page_stmt)).all()

    return ExerciseListResponse(
        items=[ExerciseOut.model_validate(item) for item in items], total=total or 0
    )


@router.get("/muscles", response_model=list[str])
async def list_muscles(
    db: AsyncSession = Depends(get_db), _current_user: User = Depends(get_current_user)
) -> list[str]:
    # Raw SQL: unnest() flattens both array columns into rows so DISTINCT
    # can dedupe across them. There's no ORM-expression equivalent that's
    # both this concise and this literal about what's actually running.
    result = await db.execute(
        text(
            """
            SELECT DISTINCT muscle
            FROM exercises, unnest(primary_muscles || secondary_muscles) AS muscle
            ORDER BY muscle
            """
        )
    )
    return [row[0] for row in result.all()]


@router.get("/equipment", response_model=list[str])
async def list_equipment(
    db: AsyncSession = Depends(get_db), _current_user: User = Depends(get_current_user)
) -> list[str]:
    result = await db.execute(select(Exercise.equipment).distinct().order_by(Exercise.equipment))
    return [row[0] for row in result.all()]


@router.get("/search/semantic", response_model=list[ExerciseOut])
async def semantic_search(
    q: str = Query(..., min_length=1, description="Natural-language description of what you need"),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[ExerciseOut]:
    """RAG counterpart to the keyword search above: finds exercises by
    meaning, e.g. "something for a sore lower back" or "explosive movement
    for athletes" — queries that won't reliably hit via ILIKE name/description
    matching but do via embedding similarity.
    """
    results = await exercise_retrieval.semantic_search_exercises(db, q, limit)
    return [ExerciseOut.model_validate(exercise) for exercise in results]


@router.get("/{exercise_id}", response_model=ExerciseOut)
async def get_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ExerciseOut:
    exercise = await db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
    return ExerciseOut.model_validate(exercise)
