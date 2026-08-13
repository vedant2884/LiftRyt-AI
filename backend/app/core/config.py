from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, populated from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "LiftRyt AI"
    environment: str = "development"

    # Comma-separated in the environment, parsed into a list below.
    cors_origins: str = "http://localhost:5173"
    # Used to build links that point back at the SPA (password reset).
    frontend_url: str = "http://localhost:5173"

    # Set via docker-compose.yml (composed from POSTGRES_* vars there); the
    # localhost fallback here only matters when running the backend outside
    # Docker against a locally-installed Postgres.
    database_url: str = (
        "postgresql+asyncpg://liftryt:liftryt_dev_password@localhost:5432/liftryt"
    )

    @field_validator("database_url")
    @classmethod
    def _normalize_managed_postgres_url(cls, value: str) -> str:
        # Managed Postgres hosts (Render, Neon, ...) hand back a plain
        # postgres://... or postgresql://... URL, but create_async_engine
        # needs the asyncpg driver named explicitly in the scheme. Local dev
        # already sets this correctly via docker-compose.yml, so this branch
        # is a no-op there.
        if value.startswith("postgres://"):
            value = "postgresql+asyncpg://" + value[len("postgres://") :]
        elif value.startswith("postgresql://"):
            value = "postgresql+asyncpg://" + value[len("postgresql://") :]

        # Neon (and others) append ?sslmode=require, the libpq/psycopg
        # spelling — asyncpg's connect() has no sslmode kwarg, only ssl, so
        # SQLAlchemy's asyncpg dialect would otherwise forward an argument
        # asyncpg rejects outright. Renaming the query key is enough; both
        # drivers accept the same "require" string value.
        parts = urlsplit(value)
        query = parse_qsl(parts.query)
        if query and any(key == "sslmode" for key, _ in query):
            query = [("ssl", v) if k == "sslmode" else (k, v) for k, v in query]
            parts = parts._replace(query=urlencode(query))
            value = urlunsplit(parts)

        return value

    # Same pattern as database_url: set via docker-compose.yml in Docker,
    # localhost fallback for running the backend outside Docker.
    redis_url: str = "redis://localhost:6379/0"

    # Dev-only default so the app boots without extra setup; a real deployment
    # must override this with a long random value (JWT_SECRET_KEY env var).
    jwt_secret_key: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Provider-agnostic LLM layer: OpenRouter (free-tier model, primary) and
    # Ollama (local, no account needed, dev-mode fallback) both expose an
    # OpenAI-compatible chat completions API, so switching providers is this
    # one setting, not a rewritten client — see app/services/llm/provider.py.
    llm_provider: str = "openrouter"  # "openrouter" | "ollama"
    openrouter_api_key: str = ""
    openrouter_model: str = "liquid/lfm-2.5-2.6b:free"
    # host.docker.internal resolves to the host machine from inside the
    # backend container — the right default for a natively-installed Ollama.
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"

    # Step 13: Google Sign-In. Verifying a Firebase ID token only needs the
    # project ID (as the expected audience) — no service account JSON.
    firebase_project_id: str = ""

    # Base URL the browser can reach the backend at, used to build absolute
    # URLs for locally-stored uploads (avatars) that get embedded in
    # UserProfile responses and rendered directly in <img> tags. Distinct
    # from database_url/redis_url's container-network addressing — this one
    # has to resolve from the user's browser, not from inside Docker.
    backend_public_url: str = "http://localhost:8000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def cookie_secure(self) -> bool:
        return self.environment == "production"

    @property
    def cookie_samesite(self) -> str:
        """"lax" works fine in local dev, where the frontend and backend
        share an effective origin via the same host. In a real deployment
        the frontend (Firebase Hosting) and backend (a separate host) are on
        different domains, and a cross-site fetch/XHR never attaches a Lax
        cookie — only "none" is sent cross-site, which browsers additionally
        require to be paired with Secure (already guaranteed here, since
        both flip on the same environment=="production" condition)."""
        return "none" if self.environment == "production" else "lax"


settings = Settings()
