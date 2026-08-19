import shutil
import time
import uuid
from datetime import date, datetime, timezone

import jwt
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.storage import AVATARS_DIR
from app.core.redis import (
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    clear_login_attempts,
    get_login_attempts,
    register_login_attempt,
)
from app.core.security import (
    create_access_token,
    create_google_signup_token,
    decode_google_signup_token,
    generate_refresh_token,
    generate_reset_token,
    hash_password,
    hash_refresh_token,
    hash_reset_token,
    refresh_token_expiry,
    reset_token_expiry,
    verify_password,
)
from app.db.session import get_db
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleAuthRequest,
    GoogleAuthResponse,
    GoogleCompleteProfileRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
)
from app.schemas.user import UserProfile, UserProfileUpdate
from app.services.email import send_password_reset_email
from app.services.firebase_auth import verify_firebase_id_token

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
# Scoped to /auth so the browser only attaches this cookie to auth endpoints
# (refresh/logout), not to every API request — smaller exposure if any
# request-logging or proxy layer ever leaks headers.
REFRESH_COOKIE_PATH = "/auth"


async def _issue_refresh_cookie(
    db: AsyncSession, user_id: uuid.UUID, response: Response, remember_me: bool = True
) -> None:
    raw_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_token),
            expires_at=refresh_token_expiry(),
            remember_me=remember_me,
        )
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        # Omitting max_age makes this a session cookie — the browser drops
        # it on a full restart rather than keeping the user signed in. The
        # server-side token itself still lives for the usual expiry either
        # way; only the cookie's own persistence changes.
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60 if remember_me else None,
        path=REFRESH_COOKIE_PATH,
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    existing_username = await db.scalar(select(User).where(User.username == payload.username))
    if existing_username is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is already taken")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        username=payload.username,
        date_of_birth=payload.date_of_birth,
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
    # user.hashed_password is None for Google-only accounts — reject rather
    # than pass None into bcrypt, with the same generic message so login
    # can't be used to enumerate which auth method an email uses.
    if (
        user is None
        or user.hashed_password is None
        or not verify_password(payload.password, user.hashed_password)
    ):
        await register_login_attempt(payload.email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    await clear_login_attempts(payload.email)

    access_token = create_access_token(user.id)
    await _issue_refresh_cookie(db, user.id, response, remember_me=payload.remember_me)
    await db.commit()

    return AuthResponse(access_token=access_token, user=UserProfile.model_validate(user))


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> ForgotPasswordResponse:
    generic_response = ForgotPasswordResponse(
        detail="If an account exists for that email, a reset link has been sent."
    )

    user = await db.scalar(select(User).where(User.email == payload.email))
    if user is None:
        # Same response whether or not the account exists, so this endpoint
        # can't be used to enumerate registered emails.
        return generic_response

    raw_token = generate_reset_token()
    db.add(
        PasswordResetToken(
            user_id=user.id, token_hash=hash_reset_token(raw_token), expires_at=reset_token_expiry()
        )
    )
    await db.commit()

    reset_link = f"{settings.frontend_url}/reset-password?token={raw_token}"
    send_password_reset_email(user.email, reset_link)

    if settings.environment != "production":
        generic_response.dev_reset_link = reset_link
    return generic_response


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> None:
    stored = await db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_reset_token(payload.token))
    )
    now = datetime.now(timezone.utc)
    if stored is None or stored.used_at is not None or stored.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired")

    user = await db.get(User, stored.user_id)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired")

    user.hashed_password = hash_password(payload.new_password)
    stored.used_at = now

    # A password reset is a strong signal the old credential may have been
    # compromised, so log out every other session too, not just this one.
    active_refresh_tokens = await db.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
    )
    for token in active_refresh_tokens:
        token.revoked_at = now

    await db.commit()


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if current_user.hashed_password is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account signs in with Google and has no password to change.",
        )
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()


