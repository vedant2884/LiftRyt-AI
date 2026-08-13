"""Firebase ID token verification.

Deliberately lightweight: verifying a Firebase ID token only requires
checking its signature against Google's public keys and matching the
project ID as audience — the `google-auth` library's
`verify_firebase_token` does exactly that. No Firebase Admin SDK, no
service account JSON, no server-side Firebase project needed.
"""

import logging
from dataclasses import dataclass

import requests
from cachecontrol import CacheControl
from fastapi import HTTPException, status
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings

logger = logging.getLogger(__name__)

# verify_firebase_token re-fetches Google's public signing certs on every
# single call by default — a live network round trip per sign-in, on top of
# the actual verification. Google's cert endpoint already sends correct
# Cache-Control headers (~1h+), so wrapping the session with CacheControl
# (google-auth's own docs recommend exactly this) makes every verification
# after the first one purely local. See google/oauth2/id_token.py's
# verify_token() docstring.
_google_request = google_requests.Request(session=CacheControl(requests.Session()))


@dataclass
class FirebaseIdentity:
    uid: str
    email: str
    full_name: str
    avatar_url: str | None


def verify_firebase_id_token(token: str) -> FirebaseIdentity:
    try:
        claims = id_token.verify_firebase_token(
            token,
            _google_request,
            audience=settings.firebase_project_id,
            # Local dev runs the backend inside a Docker/WSL2 VM whose clock
            # can drift a handful of seconds after the host sleeps or Docker
            # Desktop restarts, which otherwise rejects an honest, freshly
            # issued token as "used too early". A generous-but-bounded
            # tolerance absorbs that without meaningfully weakening
            # expiry/issued-at validation.
            clock_skew_in_seconds=30,
        )
    except (GoogleAuthError, ValueError) as exc:
        # verify_firebase_token collapses every failure mode (bad audience,
        # expired token, clock skew, cert fetch failure) into the same
        # generic 401, so the real reason only ever shows up here.
        logger.warning("Firebase ID token verification failed: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google sign-in token") from exc

    if claims is None or not claims.get("email"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google sign-in token")

    return FirebaseIdentity(
        # verify_firebase_token returns the raw decoded token claims — the
        # Firebase UID is the standard JWT "sub" claim, not a "uid" key.
        uid=claims["sub"],
        email=claims["email"],
        full_name=claims.get("name") or claims["email"].split("@")[0],
        avatar_url=claims.get("picture"),
    )
