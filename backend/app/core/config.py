from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, populated from environment variables / .env.

    Extended in later steps (DATABASE_URL in step 2, JWT secrets in step 3,
    LLM_PROVIDER in step 10, etc.) rather than front-loaded here, so this file
    stays a truthful record of what the app actually uses at each stage.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "LiftRyt AI"
    environment: str = "development"

    # Comma-separated in the environment, parsed into a list below.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
