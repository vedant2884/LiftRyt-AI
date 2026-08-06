"""Password hashing, JWT access tokens, and opaque refresh tokens.

Access and refresh tokens are deliberately different shapes:
- Access tokens are stateless JWTs (signature-verified only, no DB hit) so
  the common case — "is this request authenticated" — is cheap.
- Refresh tokens are random opaque strings whose hash is looked up in the
  refresh_tokens table, because revocation (logout, "log out everywhere",
  password change) needs a server-side record to invalidate.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

ACCESS_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID:
    """Returns the user id encoded in a valid access token.

    Raises jwt.PyJWTError (caught by the get_current_user dependency) if the
    token is expired, has a bad signature, or isn't an access token.
    """
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise jwt.InvalidTokenError("not an access token")
    return uuid.UUID(payload["sub"])


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(raw_token: str) -> str:
    """Deterministic hash so a presented raw token can be looked up by hash
    without ever storing the raw value server-side."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