@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(
    payload: GoogleAuthRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> GoogleAuthResponse:
    # verify_firebase_id_token is a synchronous call (it does a blocking
    # HTTP request under the hood on a cache miss) — running it directly
    # here would stall this single-worker process's event loop for every
    # other in-flight request for the duration of that call.
    identity = await run_in_threadpool(verify_firebase_id_token, payload.id_token)

    user = await db.scalar(select(User).where(User.firebase_uid == identity.uid))
    if user is None:
        # No account linked to this Google identity yet — check for an
        # existing email/password account with the same email and link it,
        # rather than creating a second account for the same person.
        user = await db.scalar(select(User).where(User.email == identity.email))
        if user is not None:
            user.firebase_uid = identity.uid
            await db.commit()
            await db.refresh(user)

    if user is not None:
        # Firebase reissues the ID token (and its `picture` claim) on every
        # sign-in, so refreshing here keeps the Google picture reasonably
        # current for free — no extra Google API call, no stored OAuth
        # access token needed. A custom upload still wins on display
        # (avatar_url takes priority client-side) regardless of this value.
        user.google_avatar_url = identity.avatar_url

    if user is None:
        # Brand new identity: Google doesn't supply age/sex/height/username,
        # which the schema requires, so the account can't be created yet.
        # Hand back a short-lived signed token carrying the verified claims
        # so the frontend can collect the rest without re-verifying with
        # Google, then finish via POST /auth/google/complete.
        google_token = create_google_signup_token(
            identity.uid, identity.email, identity.full_name, identity.avatar_url
        )
        return GoogleAuthResponse(
            needs_profile=True,
            google_token=google_token,
            email=identity.email,
            full_name=identity.full_name,
            avatar_url=identity.avatar_url,
        )

    access_token = create_access_token(user.id)
    await _issue_refresh_cookie(db, user.id, response)
    await db.commit()

    return GoogleAuthResponse(
        needs_profile=False, access_token=access_token, user=UserProfile.model_validate(user)
    )


@router.post(
    "/google/complete", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
async def google_complete_profile(
    payload: GoogleCompleteProfileRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    try:
        claims = decode_google_signup_token(payload.google_token)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google sign-in expired, please try again")

    # Re-check for a race: another request could have completed signup (or
    # an email/password account with this email could have appeared) between
    # POST /auth/google and this call — fall back to a normal sign-in.
    user = await db.scalar(select(User).where(User.firebase_uid == claims["firebase_uid"]))
    if user is None:
        user = await db.scalar(select(User).where(User.email == claims["email"]))
        if user is not None:
            user.firebase_uid = claims["firebase_uid"]

    if user is not None:
        user.google_avatar_url = claims["avatar_url"]

    if user is None:
        existing_username = await db.scalar(select(User).where(User.username == payload.username))
        if existing_username is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is already taken")

        user = User(
            email=claims["email"],
            hashed_password=None,
            full_name=claims["full_name"],
            username=payload.username,
            google_avatar_url=claims["avatar_url"],
            firebase_uid=claims["firebase_uid"],
            date_of_birth=payload.date_of_birth,
            sex=payload.sex,
            height_cm=payload.height_cm,
            goal_weight_kg=payload.goal_weight_kg,
            activity_level=payload.activity_level,
            training_experience=payload.training_experience,
            dietary_preference=payload.dietary_preference,
        )
        db.add(user)
        await db.flush()

        if payload.starting_weight_kg is not None:
            db.add(WeightLog(user_id=user.id, weight_kg=payload.starting_weight_kg, logged_at=date.today()))

    access_token = create_access_token(user.id)
    await _issue_refresh_cookie(db, user.id, response)
    await db.commit()
    await db.refresh(user)

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
    # Carries the original Remember Me choice forward — without this, an
    # unchecked (session-only) login would silently become persistent again
    # on the very first silent refresh, since rotation always issues a new
    # cookie and the default there is remembered.
    await _issue_refresh_cookie(db, stored.user_id, response, remember_me=stored.remember_me)
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
    updates = payload.model_dump(exclude_unset=True)
    if "username" in updates and updates["username"] != current_user.username:
        taken = await db.scalar(select(User).where(User.username == updates["username"]))
        if taken is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is already taken")

    for field, value in updates.items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return UserProfile.model_validate(current_user)


ALLOWED_AVATAR_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


@router.post("/me/avatar", response_model=UserProfile)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """Uploads through our own JWT-authenticated API rather than straight to
    client-side Firebase Storage — every user has this auth regardless of
    how they signed up, whereas a Firebase Auth session (and therefore
    Storage's `request.auth`) only ever exists for Google sign-in users, so
    the old direct-to-Storage path silently failed for anyone who signed up
    with email/password."""
    extension = ALLOWED_AVATAR_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a JPEG, PNG, WEBP, or GIF image"
        )

    contents = await file.read(MAX_AVATAR_BYTES + 1)
    if len(contents) > MAX_AVATAR_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image must be under 5MB")
    if not contents:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")

    user_dir = AVATARS_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    # Fixed filename per user rather than one-per-upload, so re-uploading
    # doesn't leave orphaned old files behind; clears any stale file left
    # over from a previous upload in a different format.
    for stale in user_dir.glob("avatar.*"):
        stale.unlink(missing_ok=True)
    (user_dir / f"avatar.{extension}").write_bytes(contents)

    # Cache-busting query param: the URL string itself must change on every
    # upload, or the browser (and any CDN in front of /static later) will
    # keep serving the previous image from the same path.
    current_user.avatar_url = (
        f"{settings.backend_public_url}/static/avatars/{current_user.id}/avatar.{extension}"
        f"?v={int(time.time())}"
    )
    await db.commit()
    await db.refresh(current_user)
    return UserProfile.model_validate(current_user)


@router.post("/me/complete-onboarding", response_model=UserProfile)
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    if current_user.onboarding_completed_at is None:
        current_user.onboarding_completed_at = datetime.now(timezone.utc)
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
    user_id = current_user.id
    await db.delete(current_user)
    await db.commit()
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)

    # Not DB-cascaded (it's on disk, not a table) — clean up any uploaded
    # avatar so deleted accounts don't leave orphaned files behind.
    shutil.rmtree(AVATARS_DIR / str(user_id), ignore_errors=True)
