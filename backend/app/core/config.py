from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, populated from environment variables / .env.

    Extended in later steps (LLM_PROVIDER in step 10, etc.) rather than
    front-loaded here, so this file stays a truthful record of what the app
    actually uses at each stage.
    """

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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def cookie_secure(self) -> bool:
        return self.environment == "production"


settings = Settings()
