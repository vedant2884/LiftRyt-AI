import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.weight import WeightAnalyticsResponse, WeightLogCreate, WeightLogOut
from app.services import weight_analytics

router = APIRouter(prefix="/weight-logs", tags=["weight"])


@router.post("", response_model=WeightLogOut, status_code=status.HTTP_201_CREATED)
async def upsert_weight_log(
    payload: WeightLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightLogOut:
    logged_at = payload.logged_at or date.today()

    # Upsert on the (user_id, logged_at) unique constraint from step 2:
    # re-logging today's weight updates the existing row instead of erroring.
    stmt = pg_insert(WeightLog).values(
        user_id=current_user.id,
        weight_kg=payload.weight_kg,
        logged_at=logged_at,
        note=payload.note,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[WeightLog.user_id, WeightLog.logged_at],
        set_={"weight_kg": stmt.excluded.weight_kg, "note": stmt.excluded.note},
    ).returning(WeightLog)
    row = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return WeightLogOut.model_validate(row)


@router.get("", response_model=list[WeightLogOut])
async def list_weight_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WeightLogOut]:
    rows = (
        await db.scalars(
            select(WeightLog)
            .where(WeightLog.user_id == current_user.id)
            .order_by(WeightLog.logged_at.desc())
        )
    ).all()
    return [WeightLogOut.model_validate(row) for row in rows]


@router.get("/analytics", response_model=WeightAnalyticsResponse)
async def get_weight_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightAnalyticsResponse:
    series = await weight_analytics.get_weight_series(db, current_user.id)
    weekly = await weight_analytics.get_weekly_averages(db, current_user.id)
    goal = float(current_user.goal_weight_kg) if current_user.goal_weight_kg is not None else None
    trend = await weight_analytics.get_trend(db, current_user.id, goal)

    latest = series[-1] if series else None

    return WeightAnalyticsResponse(
        current_weight_kg=latest.weight_kg if latest else None,
        latest_logged_at=latest.logged_at if latest else None,
        series=series,
        weekly_averages=weekly,
        trend=trend,
    )


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight_log(
    log_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    log = await db.get(WeightLog, log_id)
    if log is None or log.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Weight log not found")
    await db.delete(log)
    await db.commit()
