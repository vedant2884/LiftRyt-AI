from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services.notification_service import get_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationOut]:
    """Computed fresh on every call from current workout history — see
    notification_service's module docstring for why this is stateless
    in-app eligibility rather than scheduled push delivery."""
    notifications = await get_notifications(db, current_user)
    return [NotificationOut(type=n.type, message=n.message) for n in notifications]
