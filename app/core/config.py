"""
Centralized application settings.

All values are loaded from environment variables (or a `.env` file)
via pydantic-settings.  See `.env.example` for the full list.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────
    DATABASE_URL: str = "postgresql://fitgenome:fitgenome_secret@db:5432/fitgenome_db"

    # ── JWT / Auth ────────────────────────────────────────
    SECRET_KEY: str = "change-me-to-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── App ───────────────────────────────────────────────
    PROJECT_NAME: str = "FitGenome AI"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # ── OpenRouter ────────────────────────────────────────
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "google/gemini-2.0-flash"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # ── Gemini (kept for Vision pipeline + fallback LLM) ──
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    LLM_PROVIDER_ORDER: str = "openrouter,gemini"  # comma-separated priority

    # ── Vision Pipeline ──────────────────────────────────
    GEMINI_VISION_MODEL: str = "gemini-2.5-flash-lite"
    VISION_LATENCY_THRESHOLD_MS: int = 8000
    OPENROUTER_VISION_MODEL: str = "google/gemini-2.0-flash"
    IMAGE_MIN_SIZE_PX: int = 200
    IMAGE_MAX_SIZE_PX: int = 2048
    IMAGE_BLUR_THRESHOLD: float = 10.0


settings = Settings()
