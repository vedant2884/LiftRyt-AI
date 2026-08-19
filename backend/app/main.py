from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import (
    auth,
    chat,
    custom_exercises,
    exercises,
    favorites,
    macros,
    notifications,
    progressions,
    recommendations,
    splits,
    streaks,
    weight,
    workouts,
)
from app.core.config import settings
from app.core.storage import UPLOADS_DIR

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves locally-stored uploads (avatars) at BACKEND_PUBLIC_URL/static/... —
# plain <img> requests aren't subject to CORS, so no extra config needed for
# the frontend to render these directly.
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")

app.include_router(auth.router)
# custom_exercises/favorites share the /exercises/* path space as
# exercises.router's GET /{exercise_id} — must be registered first, or
# "/exercises/custom" and "/exercises/favorites" would be swallowed by that
# catch-all (FastAPI matches routes in registration order; "custom"/
# "favorites" would fail UUID validation on exercise_id and 422 instead of
# ever reaching these routers).
app.include_router(custom_exercises.router)
app.include_router(favorites.router)
app.include_router(progressions.router)
app.include_router(exercises.router)
app.include_router(weight.router)
app.include_router(workouts.router)
app.include_router(macros.router)
app.include_router(splits.router)
app.include_router(streaks.router)
app.include_router(recommendations.router)
app.include_router(chat.router)
app.include_router(notifications.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
