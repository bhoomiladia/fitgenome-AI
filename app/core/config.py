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
    DATABASE_URL: str = "postgresql+asyncpg://fitgenome:fitgenome_secret@db:5432/fitgenome_db"

    # ── Redis ─────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"

    # ── JWT / Auth ────────────────────────────────────────
    SECRET_KEY: str = "change-me-to-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── App ───────────────────────────────────────────────
    PROJECT_NAME: str = "FitGenome AI"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # ── AI / RAG ──────────────────────────────────────────
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "fitgenome-knowledge"
    PINECONE_CLOUD: str = "aws"
    PINECONE_REGION: str = "us-east-1"

    # ── LLM Fallbacks ────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    LLM_PROVIDER_ORDER: str = "gemini,groq"  # comma-separated priority

    # ── Vision Pipeline ──────────────────────────────────
    GEMINI_VISION_MODEL: str = "gemini-1.5-flash"
    VISION_LATENCY_THRESHOLD_MS: int = 8000
    GROQ_VISION_MODEL: str = "llava-v1.5-7b-4096-preview"
    IMAGE_MIN_SIZE_PX: int = 200
    IMAGE_MAX_SIZE_PX: int = 2048
    IMAGE_BLUR_THRESHOLD: float = 100.0

    # ── Celery ────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"


settings = Settings()
