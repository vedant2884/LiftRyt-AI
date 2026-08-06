import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin


class RefreshToken(Base, UUIDPkMixin, CreatedAtMixin):
    """Server-side record backing each issued refresh token.

    The raw token is never stored — only its SHA-256 hash (token_hash), so a
    DB read doesn't hand out anything usable. Storing this at all (rather
    than trusting a stateless refresh JWT) is what makes rotation and
    revocation possible: logout, "log out everywhere", and password-change
    invalidation all just flip revoked_at.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
