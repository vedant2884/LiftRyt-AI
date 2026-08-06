from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, populated from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "LiftRyt AI"
    environment: str = "development"

    # Comma-separated in the environment, parsed into a list below.
    cors_origins: str = "http://localhost:5173"

    # Set via docker-compose.yml (composed from POSTGRES_* vars there); the
    # localhost fallback here only matters when running the backend outside
    # Docker against a locally-installed Postgres.
    database_url: str = (
        "postgresql+asyncpg://liftryt:liftryt_dev_password@localhost:5432/liftryt"
    )

    # Same pattern as database_url: set via docker-compose.yml in Docker,
    # localhost fallback for running the backend outside Docker.
    redis_url: str = "redis://localhost:6379/0"

    # Dev-only default so the app boots without extra setup; a real deployment
    # must override this with a long random value (JWT_SECRET_KEY env var).
    jwt_secret_key: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Provider-agnostic LLM layer: Groq (free tier, fast, primary) and Ollama
    # (local, no account needed, dev-mode fallback) both expose an
    # OpenAI-compatible chat completions API, so switching providers is this
    # one setting, not a rewritten client — see app/services/llm/provider.py.
    llm_provider: str = "groq"  # "groq" | "ollama"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    # host.docker.internal resolves to the host machine from inside the
    # backend container — the right default for a natively-installed Ollama.
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def cookie_secure(self) -> bool:
        return self.environment == "production"


settings = Settings()
