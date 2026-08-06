import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.redis import (
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    clear_login_attempts,
    get_login_attempts,
    register_login_attempt,
)
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest
from app.schemas.user import UserProfile, UserProfileUpdate

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
# Scoped to /auth so the browser only attaches this cookie to auth endpoints
# (refresh/logout), not to every API request — smaller exposure if any
# request-logging or proxy layer ever leaks headers.
REFRESH_COOKIE_PATH = "/auth"


async def _issue_refresh_cookie(db: AsyncSession, user_id: uuid.UUID, response: Response) -> None:
    raw_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_token),
            expires_at=refresh_token_expiry(),
        )
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        age=payload.age,
        sex=payload.sex,
        height_cm=payload.height_cm,
        goal_weight_kg=payload.goal_weight_kg,
        activity_level=payload.activity_level,
        training_experience=payload.training_experience,
        dietary_preference=payload.dietary_preference,
    )
    db.add(user)
    await db.flush()  # populate user.id for the weight log / refresh token below

    if payload.starting_weight_kg is not None:
        db.add(WeightLog(user_id=user.id, weight_kg=payload.starting_weight_kg, logged_at=date.today()))

    access_token = create_access_token(user.id)
    await _issue_refresh_cookie(db, user.id, response)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(access_token=access_token, user=UserProfile.model_validate(user))


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    if await get_login_attempts(payload.email) >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many login attempts. Try again in a few minutes."
        )

    user = await db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        await register_login_attempt(payload.email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    await clear_login_attempts(payload.email)

    access_token = create_access_token(user.id)
    await _issue_refresh_cookie(db, user.id, response)
    await db.commit()

    return AuthResponse(access_token=access_token, user=UserProfile.model_validate(user))


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    request: Request, response: Response, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token provided")

    stored = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
    )
    now = datetime.now(timezone.utc)
    if stored is None or stored.revoked_at is not None or stored.expires_at < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token is invalid or expired")

    user = await db.get(User, stored.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token is invalid or expired")

    # Rotation: revoke the presented token and issue a new one. A replayed
    # old token (e.g. stolen and reused after the legitimate client already
    # rotated it) will find its hash already revoked and be rejected.
    stored.revoked_at = now
    access_token = create_access_token(stored.user_id)
    await _issue_refresh_cookie(db, stored.user_id, response)
    await db.commit()

    # Returning the user (not just the token) lets the frontend repopulate
    # its auth store from a single call on page load / reload, instead of
    # needing a second /auth/me round trip right after.
    return AuthResponse(access_token=access_token, user=UserProfile.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> None:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token is not None:
        stored = await db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        )
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = datetime.now(timezone.utc)
            await db.commit()
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile.model_validate(current_user)


@router.patch("/me", response_model=UserProfile)
async def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return UserProfile.model_validate(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    # No ORM cascade= needed: every dependent table's FK is ondelete="CASCADE"
    # at the DB level (weight_logs, workouts -> workout_sets, chat_messages,
    # macro_targets, refresh_tokens), so Postgres itself cleans these up.
    await db.delete(current_user)
    await db.commit()
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
