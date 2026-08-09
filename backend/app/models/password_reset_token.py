import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPkMixin


class PasswordResetToken(Base, UUIDPkMixin, CreatedAtMixin):
    """Server-side record backing each issued password-reset link.

    Same pattern as RefreshToken: only the SHA-256 hash is stored, so a DB
    read alone can't be used to reset an account. A short expiry (see
    core.security.RESET_TOKEN_EXPIRE_MINUTES) and single-use (used_at) keep
    a leaked link's blast radius small.
    """

    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
